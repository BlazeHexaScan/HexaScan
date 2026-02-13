/**
 * Repository Scanner Page
 * Main page for managing repositories and security scans
 */

import { useState, useEffect } from 'react';
import { Plus, Shield, Scan, ArrowLeft, FileCode, Clock, AlertTriangle, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui';
import {
  AddRepoModal,
  RepositoryCard,
  ScanProgressView,
  ScanResultsView,
} from '@/features/repo-scanner';
import {
  useRepositories,
  useStartScan,
  useDeleteRepository,
  useScanDetails,
  useRepositoryScans,
  repoScannerKeys,
  fetchScanProgress,
} from '@/features/repo-scanner';
import { useQueryClient } from '@tanstack/react-query';
import type { SecurityScan } from '@/types/repo-scanner';

type PageView = 'list' | 'scanning' | 'results' | 'history';

export function RepoScannerPage() {
  const [showAddModal, setShowAddModal] = useState(false);
  const [currentView, setCurrentView] = useState<PageView>('list');
  const [activeScanId, setActiveScanId] = useState<string | null>(null);
  const [selectedRepoId, setSelectedRepoId] = useState<string | null>(null);
  // Track repos with active scans: repoId -> scanId
  const [scanningRepos, setScanningRepos] = useState<Map<string, string>>(new Map());

  const queryClient = useQueryClient();
  const { data: reposData, isLoading } = useRepositories();
  const startScanMutation = useStartScan();
  const deleteMutation = useDeleteRepository();

  // Poll scan progress for all tracked active scans
  useEffect(() => {
    if (scanningRepos.size === 0) return;

    const interval = setInterval(async () => {
      const updates = new Map(scanningRepos);
      let changed = false;

      for (const [repoId, scanId] of scanningRepos) {
        try {
          const progress = await fetchScanProgress(scanId);
          if (progress.status === 'COMPLETED' || progress.status === 'FAILED') {
            updates.delete(repoId);
            changed = true;
          }
        } catch {
          updates.delete(repoId);
          changed = true;
        }
      }

      if (changed) {
        setScanningRepos(updates);
        queryClient.invalidateQueries({ queryKey: repoScannerKeys.repositories() });
        // Also invalidate scan history for completed repos
        for (const [repoId] of scanningRepos) {
          if (!updates.has(repoId)) {
            queryClient.invalidateQueries({ queryKey: repoScannerKeys.scans(repoId) });
          }
        }
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [scanningRepos, queryClient]);

  const { data: scanDetails } = useScanDetails(
    currentView === 'results' ? activeScanId : null
  );

  // Fetch scan history for the selected repository
  const { data: scansData, isLoading: isLoadingScans, isError: isScansError } = useRepositoryScans(
    currentView === 'history' && selectedRepoId ? selectedRepoId : ''
  );

  const repositories = reposData?.repositories || [];
  const scans = scansData?.scans || [];
  const selectedRepo = repositories.find(r => r.id === selectedRepoId);

  const handleStartScan = async (repositoryId: string) => {
    // If this repo already has an active scan, navigate to it instead of starting a new one
    const existingScanId = scanningRepos.get(repositoryId);
    if (existingScanId) {
      setActiveScanId(existingScanId);
      setSelectedRepoId(repositoryId);
      setCurrentView('scanning');
      return;
    }

    try {
      const result = await startScanMutation.mutateAsync(repositoryId);
      // Track this repo as having an active scan
      setScanningRepos(prev => new Map(prev).set(repositoryId, result.scan.id));
      setActiveScanId(result.scan.id);
      setSelectedRepoId(repositoryId);
      setCurrentView('scanning');
    } catch (error) {
      console.error('Failed to start scan:', error);
    }
  };

  const handleScanComplete = () => {
    // Remove from scanning tracking
    if (selectedRepoId) {
      setScanningRepos(prev => {
        const next = new Map(prev);
        next.delete(selectedRepoId);
        return next;
      });
      // Invalidate scan history for this repo so it's fresh when visited
      queryClient.invalidateQueries({ queryKey: repoScannerKeys.scans(selectedRepoId) });
    }
    // Transition to results view
    setCurrentView('results');
    // Invalidate repositories to update lastScannedAt
    queryClient.invalidateQueries({ queryKey: repoScannerKeys.repositories() });
  };

  const handleBackToList = () => {
    setCurrentView('list');
    setActiveScanId(null);
    setSelectedRepoId(null);
  };

  const handleViewScans = (repositoryId: string) => {
    setSelectedRepoId(repositoryId);
    setCurrentView('history');
  };

  const handleViewScanResults = (scanId: string) => {
    setActiveScanId(scanId);
    setCurrentView('results');
  };

  const handleDelete = async (repositoryId: string) => {
    try {
      await deleteMutation.mutateAsync(repositoryId);
    } catch (error) {
      console.error('Failed to delete repository:', error);
    }
  };

  // Render based on current view
  if (currentView === 'scanning' && activeScanId) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <button
          onClick={handleBackToList}
          className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Repositories
        </button>

        <ScanProgressView
          scanId={activeScanId}
          onComplete={handleScanComplete}
        />

        {/* View Results Button when done */}
        <div className="mt-4 text-center">
          <Button variant="secondary" onClick={handleBackToList}>
            Scan Another Repository
          </Button>
        </div>
      </div>
    );
  }

  if (currentView === 'results' && activeScanId && scanDetails) {
    return (
      <div className="p-6 max-w-6xl mx-auto">
        <button
          onClick={handleBackToList}
          className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Repositories
        </button>

        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-6">
          Scan Results
        </h1>

        <ScanResultsView scan={scanDetails} />

        <div className="mt-6 flex justify-center gap-4">
          <Button variant="secondary" onClick={handleBackToList}>
            Back to Repositories
          </Button>
        </div>
      </div>
    );
  }

  // History View
  if (currentView === 'history' && selectedRepoId) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <button
          onClick={handleBackToList}
          className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Repositories
        </button>

        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            Scan History
          </h1>
          {selectedRepo && (
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              {selectedRepo.name}
            </p>
          )}
        </div>

        {isLoadingScans && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 text-brand-600 animate-spin" />
          </div>
        )}

        {!isLoadingScans && isScansError && (
          <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg border border-red-200 dark:border-red-700">
            <XCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
              Failed to Load Scan History
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Something went wrong while fetching scan history.
            </p>
            <Button variant="secondary" onClick={() => queryClient.invalidateQueries({ queryKey: repoScannerKeys.scans(selectedRepoId) })}>
              Try Again
            </Button>
          </div>
        )}

        {!isLoadingScans && !isScansError && scans.length === 0 && (
          <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
            <Clock className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
              No Scans Yet
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Start a scan to see the security report for this repository.
            </p>
            <Button onClick={() => handleStartScan(selectedRepoId)}>
              <Scan className="w-4 h-4 mr-2" />
              Start First Scan
            </Button>
          </div>
        )}

        {!isLoadingScans && !isScansError && scans.length > 0 && (
          <div className="space-y-3">
            {scans.map((scan: SecurityScan) => (
              <ScanHistoryItem
                key={scan.id}
                scan={scan}
                onView={() => handleViewScanResults(scan.id)}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  // Default: Repository List View
  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <Shield className="w-7 h-7 text-brand-600" />
            Repo Scanner
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Scan public and private repositories for security vulnerabilities
          </p>
        </div>

        <Button onClick={() => setShowAddModal(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Add Repository
        </Button>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600" />
        </div>
      )}

      {/* Empty State */}
      {!isLoading && repositories.length === 0 && (
        <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
          <FileCode className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
            No Repositories Yet
          </h3>
          <p className="text-gray-600 dark:text-gray-400 mb-4 max-w-md mx-auto">
            Add a Git repository to scan for security vulnerabilities,
            hardcoded secrets, and potential backdoors. Both public and private repos are supported.
          </p>
          <Button onClick={() => setShowAddModal(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Add Your First Repository
          </Button>
        </div>
      )}

      {/* What We Scan For - Always visible at top */}
      {!isLoading && (
        <div className="mb-6 p-6 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
            What We Scan For
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-gray-700 dark:text-gray-300">
            <div className="flex items-center gap-3">
              <span className="text-2xl">🔑</span>
              <span className="font-medium">Hardcoded Secrets</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-2xl">🚪</span>
              <span className="font-medium">Backdoors</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-2xl">💉</span>
              <span className="font-medium">Injection Vulnerabilities</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-2xl">📦</span>
              <span className="font-medium">Dependency Issues</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-2xl">🎭</span>
              <span className="font-medium">Obfuscated Code</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-2xl">⛏️</span>
              <span className="font-medium">Crypto Miners</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-2xl">📤</span>
              <span className="font-medium">Data Exfiltration</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-2xl">⚠️</span>
              <span className="font-medium">Security Flaws</span>
            </div>
          </div>
        </div>
      )}

      {/* Repository Grid */}
      {!isLoading && repositories.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {repositories.map((repo) => (
            <RepositoryCard
              key={repo.id}
              repository={repo}
              onScan={handleStartScan}
              onDelete={handleDelete}
              onViewScans={handleViewScans}
              isScanning={scanningRepos.has(repo.id) || (startScanMutation.isPending && selectedRepoId === repo.id)}
            />
          ))}
        </div>
      )}

      {/* Add Repository Modal */}
      <AddRepoModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSuccess={(_repoId) => {
          // Optionally auto-start scan
        }}
      />
    </div>
  );
}

// Scan History Item Component
function ScanHistoryItem({
  scan,
  onView,
}: {
  scan: SecurityScan;
  onView: () => void;
}) {
  const getStatusIcon = () => {
    switch (scan.status) {
      case 'COMPLETED':
        if ((scan.criticalCount || 0) > 0 || (scan.highCount || 0) > 0) {
          return <AlertTriangle className="w-5 h-5 text-amber-500" />;
        }
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'FAILED':
        return <XCircle className="w-5 h-5 text-red-500" />;
      case 'PENDING':
      case 'CLONING':
      case 'SCANNING':
      case 'ANALYZING':
        return <Loader2 className="w-5 h-5 text-brand-500 animate-spin" />;
      default:
        return <Clock className="w-5 h-5 text-gray-400" />;
    }
  };

  const getStatusText = () => {
    switch (scan.status) {
      case 'COMPLETED':
        const total = scan.totalFindings || 0;
        if (total === 0) return 'No issues found';
        return `${total} issue${total !== 1 ? 's' : ''} found`;
      case 'FAILED':
        return scan.errorMessage || 'Scan failed';
      case 'PENDING':
        return 'Pending...';
      case 'CLONING':
        return 'Cloning repository...';
      case 'SCANNING':
        return 'Scanning files...';
      case 'ANALYZING':
        return 'Analyzing results...';
      default:
        return scan.status;
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div
      onClick={scan.status === 'COMPLETED' ? onView : undefined}
      className={`bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 ${
        scan.status === 'COMPLETED' ? 'cursor-pointer hover:border-brand-500 transition-colors' : ''
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {getStatusIcon()}
          <div>
            <p className="font-medium text-gray-900 dark:text-gray-100">
              {formatDate(scan.createdAt)}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {getStatusText()}
            </p>
          </div>
        </div>

        {scan.status === 'COMPLETED' && (
          <div className="flex items-center gap-4">
            {/* Severity counts */}
            <div className="flex items-center gap-3 text-sm">
              {(scan.criticalCount || 0) > 0 && (
                <span className="px-2 py-1 rounded bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400">
                  {scan.criticalCount} Critical
                </span>
              )}
              {(scan.highCount || 0) > 0 && (
                <span className="px-2 py-1 rounded bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400">
                  {scan.highCount} High
                </span>
              )}
              {(scan.mediumCount || 0) > 0 && (
                <span className="px-2 py-1 rounded bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400">
                  {scan.mediumCount} Medium
                </span>
              )}
            </div>

            <Button variant="secondary" size="sm" onClick={onView}>
              View Report
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
