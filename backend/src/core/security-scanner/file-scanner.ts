/**
 * File Scanner
 * Scans individual files for security patterns
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { getPatternsForFile } from './patterns.js';
import { systemConfigService } from '../config/index.js';

export interface ScanFinding {
  patternId: string;
  patternName: string;
  description: string;
  category: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';
  confidence: string;
  filePath: string;
  lineNumber: number;
  codeSnippet: string;
  recommendation: string;
}

export interface FileScanResult {
  filePath: string;
  findings: ScanFinding[];
  scanned: boolean;
  error?: string;
}

// File extensions to scan
const SCANNABLE_EXTENSIONS = new Set([
  // PHP
  '.php', '.phtml', '.php3', '.php4', '.php5', '.php7', '.phps', '.inc',
  // JavaScript/TypeScript
  '.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs',
  // Python
  '.py', '.pyw', '.pyx',
  // Config files
  '.json', '.yml', '.yaml', '.xml', '.ini', '.conf', '.config', '.cfg',
  // Web
  '.html', '.htm', '.tpl', '.twig',
  // Shell
  '.sh', '.bash', '.zsh',
  // Ruby
  '.rb', '.erb',
  // Other
  '.env', '.htaccess', '.htpasswd',
]);

// Files to always skip
const SKIP_FILES = new Set([
  'package-lock.json',
  'yarn.lock',
  'composer.lock',
  'Pipfile.lock',
  'poetry.lock',
]);

// Directories to always skip
const SKIP_DIRS = new Set([
  'node_modules',
  'vendor',
  '.git',
  '__pycache__',
  '.venv',
  'venv',
  'env',
  '.tox',
  'dist',
  'build',
  '.next',
  '.nuxt',
  '.cache',
  'coverage',
  '.idea',
  '.vscode',
]);

// Maximum file size to scan (from system config)
function getMaxFileSize(): number {
  return systemConfigService.get<number>('repoScanner.maxFileSizeBytes');
}

/**
 * Check if a file should be scanned based on extension
 */
function shouldScanFile(filename: string): boolean {
  if (SKIP_FILES.has(filename)) {
    return false;
  }

  const ext = path.extname(filename).toLowerCase();

  // Check if it's a known scannable extension
  if (SCANNABLE_EXTENSIONS.has(ext)) {
    return true;
  }

  // Also scan files without extension that might be configs
  if (ext === '' && (filename.startsWith('.') || filename.includes('config'))) {
    return true;
  }

  return false;
}

/**
 * Check if a directory should be skipped
 */
function shouldSkipDirectory(dirname: string): boolean {
  return SKIP_DIRS.has(dirname);
}

/**
 * Extract code snippet around a match
 */
function extractCodeSnippet(content: string, matchIndex: number, maxLength: number = 200): string {
  // Find the line containing the match
  const lines = content.split('\n');
  let currentIndex = 0;

  for (let i = 0; i < lines.length; i++) {
    const lineLength = lines[i].length + 1; // +1 for newline
    if (currentIndex + lineLength > matchIndex) {
      // Found the line
      let snippet = lines[i].trim();

      // Truncate if too long
      if (snippet.length > maxLength) {
        const matchOffset = matchIndex - currentIndex;
        const start = Math.max(0, matchOffset - maxLength / 2);
        const end = Math.min(snippet.length, matchOffset + maxLength / 2);
        snippet = (start > 0 ? '...' : '') + snippet.slice(start, end) + (end < snippet.length ? '...' : '');
      }

      return snippet;
    }
    currentIndex += lineLength;
  }

  return content.slice(Math.max(0, matchIndex - 50), matchIndex + 150).trim();
}

/**
 * Get line number for a character index
 */
function getLineNumber(content: string, charIndex: number): number {
  const substring = content.slice(0, charIndex);
  return (substring.match(/\n/g) || []).length + 1;
}

/**
 * Check if a match is inside a URL (common source of false positives)
 * Looks backwards from the match to see if it's part of a URL
 */
function isInsideUrl(content: string, matchIndex: number): boolean {
  // Look backwards up to 500 chars for a URL prefix on the same line
  const lookbackStart = Math.max(0, matchIndex - 500);
  const before = content.slice(lookbackStart, matchIndex);
  // Only check within the same line
  const lastNewline = before.lastIndexOf('\n');
  const sameLine = lastNewline >= 0 ? before.slice(lastNewline + 1) : before;
  return /https?:\/\/\S*$/.test(sameLine);
}

/**
 * Check if a match is inside a comment (reduces some false positives)
 */
function isInsideComment(line: string): boolean {
  const trimmed = line.trim();
  return trimmed.startsWith('//') || trimmed.startsWith('#') || trimmed.startsWith('*') || trimmed.startsWith('<!--');
}

/**
 * Scan a single file for security patterns
 */
export async function scanFile(filePath: string): Promise<FileScanResult> {
  const result: FileScanResult = {
    filePath,
    findings: [],
    scanned: false,
  };

  try {
    // Check file size
    const stats = await fs.stat(filePath);
    if (stats.size > getMaxFileSize()) {
      result.error = 'File too large to scan';
      return result;
    }

    // Read file content
    const content = await fs.readFile(filePath, 'utf-8');
    result.scanned = true;

    // Get applicable patterns for this file
    const patterns = getPatternsForFile(filePath);

    // Scan for each pattern
    for (const pattern of patterns) {
      // Reset regex lastIndex for global patterns
      pattern.pattern.lastIndex = 0;

      let match;
      while ((match = pattern.pattern.exec(content)) !== null) {
        // Skip matches inside URLs (common false positive source)
        if (isInsideUrl(content, match.index)) {
          if (!pattern.pattern.global) break;
          continue;
        }

        const lineNumber = getLineNumber(content, match.index);
        const codeSnippet = extractCodeSnippet(content, match.index);

        // Skip low-confidence matches in comments
        if (pattern.confidence === 'LOW' && isInsideComment(codeSnippet)) {
          if (!pattern.pattern.global) break;
          continue;
        }

        result.findings.push({
          patternId: pattern.id,
          patternName: pattern.name,
          description: pattern.description,
          category: pattern.category,
          severity: pattern.severity,
          confidence: pattern.confidence,
          filePath,
          lineNumber,
          codeSnippet,
          recommendation: pattern.recommendation,
        });

        // Prevent infinite loops for non-global patterns
        if (!pattern.pattern.global) break;
      }
    }
  } catch (error: any) {
    // Handle binary files or other read errors
    if (error.code === 'ENOENT') {
      result.error = 'File not found';
    } else if (error.message?.includes('encoding')) {
      result.error = 'Binary file - skipped';
    } else {
      result.error = error.message || 'Unknown error';
    }
  }

  return result;
}

/**
 * Recursively scan a directory for security issues
 */
export async function scanDirectory(
  dirPath: string,
  onProgress?: (scanned: number, total: number, currentFile: string) => void
): Promise<{
  findings: ScanFinding[];
  filesScanned: number;
  filesSkipped: number;
  errors: string[];
}> {
  const findings: ScanFinding[] = [];
  const errors: string[] = [];
  let filesScanned = 0;
  let filesSkipped = 0;

  // First, collect all files to scan
  const filesToScan: string[] = [];

  async function collectFiles(currentPath: string): Promise<void> {
    try {
      const entries = await fs.readdir(currentPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(currentPath, entry.name);

        if (entry.isDirectory()) {
          if (!shouldSkipDirectory(entry.name)) {
            await collectFiles(fullPath);
          }
        } else if (entry.isFile()) {
          if (shouldScanFile(entry.name)) {
            filesToScan.push(fullPath);
          } else {
            filesSkipped++;
          }
        }
      }
    } catch (error: any) {
      errors.push(`Error reading directory ${currentPath}: ${error.message}`);
    }
  }

  await collectFiles(dirPath);

  // Now scan each file
  for (let i = 0; i < filesToScan.length; i++) {
    const filePath = filesToScan[i];
    const relativePath = path.relative(dirPath, filePath);

    if (onProgress) {
      onProgress(i + 1, filesToScan.length, relativePath);
    }

    const result = await scanFile(filePath);

    if (result.scanned) {
      filesScanned++;
      // Convert file paths to relative paths
      for (const finding of result.findings) {
        finding.filePath = relativePath;
        findings.push(finding);
      }
    } else {
      filesSkipped++;
      if (result.error) {
        errors.push(`${relativePath}: ${result.error}`);
      }
    }
  }

  return {
    findings,
    filesScanned,
    filesSkipped,
    errors,
  };
}

/**
 * Get file extension counts for a directory
 */
export async function getFileStats(dirPath: string): Promise<{
  totalFiles: number;
  byExtension: Record<string, number>;
}> {
  const byExtension: Record<string, number> = {};
  let totalFiles = 0;

  async function countFiles(currentPath: string): Promise<void> {
    try {
      const entries = await fs.readdir(currentPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(currentPath, entry.name);

        if (entry.isDirectory()) {
          if (!shouldSkipDirectory(entry.name)) {
            await countFiles(fullPath);
          }
        } else if (entry.isFile()) {
          totalFiles++;
          const ext = path.extname(entry.name).toLowerCase() || '(no extension)';
          byExtension[ext] = (byExtension[ext] || 0) + 1;
        }
      }
    } catch (error) {
      // Ignore errors in counting
    }
  }

  await countFiles(dirPath);

  return { totalFiles, byExtension };
}
