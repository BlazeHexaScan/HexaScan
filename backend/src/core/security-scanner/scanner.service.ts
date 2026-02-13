/**
 * Security Scanner Service
 * Main orchestrator for repository security scanning
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { prisma } from '../database/client.js';
import { scanDirectory, ScanFinding } from './file-scanner.js';
import { checkDependencies, DependencyVulnerability } from './dependency-checker.js';
import { systemConfigService } from '../config/index.js';
import { decrypt } from '../encryption/index.js';

const execFileAsync = promisify(execFile);

/**
 * Validate a git URL to prevent command injection
 */
function validateGitUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return ['https:', 'http:', 'ssh:', 'git:'].includes(parsed.protocol);
  } catch {
    // Allow SSH-style URLs like git@github.com:user/repo.git
    return /^[a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+:[a-zA-Z0-9._/-]+\.git$/.test(url);
  }
}

/**
 * Validate a branch name to prevent injection
 */
function validateBranchName(branch: string): boolean {
  return /^[a-zA-Z0-9._\/-]+$/.test(branch);
}

/**
 * Build an authenticated git clone URL based on platform
 */
function buildAuthenticatedUrl(url: string, token: string, platform?: string): string {
  try {
    const parsed = new URL(url);
    switch (platform) {
      case 'GITLAB':
        parsed.username = 'oauth2';
        parsed.password = token;
        break;
      case 'BITBUCKET':
        parsed.username = 'x-token-auth';
        parsed.password = token;
        break;
      case 'AZURE_DEVOPS':
      case 'GITHUB':
      default:
        // GitHub, Azure DevOps, and others use token as username
        parsed.username = token;
        parsed.password = '';
        break;
    }
    return parsed.toString();
  } catch {
    // Fallback: insert token before the host
    return url.replace('https://', `https://${token}@`);
  }
}

/**
 * Extract a clean, user-friendly error message from git command output.
 * Strips tokens, internal paths, and raw command details.
 */
function sanitizeErrorMessage(message: string, token?: string): string {
  let sanitized = message;
  if (token) {
    sanitized = sanitized.replaceAll(token, '***');
    sanitized = sanitized.replaceAll(encodeURIComponent(token), '***');
  }
  // Strip any remaining credentials from URLs
  sanitized = sanitized.replace(/https?:\/\/[^@\s]+@/g, 'https://***@');

  // Extract the "fatal:" line from git output — that's the meaningful part
  const fatalMatch = sanitized.match(/fatal:\s*(.+)/i);
  if (fatalMatch) {
    const fatalMsg = fatalMatch[1].trim();

    // Map common git errors to user-friendly messages
    if (fatalMsg.includes('could not read Password') || fatalMsg.includes('terminal prompts disabled')) {
      return 'Authentication failed. The access token may be invalid, expired, or revoked. Please update the token and try again.';
    }
    if (fatalMsg.includes('could not read Username')) {
      return 'Authentication required. This appears to be a private repository. Please add it as Private with a valid access token.';
    }
    if (fatalMsg.includes('repository') && fatalMsg.includes('not found')) {
      return 'Repository not found. Please verify the URL is correct and you have access to this repository.';
    }
    if (fatalMatch[1].includes('Could not resolve host')) {
      return 'Could not connect to the Git host. Please check the repository URL.';
    }
    if (fatalMsg.includes('Could not find remote branch')) {
      return 'The specified branch was not found in the repository.';
    }

    // Return just the fatal message without the full command prefix
    return fatalMsg;
  }

  // If no fatal line, check for other common patterns
  if (sanitized.includes('timed out') || sanitized.includes('ETIMEDOUT')) {
    return 'Clone operation timed out. The repository may be too large or the server is unreachable.';
  }

  // Fallback: strip the "Command failed:" prefix and temp paths
  sanitized = sanitized.replace(/^Command failed:.*?(?=fatal:|$)/s, '').trim();
  sanitized = sanitized.replace(/[A-Z]:\\Users\\[^\s"]+/g, '...').replace(/\/tmp\/[^\s"]+/g, '...');

  return sanitized || 'Clone failed. Please verify the repository URL and try again.';
}

export interface ScanProgress {
  step: string;
  progress: number;
  message: string;
}

type ProgressCallback = (progress: ScanProgress) => Promise<void>;

/**
 * Clone a git repository (supports authenticated cloning for private repos)
 */
async function cloneRepository(
  url: string,
  branch: string,
  targetDir: string,
  onProgress?: ProgressCallback,
  encryptedToken?: string,
  platform?: string
): Promise<void> {
  // Decrypt token if provided (for private repos)
  let rawToken: string | undefined;
  let cloneUrl = url;
  if (encryptedToken) {
    rawToken = decrypt(encryptedToken);
    cloneUrl = buildAuthenticatedUrl(url, rawToken, platform);
  }

  if (onProgress) {
    await onProgress({
      step: 'CLONING',
      progress: 10,
      // Never log the authenticated URL
      message: `Cloning repository from ${url}...`,
    });
  }

  // Validate inputs to prevent command injection
  if (!validateGitUrl(url)) {
    throw new Error('Invalid repository URL format');
  }
  if (!validateBranchName(branch)) {
    throw new Error('Invalid branch name format');
  }

  // Create target directory
  await fs.mkdir(targetDir, { recursive: true });

  // Prevent git from using stored credentials or prompting for them.
  // credential.helper= disables Git Credential Manager (prevents auto-injection of stored tokens).
  // GIT_TERMINAL_PROMPT=0 prevents interactive prompts.
  // GIT_ASKPASS= prevents external askpass programs.
  // GIT_CONFIG_NOSYSTEM=1 ignores system-level git config (which may configure credential helpers).
  const gitEnv = {
    ...process.env,
    GIT_TERMINAL_PROMPT: '0',
    GIT_ASKPASS: '',
    GIT_SSH_COMMAND: 'ssh -o BatchMode=yes',
    GIT_CONFIG_NOSYSTEM: '1',
  };
  const timeout = systemConfigService.get<number>('repoScanner.cloneTimeoutMs');

  try {
    // Clone with shallow depth using execFile (safe from injection)
    // -c credential.helper= disables any credential helper for this command only
    await execFileAsync('git', ['-c', 'credential.helper=', 'clone', '--depth', '1', '--branch', branch, cloneUrl, targetDir], { timeout, env: gitEnv });

    if (onProgress) {
      await onProgress({
        step: 'CLONING',
        progress: 25,
        message: 'Repository cloned successfully',
      });
    }
  } catch (error: any) {
    if (error.message?.includes('Could not find remote branch')) {
      throw new Error(`Branch "${branch}" was not found in the repository. Please check the branch name and try again.`);
    } else {
      // Sanitize error message to strip token before re-throwing
      const sanitized = sanitizeErrorMessage(error.message || 'Clone failed', rawToken);
      throw new Error(sanitized);
    }
  }
}

/**
 * Clean up temporary directory
 */
async function cleanupTempDir(dirPath: string): Promise<void> {
  try {
    await fs.rm(dirPath, { recursive: true, force: true });
  } catch (error) {
    console.error(`Failed to cleanup temp directory ${dirPath}:`, error);
  }
}

/**
 * Update scan status in database
 */
async function updateScanStatus(
  scanId: string,
  status: string,
  data: Partial<{
    currentStep: string;
    progress: number;
    filesScanned: number;
    totalFindings: number;
    criticalCount: number;
    highCount: number;
    mediumCount: number;
    lowCount: number;
    infoCount: number;
    errorMessage: string;
    startedAt: Date;
    completedAt: Date;
  }>
): Promise<void> {
  await prisma.securityScan.update({
    where: { id: scanId },
    data: {
      status: status as any,
      ...data,
    },
  });
}

/**
 * Convert scan findings to database format and save
 */
async function saveFindings(
  scanId: string,
  codeFindings: ScanFinding[],
  dependencyVulns: DependencyVulnerability[]
): Promise<void> {
  const findings = [];

  // Add code findings
  for (const finding of codeFindings) {
    findings.push({
      scanId,
      severity: finding.severity as any,
      category: finding.category as any,
      title: finding.patternName,
      description: finding.description,
      filePath: finding.filePath,
      lineNumber: finding.lineNumber,
      codeSnippet: finding.codeSnippet,
      pattern: finding.patternId,
      recommendation: finding.recommendation,
      confidence: finding.confidence,
    });
  }

  // Add dependency vulnerabilities
  for (const vuln of dependencyVulns) {
    findings.push({
      scanId,
      severity: vuln.severity as any,
      category: 'DEPENDENCY' as any,
      title: `${vuln.package}@${vuln.version}: ${vuln.id}`,
      description: vuln.summary,
      filePath: `package: ${vuln.package}`,
      lineNumber: null,
      codeSnippet: vuln.details?.slice(0, 500) || null,
      pattern: vuln.id,
      recommendation: vuln.fixedVersion
        ? `Update to version ${vuln.fixedVersion} or later`
        : 'Check the vulnerability details for remediation steps',
      confidence: 'HIGH',
    });
  }

  // Batch insert findings
  if (findings.length > 0) {
    await prisma.securityFinding.createMany({
      data: findings,
    });
  }
}

/**
 * Run a complete security scan on a repository
 */
export async function runSecurityScan(
  scanId: string,
  repositoryId: string,
  repoUrl: string,
  branch: string,
  encryptedToken?: string,
  platform?: string
): Promise<void> {
  // Create temp directory for cloning
  const tempDir = path.join(os.tmpdir(), `repo-scan-${scanId}`);

  // Progress callback to update database
  const onProgress: ProgressCallback = async (progress) => {
    await updateScanStatus(scanId, progress.step, {
      currentStep: progress.step,
      progress: progress.progress,
    });
  };

  try {
    // Mark scan as started
    await updateScanStatus(scanId, 'CLONING', {
      startedAt: new Date(),
      currentStep: 'CLONING',
      progress: 0,
    });

    // Step 1: Clone repository (with auth for private repos)
    await cloneRepository(repoUrl, branch, tempDir, onProgress, encryptedToken, platform);

    // Step 2: Scan files for patterns
    await onProgress({
      step: 'SCANNING',
      progress: 30,
      message: 'Scanning files for security issues...',
    });

    const fileScanResult = await scanDirectory(tempDir, async (scanned, total, currentFile) => {
      const progress = 30 + Math.floor((scanned / total) * 40);
      await onProgress({
        step: 'SCANNING',
        progress: Math.min(progress, 70),
        message: `Scanning: ${currentFile}`,
      });
    });

    // Step 3: Check dependencies for vulnerabilities
    await onProgress({
      step: 'ANALYZING',
      progress: 75,
      message: 'Checking dependencies for vulnerabilities...',
    });

    const dependencyResults = await checkDependencies(tempDir);

    // Collect all dependency vulnerabilities
    const allDependencyVulns: DependencyVulnerability[] = [];
    for (const result of dependencyResults) {
      allDependencyVulns.push(...result.vulnerabilities);
    }

    await onProgress({
      step: 'ANALYZING',
      progress: 90,
      message: 'Analyzing results...',
    });

    // Calculate totals
    const severityCounts = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
      info: 0,
    };

    // Count code findings
    for (const finding of fileScanResult.findings) {
      switch (finding.severity) {
        case 'CRITICAL':
          severityCounts.critical++;
          break;
        case 'HIGH':
          severityCounts.high++;
          break;
        case 'MEDIUM':
          severityCounts.medium++;
          break;
        case 'LOW':
          severityCounts.low++;
          break;
        case 'INFO':
          severityCounts.info++;
          break;
      }
    }

    // Count dependency vulnerabilities
    for (const vuln of allDependencyVulns) {
      switch (vuln.severity) {
        case 'CRITICAL':
          severityCounts.critical++;
          break;
        case 'HIGH':
          severityCounts.high++;
          break;
        case 'MEDIUM':
          severityCounts.medium++;
          break;
        case 'LOW':
          severityCounts.low++;
          break;
        case 'INFO':
          severityCounts.info++;
          break;
      }
    }

    const totalFindings = fileScanResult.findings.length + allDependencyVulns.length;

    // Save findings to database
    await saveFindings(scanId, fileScanResult.findings, allDependencyVulns);

    // Update repository's lastScannedAt
    await prisma.repository.update({
      where: { id: repositoryId },
      data: { lastScannedAt: new Date() },
    });

    // Mark scan as completed
    await updateScanStatus(scanId, 'COMPLETED', {
      currentStep: 'COMPLETED',
      progress: 100,
      filesScanned: fileScanResult.filesScanned,
      totalFindings,
      criticalCount: severityCounts.critical,
      highCount: severityCounts.high,
      mediumCount: severityCounts.medium,
      lowCount: severityCounts.low,
      infoCount: severityCounts.info,
      completedAt: new Date(),
    });

    console.log(`[SecurityScanner] Scan ${scanId} completed: ${totalFindings} findings in ${fileScanResult.filesScanned} files`);
  } catch (error: any) {
    // Decrypt token to sanitize it from error messages
    let rawToken: string | undefined;
    if (encryptedToken) {
      try { rawToken = decrypt(encryptedToken); } catch { /* ignore */ }
    }
    const safeMessage = sanitizeErrorMessage(error.message || 'Unknown error occurred', rawToken);
    console.error(`[SecurityScanner] Scan ${scanId} failed:`, safeMessage);

    await updateScanStatus(scanId, 'FAILED', {
      errorMessage: safeMessage,
      completedAt: new Date(),
    });
  } finally {
    // Clean up temp directory
    await cleanupTempDir(tempDir);
  }
}

/**
 * Get scan progress for polling
 */
export async function getScanProgress(scanId: string): Promise<{
  status: string;
  step: string;
  progress: number;
  filesScanned: number | null;
  totalFindings: number | null;
  errorMessage: string | null;
} | null> {
  const scan = await prisma.securityScan.findUnique({
    where: { id: scanId },
    select: {
      status: true,
      currentStep: true,
      progress: true,
      filesScanned: true,
      totalFindings: true,
      errorMessage: true,
    },
  });

  if (!scan) {
    return null;
  }

  return {
    status: scan.status,
    step: scan.currentStep || 'PENDING',
    progress: scan.progress,
    filesScanned: scan.filesScanned,
    totalFindings: scan.totalFindings,
    errorMessage: scan.errorMessage,
  };
}
