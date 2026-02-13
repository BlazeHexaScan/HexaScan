/**
 * Security Scanner Module
 * Export all scanner components
 */

export { ALL_PATTERNS, getPatternsForFile, type SecurityPattern } from './patterns.js';
export { scanDirectory, scanFile, type ScanFinding, type FileScanResult } from './file-scanner.js';
export { checkDependencies, type DependencyVulnerability, type DependencyCheckResult } from './dependency-checker.js';
export { runSecurityScan, getScanProgress, type ScanProgress } from './scanner.service.js';
export { initializeRepoScanWorker, closeRepoScanWorker, getRepoScanWorker } from './repo-scan-worker.js';
