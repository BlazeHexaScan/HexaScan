/**
 * Scan Results View
 * Displays security findings from a completed scan
 */

import { useState } from 'react';
import {
  Shield,
  ChevronDown,
  ChevronRight,
  FileCode,
  Filter,
} from 'lucide-react';
import type { SecurityScan, SecurityFinding, FindingSeverity, FindingCategory } from '@/types/repo-scanner';
import { getSeverityColor, getCategoryIcon } from '@/types/repo-scanner';

interface ScanResultsViewProps {
  scan: SecurityScan;
}

export function ScanResultsView({ scan }: ScanResultsViewProps) {
  const [severityFilter, setSeverityFilter] = useState<FindingSeverity | 'ALL'>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<FindingCategory | 'ALL'>('ALL');
  const [expandedFindings, setExpandedFindings] = useState<Set<string>>(new Set());

  const findings = scan.findings || [];

  // Filter findings
  const filteredFindings = findings.filter((f) => {
    if (severityFilter !== 'ALL' && f.severity !== severityFilter) return false;
    if (categoryFilter !== 'ALL' && f.category !== categoryFilter) return false;
    return true;
  });

  // Group findings by category
  const groupedFindings = filteredFindings.reduce((acc, finding) => {
    const category = finding.category;
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(finding);
    return acc;
  }, {} as Record<string, SecurityFinding[]>);

  const toggleFinding = (findingId: string) => {
    const newExpanded = new Set(expandedFindings);
    if (newExpanded.has(findingId)) {
      newExpanded.delete(findingId);
    } else {
      newExpanded.add(findingId);
    }
    setExpandedFindings(newExpanded);
  };

  const hasNoFindings = findings.length === 0;

  return (
    <div className="space-y-6">
      {/* Summary Header */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${
              hasNoFindings
                ? 'bg-green-100 dark:bg-green-900/30'
                : (scan.criticalCount || 0) > 0
                  ? 'bg-red-100 dark:bg-red-900/30'
                  : 'bg-yellow-100 dark:bg-yellow-900/30'
            }`}>
              <Shield className={`w-6 h-6 ${
                hasNoFindings
                  ? 'text-green-600 dark:text-green-400'
                  : (scan.criticalCount || 0) > 0
                    ? 'text-red-600 dark:text-red-400'
                    : 'text-yellow-600 dark:text-yellow-400'
              }`} />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                {hasNoFindings ? 'No Issues Found' : `${scan.totalFindings} Issues Found`}
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {scan.filesScanned} files scanned
              </p>
            </div>
          </div>

          {/* Severity Badges */}
          <div className="flex items-center gap-2 flex-wrap">
            <SeverityBadge label="Critical" count={scan.criticalCount || 0} color="red" />
            <SeverityBadge label="High" count={scan.highCount || 0} color="orange" />
            <SeverityBadge label="Medium" count={scan.mediumCount || 0} color="yellow" />
            <SeverityBadge label="Low" count={scan.lowCount || 0} color="blue" />
          </div>
        </div>
      </div>

      {/* Filters */}
      {!hasNoFindings && (
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-500" />
            <span className="text-sm text-gray-600 dark:text-gray-400">Filter:</span>
          </div>

          {/* Severity Filter */}
          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value as FindingSeverity | 'ALL')}
            className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg
                     bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
          >
            <option value="ALL">All Severities</option>
            <option value="CRITICAL">Critical</option>
            <option value="HIGH">High</option>
            <option value="MEDIUM">Medium</option>
            <option value="LOW">Low</option>
            <option value="INFO">Info</option>
          </select>

          {/* Category Filter */}
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value as FindingCategory | 'ALL')}
            className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg
                     bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
          >
            <option value="ALL">All Categories</option>
            <option value="SECRET">Secrets</option>
            <option value="BACKDOOR">Backdoors</option>
            <option value="INJECTION">Injection</option>
            <option value="VULNERABILITY">Vulnerabilities</option>
            <option value="OBFUSCATION">Obfuscation</option>
            <option value="DEPENDENCY">Dependencies</option>
            <option value="SECURITY_FLAW">Security Flaws</option>
            <option value="DATA_EXFILTRATION">Data Exfiltration</option>
            <option value="CRYPTO_MINER">Crypto Miners</option>
          </select>

          <span className="text-sm text-gray-500 dark:text-gray-400">
            Showing {filteredFindings.length} of {findings.length} findings
          </span>
        </div>
      )}

      {/* No Findings Message */}
      {hasNoFindings && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-8 text-center">
          <Shield className="w-12 h-12 text-green-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-green-800 dark:text-green-200 mb-2">
            Your code looks secure!
          </h3>
          <p className="text-green-600 dark:text-green-400">
            No security issues were detected in this scan.
          </p>
        </div>
      )}

      {/* Findings List */}
      {!hasNoFindings && (
        <div className="space-y-4">
          {Object.entries(groupedFindings).map(([category, categoryFindings]) => (
            <div key={category} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
              {/* Category Header */}
              <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{getCategoryIcon(category as FindingCategory)}</span>
                  <h4 className="font-medium text-gray-900 dark:text-gray-100">
                    {category.replace(/_/g, ' ')}
                  </h4>
                  <span className="px-2 py-0.5 text-xs bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded-full">
                    {categoryFindings.length}
                  </span>
                </div>
              </div>

              {/* Findings */}
              <div className="divide-y divide-gray-200 dark:divide-gray-700">
                {categoryFindings.map((finding) => (
                  <FindingItem
                    key={finding.id}
                    finding={finding}
                    isExpanded={expandedFindings.has(finding.id)}
                    onToggle={() => toggleFinding(finding.id)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Severity Badge Component
function SeverityBadge({
  label,
  count,
  color,
}: {
  label: string;
  count: number;
  color: 'red' | 'orange' | 'yellow' | 'blue';
}) {
  if (count === 0) return null;

  const colorClasses = {
    red: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    orange: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
    yellow: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
    blue: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  };

  return (
    <span className={`px-2 py-1 text-xs font-medium rounded ${colorClasses[color]}`}>
      {count} {label}
    </span>
  );
}

// Finding Item Component
function FindingItem({
  finding,
  isExpanded,
  onToggle,
}: {
  finding: SecurityFinding;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="p-4">
      {/* Header */}
      <button
        onClick={onToggle}
        className="w-full flex items-start gap-3 text-left"
      >
        <span className="mt-0.5">
          {isExpanded ? (
            <ChevronDown className="w-4 h-4 text-gray-500" />
          ) : (
            <ChevronRight className="w-4 h-4 text-gray-500" />
          )}
        </span>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`px-2 py-0.5 text-xs font-medium rounded ${getSeverityColor(finding.severity)}`}>
              {finding.severity}
            </span>
            <span className="font-medium text-gray-900 dark:text-gray-100">
              {finding.title}
            </span>
          </div>

          <div className="mt-1 flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
            <FileCode className="w-3.5 h-3.5" />
            <span className="truncate">{finding.filePath}</span>
            {finding.lineNumber && (
              <span>: line {finding.lineNumber}</span>
            )}
          </div>
        </div>
      </button>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="mt-4 ml-7 space-y-4">
          {/* Description */}
          <div>
            <h5 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Description
            </h5>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {finding.description}
            </p>
          </div>

          {/* Code Snippet */}
          {finding.codeSnippet && (
            <div>
              <h5 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Code
              </h5>
              <pre className="p-3 bg-gray-100 dark:bg-gray-900 rounded text-sm overflow-x-auto">
                <code className="text-gray-800 dark:text-gray-200">
                  {finding.codeSnippet}
                </code>
              </pre>
            </div>
          )}

          {/* Recommendation */}
          {finding.recommendation && (
            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <h5 className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-1">
                Recommendation
              </h5>
              <p className="text-sm text-blue-700 dark:text-blue-300">
                {finding.recommendation}
              </p>
            </div>
          )}

          {/* Metadata */}
          <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
            <span>Pattern: {finding.pattern}</span>
            <span>Confidence: {finding.confidence}</span>
          </div>
        </div>
      )}
    </div>
  );
}
