/**
 * Dependency Vulnerability Checker
 * Uses Google OSV (Open Source Vulnerabilities) API to check dependencies
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { systemConfigService } from '../config/index.js';

export interface DependencyVulnerability {
  id: string;
  summary: string;
  details: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';
  package: string;
  version: string;
  fixedVersion?: string;
  references: string[];
}

export interface DependencyCheckResult {
  ecosystem: string;
  lockFile: string;
  totalDependencies: number;
  vulnerabilities: DependencyVulnerability[];
  error?: string;
}

// OSV API endpoint
const OSV_API_URL = 'https://api.osv.dev/v1/querybatch';

// Severity mapping from CVSS score
function cvssToSeverity(score: number): 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO' {
  if (score >= 9.0) return 'CRITICAL';
  if (score >= 7.0) return 'HIGH';
  if (score >= 4.0) return 'MEDIUM';
  if (score >= 0.1) return 'LOW';
  return 'INFO';
}

// Extract severity from OSV vulnerability
function extractSeverity(vuln: any): 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO' {
  // Check for CVSS scores
  if (vuln.severity && Array.isArray(vuln.severity)) {
    for (const sev of vuln.severity) {
      if (sev.type === 'CVSS_V3' && typeof sev.score === 'string') {
        const score = parseFloat(sev.score);
        if (!isNaN(score)) {
          return cvssToSeverity(score);
        }
      }
    }
  }

  // Check database_specific severity
  if (vuln.database_specific?.severity) {
    const sev = vuln.database_specific.severity.toUpperCase();
    if (['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].includes(sev)) {
      return sev as 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
    }
  }

  // Default to MEDIUM if no severity info
  return 'MEDIUM';
}

// Extract fixed version from affected ranges
function extractFixedVersion(vuln: any, packageName: string): string | undefined {
  if (!vuln.affected || !Array.isArray(vuln.affected)) {
    return undefined;
  }

  for (const affected of vuln.affected) {
    if (affected.package?.name !== packageName) continue;

    if (affected.ranges && Array.isArray(affected.ranges)) {
      for (const range of affected.ranges) {
        if (range.events && Array.isArray(range.events)) {
          for (const event of range.events) {
            if (event.fixed) {
              return event.fixed;
            }
          }
        }
      }
    }
  }

  return undefined;
}

/**
 * Parse package-lock.json (npm)
 */
async function parsePackageLock(filePath: string): Promise<{ name: string; version: string }[]> {
  const content = await fs.readFile(filePath, 'utf-8');
  const lockFile = JSON.parse(content);
  const deps: { name: string; version: string }[] = [];

  // npm v2+ format (lockfileVersion 2 or 3)
  if (lockFile.packages) {
    for (const [pkgPath, pkg] of Object.entries(lockFile.packages) as any) {
      if (pkgPath === '' || !pkg.version) continue;

      // Extract package name from path (node_modules/package-name)
      const name = pkgPath.replace(/^node_modules\//, '').split('/node_modules/').pop();
      if (name && !name.startsWith('.')) {
        deps.push({ name, version: pkg.version });
      }
    }
  }

  // npm v1 format (lockfileVersion 1)
  if (lockFile.dependencies && deps.length === 0) {
    function extractDeps(dependencies: any) {
      for (const [name, info] of Object.entries(dependencies) as any) {
        if (info.version) {
          deps.push({ name, version: info.version });
        }
        if (info.dependencies) {
          extractDeps(info.dependencies);
        }
      }
    }
    extractDeps(lockFile.dependencies);
  }

  return deps;
}

/**
 * Parse yarn.lock
 */
async function parseYarnLock(filePath: string): Promise<{ name: string; version: string }[]> {
  const content = await fs.readFile(filePath, 'utf-8');
  const deps: { name: string; version: string }[] = [];

  // Parse yarn.lock format (v1 style)
  // Format: "package@version":\n  version "x.x.x"
  const packageRegex = /^"?(@?[^@\n]+)@[^":\n]+(?:",|:)$/gm;
  const versionRegex = /^\s+version\s+"([^"]+)"/gm;

  let packageMatch;

  while ((packageMatch = packageRegex.exec(content)) !== null) {
    const packageName = packageMatch[1];
    const searchStart = packageMatch.index;

    // Find the version after this package declaration
    versionRegex.lastIndex = searchStart;
    const versionMatch = versionRegex.exec(content);

    if (versionMatch && versionMatch.index < content.indexOf('\n\n', searchStart)) {
      const seen = deps.find(d => d.name === packageName && d.version === versionMatch[1]);
      if (!seen) {
        deps.push({ name: packageName, version: versionMatch[1] });
      }
    }
  }

  return deps;
}

/**
 * Parse composer.lock (PHP)
 */
async function parseComposerLock(filePath: string): Promise<{ name: string; version: string }[]> {
  const content = await fs.readFile(filePath, 'utf-8');
  const lockFile = JSON.parse(content);
  const deps: { name: string; version: string }[] = [];

  const packages = [...(lockFile.packages || []), ...(lockFile['packages-dev'] || [])];

  for (const pkg of packages) {
    if (pkg.name && pkg.version) {
      // Remove 'v' prefix if present
      const version = pkg.version.replace(/^v/, '');
      deps.push({ name: pkg.name, version });
    }
  }

  return deps;
}

/**
 * Parse requirements.txt (Python)
 */
async function parseRequirementsTxt(filePath: string): Promise<{ name: string; version: string }[]> {
  const content = await fs.readFile(filePath, 'utf-8');
  const deps: { name: string; version: string }[] = [];

  const lines = content.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();

    // Skip comments and empty lines
    if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('-')) {
      continue;
    }

    // Parse package==version or package>=version
    const match = trimmed.match(/^([a-zA-Z0-9_-]+)\s*[=<>!~]+\s*([0-9][^\s;#]*)/);
    if (match) {
      deps.push({ name: match[1].toLowerCase(), version: match[2] });
    }
  }

  return deps;
}

/**
 * Parse Pipfile.lock (Python)
 */
async function parsePipfileLock(filePath: string): Promise<{ name: string; version: string }[]> {
  const content = await fs.readFile(filePath, 'utf-8');
  const lockFile = JSON.parse(content);
  const deps: { name: string; version: string }[] = [];

  const sources = [lockFile.default || {}, lockFile.develop || {}];

  for (const source of sources) {
    for (const [name, info] of Object.entries(source) as any) {
      if (info.version) {
        // Remove == prefix
        const version = info.version.replace(/^==/, '');
        deps.push({ name: name.toLowerCase(), version });
      }
    }
  }

  return deps;
}

/**
 * Query OSV API for vulnerabilities
 */
async function queryOSV(
  ecosystem: string,
  packages: { name: string; version: string }[]
): Promise<Map<string, any[]>> {
  const results = new Map<string, any[]>();

  // OSV has a limit on batch size, so we chunk requests
  const chunkSize = systemConfigService.get<number>('repoScanner.osvBatchSize');
  const chunks: { name: string; version: string }[][] = [];

  for (let i = 0; i < packages.length; i += chunkSize) {
    chunks.push(packages.slice(i, i + chunkSize));
  }

  for (const chunk of chunks) {
    const queries = chunk.map(pkg => ({
      package: {
        name: pkg.name,
        ecosystem,
      },
      version: pkg.version,
    }));

    try {
      const response = await fetch(OSV_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ queries }),
      });

      if (!response.ok) {
        console.error(`OSV API error: ${response.status} ${response.statusText}`);
        continue;
      }

      const data = await response.json() as { results?: { vulns?: any[] }[] };

      if (data.results && Array.isArray(data.results)) {
        for (let i = 0; i < data.results.length; i++) {
          const result = data.results[i];
          const pkg = chunk[i];

          if (result.vulns && result.vulns.length > 0) {
            const key = `${pkg.name}@${pkg.version}`;
            results.set(key, result.vulns);
          }
        }
      }
    } catch (error: any) {
      console.error(`OSV API request failed: ${error.message}`);
    }
  }

  return results;
}

/**
 * Check dependencies for vulnerabilities
 */
export async function checkDependencies(repoPath: string): Promise<DependencyCheckResult[]> {
  const results: DependencyCheckResult[] = [];

  // Check for various lock files
  const lockFiles = [
    { file: 'package-lock.json', ecosystem: 'npm', parser: parsePackageLock },
    { file: 'yarn.lock', ecosystem: 'npm', parser: parseYarnLock },
    { file: 'composer.lock', ecosystem: 'Packagist', parser: parseComposerLock },
    { file: 'requirements.txt', ecosystem: 'PyPI', parser: parseRequirementsTxt },
    { file: 'Pipfile.lock', ecosystem: 'PyPI', parser: parsePipfileLock },
  ];

  for (const { file, ecosystem, parser } of lockFiles) {
    const filePath = path.join(repoPath, file);

    try {
      await fs.access(filePath);
    } catch {
      // File doesn't exist, skip
      continue;
    }

    const result: DependencyCheckResult = {
      ecosystem,
      lockFile: file,
      totalDependencies: 0,
      vulnerabilities: [],
    };

    try {
      // Parse lock file
      const dependencies = await parser(filePath);
      result.totalDependencies = dependencies.length;

      if (dependencies.length === 0) {
        results.push(result);
        continue;
      }

      // Query OSV for vulnerabilities
      const vulnMap = await queryOSV(ecosystem, dependencies);

      // Process vulnerabilities
      for (const [pkgKey, vulns] of vulnMap) {
        const [name, version] = pkgKey.split('@');

        for (const vuln of vulns) {
          result.vulnerabilities.push({
            id: vuln.id || 'UNKNOWN',
            summary: vuln.summary || 'No summary available',
            details: vuln.details || '',
            severity: extractSeverity(vuln),
            package: name,
            version,
            fixedVersion: extractFixedVersion(vuln, name),
            references: vuln.references?.map((r: any) => r.url) || [],
          });
        }
      }
    } catch (error: any) {
      result.error = `Failed to parse ${file}: ${error.message}`;
    }

    results.push(result);
  }

  return results;
}

/**
 * Get summary of dependency vulnerabilities
 */
export function summarizeVulnerabilities(results: DependencyCheckResult[]): {
  total: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
} {
  const summary = { total: 0, critical: 0, high: 0, medium: 0, low: 0 };

  for (const result of results) {
    for (const vuln of result.vulnerabilities) {
      summary.total++;
      switch (vuln.severity) {
        case 'CRITICAL':
          summary.critical++;
          break;
        case 'HIGH':
          summary.high++;
          break;
        case 'MEDIUM':
          summary.medium++;
          break;
        case 'LOW':
        case 'INFO':
          summary.low++;
          break;
      }
    }
  }

  return summary;
}
