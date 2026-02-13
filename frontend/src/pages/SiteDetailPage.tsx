import { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Play, Edit, AlertTriangle, CheckCircle2, HelpCircle } from 'lucide-react';
import {
  Card,
  CardContent,
  Button,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from '@/components/ui';
import { useSite, useDeleteSite, useUpdateSite, useTriggerSiteScan, SiteScanResponse } from '@/features/sites';
import { useSiteChecks } from '@/features/checks';
import { SiteStatusBadge } from '@/features/sites/components/SiteStatusBadge';
import { HealthScoreDisplay } from '@/features/sites/components/HealthScoreDisplay';
import { SiteFormModal } from '@/features/sites/components/SiteFormModal';
import { SiteOverviewTab } from '@/features/sites/components/SiteOverviewTab';
import { SiteChecksTab } from '@/features/sites/components/SiteChecksTab';
import { SiteResultsTab } from '@/features/sites/components/SiteResultsTab';
import { SiteSettingsTab } from '@/features/sites/components/SiteSettingsTab';
import { getPublicConfig } from '@/lib/api/publicConfig';

/**
 * Site detail page with tabbed interface
 */
export const SiteDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: site, isLoading, error } = useSite(id!);
  const { data: checks } = useSiteChecks(id!);
  const deleteSite = useDeleteSite();
  const updateSite = useUpdateSite();
  const triggerScan = useTriggerSiteScan();

  const [showEditModal, setShowEditModal] = useState(false);
  const [scanFeedback, setScanFeedback] = useState<SiteScanResponse | null>(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [filterCheckId, setFilterCheckId] = useState<string | null>(null);

  // Get failed checks (CRITICAL or ERROR status)
  const failedChecks = useMemo(() => {
    if (!checks) return [];
    return checks.filter(
      (check) =>
        check.latestResult?.status === 'CRITICAL' ||
        check.latestResult?.status === 'ERROR'
    );
  }, [checks]);

  // Monitor types excluded from health score calculation
  // These are informational monitors that shouldn't affect the overall health
  const EXCLUDED_FROM_HEALTH_SCORE = getPublicConfig().healthScore.excludedCheckTypes;

  // Calculate health score breakdown for tooltip
  // Must match backend logic: only enabled checks with results, excluding informational types
  const healthScoreBreakdown = useMemo(() => {
    if (!checks || checks.length === 0) return null;

    // Filter to only enabled checks with results, excluding informational types
    const scoringChecks = checks.filter(
      c => c.enabled && c.latestResult && !EXCLUDED_FROM_HEALTH_SCORE.includes(c.type)
    );
    if (scoringChecks.length === 0) return null;

    const items = scoringChecks.map(check => ({
      name: check.name,
      score: check.latestResult?.score ?? 0,
      weight: check.weight,
      weighted: (check.latestResult?.score ?? 0) * check.weight,
    }));

    const totalWeight = items.reduce((sum, item) => sum + item.weight, 0);
    const totalWeighted = items.reduce((sum, item) => sum + item.weighted, 0);
    const calculatedScore = totalWeight > 0 ? Math.round(totalWeighted / totalWeight) : 0;

    return { items, totalWeight, totalWeighted, calculatedScore };
  }, [checks]);

  // Navigate to results tab with filter for a specific check
  const handleFailedCheckClick = (checkId: string) => {
    setFilterCheckId(checkId);
    setActiveTab('results');
  };

  // Clear the filter
  const handleClearFilter = () => {
    setFilterCheckId(null);
  };

  const handleDelete = async () => {
    if (!id) return;

    try {
      await deleteSite.mutateAsync(id);
      navigate('/sites');
    } catch (error) {
      console.error('Failed to delete site:', error);
    }
  };

  const handleToggleStatus = async () => {
    if (!id || !site) return;

    const newStatus = site.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    try {
      await updateSite.mutateAsync({ siteId: id, data: { status: newStatus } });
    } catch (error) {
      console.error('Failed to toggle site status:', error);
    }
  };

  const handleTriggerScan = async () => {
    if (!id) return;

    try {
      const result = await triggerScan.mutateAsync(id);
      setScanFeedback(result);
      // Auto-hide feedback after 10 seconds
      setTimeout(() => setScanFeedback(null), 10000);
    } catch (error) {
      console.error('Failed to trigger scan:', error);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading site details...</p>
        </div>
      </div>
    );
  }

  if (error || !site) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" onClick={() => navigate('/sites')}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Sites
        </Button>
        <Card>
          <div className="p-6 text-center">
            <p className="text-red-600 dark:text-red-400">
              Failed to load site details. Please try again.
            </p>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Button variant="ghost" onClick={() => navigate('/sites')} className="mb-4">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Sites
        </Button>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                    {site.name}
                  </h1>
                  <SiteStatusBadge status={site.status} />
                </div>
                <a
                  href={site.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-brand-600 dark:text-brand-400 hover:underline"
                >
                  {site.url}
                </a>
                {site.description && (
                  <p className="mt-2 text-gray-600 dark:text-gray-400">{site.description}</p>
                )}
                {site.tags && site.tags.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-3">
                    {site.tags.map((tag) => (
                      <span
                        key={tag}
                        className="px-2 py-1 text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex flex-col items-end gap-2">
                <div className="text-right">
                  <div className="flex items-center justify-end gap-1 mb-1">
                    <p className="text-sm text-gray-600 dark:text-gray-400">Health Score</p>
                    <div className="relative group">
                      <HelpCircle className="w-4 h-4 text-gray-400 dark:text-gray-500 cursor-help" />
                      <div className="absolute right-0 top-6 w-96 p-3 bg-gray-900 dark:bg-gray-700 text-white text-xs text-left rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
                        <p className="font-semibold mb-2">How Health Score is Calculated</p>
                        <p className="mb-2 text-gray-300">Weighted average of all monitor scores:</p>

                        {/* Formula */}
                        <div className="bg-gray-800 dark:bg-gray-600 rounded p-2 mb-3 font-mono text-center text-[11px]">
                          Σ(score × weight) / Σ(weight)
                        </div>

                        {/* Current monitors breakdown */}
                        {healthScoreBreakdown && healthScoreBreakdown.items.length > 0 && (
                          <div className="mb-3">
                            <p className="text-[10px] text-gray-400 mb-1">Your monitors (latest scores):</p>
                            <div className="bg-gray-800 dark:bg-gray-600 rounded p-2">
                              <div className="space-y-1">
                                {healthScoreBreakdown.items.map((item, i) => (
                                  <div key={i} className="flex justify-between items-center">
                                    <span className="truncate max-w-[140px]" title={item.name}>{item.name}</span>
                                    <span className="font-mono text-[10px] text-gray-300">
                                      {item.score} × {item.weight} = {item.weighted}
                                    </span>
                                  </div>
                                ))}
                              </div>
                              {/* Final calculation */}
                              <div className="border-t border-gray-700 dark:border-gray-500 mt-2 pt-2">
                                <div className="flex justify-between items-center font-mono text-[10px]">
                                  <span className="text-gray-400">Total:</span>
                                  <span className="text-white">
                                    {healthScoreBreakdown.totalWeighted} / {healthScoreBreakdown.totalWeight} = <strong>{healthScoreBreakdown.calculatedScore}</strong>
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}

                        <div className="border-t border-gray-700 dark:border-gray-500 pt-2">
                          <p className="text-gray-400 mb-1">Status by score range:</p>
                          <div className="grid grid-cols-2 gap-1">
                            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500"></span> Passed: 80-100</span>
                            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-yellow-500"></span> Warning: 50-79</span>
                            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500"></span> Critical: 1-49</span>
                            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-gray-500"></span> Error: 0</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  <HealthScoreDisplay score={site.healthScore} size="lg" showLabel />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleTriggerScan}
                    disabled={triggerScan.isPending || site.status === 'INACTIVE'}
                    title={site.status === 'INACTIVE' ? 'Cannot scan inactive site. Activate the site first.' : 'Run all enabled monitors'}
                    className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 rounded-lg shadow-md hover:shadow-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {triggerScan.isPending ? (
                      <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                    ) : (
                      <Play className="w-4 h-4" />
                    )}
                    Run Scan
                  </button>
                  <Button size="sm" variant="outline" onClick={() => setShowEditModal(true)}>
                    <Edit className="w-4 h-4 mr-2" />
                    Edit
                  </Button>
                </div>
                {/* Scan feedback message */}
                {scanFeedback && (
                  <div className={`mt-2 p-3 rounded-lg text-sm max-w-md ${
                    scanFeedback.skippedAgentChecks > 0
                      ? 'bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800'
                      : 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
                  }`}>
                    <div className="flex items-start gap-2">
                      {scanFeedback.skippedAgentChecks > 0 ? (
                        <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
                      ) : (
                        <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
                      )}
                      <div>
                        <p className={scanFeedback.skippedAgentChecks > 0
                          ? 'text-amber-800 dark:text-amber-200'
                          : 'text-green-800 dark:text-green-200'
                        }>
                          <strong>{scanFeedback.checksQueued}</strong> monitor{scanFeedback.checksQueued !== 1 ? 's' : ''} queued
                          {scanFeedback.externalChecks > 0 && ` (${scanFeedback.externalChecks} external`}
                          {scanFeedback.agentChecks > 0 && `${scanFeedback.externalChecks > 0 ? ', ' : ' ('}${scanFeedback.agentChecks} agent`}
                          {(scanFeedback.externalChecks > 0 || scanFeedback.agentChecks > 0) && ')'}
                        </p>
                        {scanFeedback.skippedAgentChecks > 0 && (
                          <p className="text-amber-700 dark:text-amber-300 text-xs mt-1">
                            {scanFeedback.skippedAgentChecks} agent monitor{scanFeedback.skippedAgentChecks !== 1 ? 's' : ''} skipped (agent offline)
                          </p>
                        )}
                      </div>
                      <button
                        onClick={() => setScanFeedback(null)}
                        className="ml-auto text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                      >
                        ×
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4 mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Total Monitors</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">
                  {site.stats?.totalChecks || 0}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Active</p>
                <p className="text-2xl font-bold text-green-600 dark:text-green-400 mt-1">
                  {site.stats?.activeChecks || 0}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Failed</p>
                {failedChecks.length > 0 ? (
                  <div className="mt-1">
                    <p className="text-2xl font-bold text-red-600 dark:text-red-400 mb-2">
                      {failedChecks.length}
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {failedChecks.map((check) => (
                        <button
                          key={check.id}
                          onClick={() => handleFailedCheckClick(check.id)}
                          className="inline-flex items-center gap-1.5 text-xs px-2 py-1 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 rounded hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors"
                          title={`${check.name} - Click to view results`}
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-red-500 flex-shrink-0"></span>
                          <span className="truncate max-w-[120px]">{check.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="text-2xl font-bold text-green-600 dark:text-green-400 mt-1">
                    0
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onChange={setActiveTab}>
        <Card padding="none">
          <div className="px-6 pt-4">
            <TabsList>
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="checks">Monitors</TabsTrigger>
              <TabsTrigger value="results">Results</TabsTrigger>
              <TabsTrigger value="settings">Settings</TabsTrigger>
            </TabsList>
          </div>

          <div className="px-6 pb-6">
            <TabsContent value="overview">
              <SiteOverviewTab siteId={site.id} />
            </TabsContent>

            <TabsContent value="checks">
              <SiteChecksTab siteId={site.id} siteStatus={site.status} />
            </TabsContent>

            <TabsContent value="results">
              <SiteResultsTab
                siteId={site.id}
                filterCheckId={filterCheckId || undefined}
                onClearFilter={handleClearFilter}
              />
            </TabsContent>

            <TabsContent value="settings">
              <SiteSettingsTab
                site={site}
                onEdit={() => setShowEditModal(true)}
                onDelete={handleDelete}
                onToggleStatus={handleToggleStatus}
                isTogglingStatus={updateSite.isPending}
              />
            </TabsContent>
          </div>
        </Card>
      </Tabs>

      {/* Edit modal */}
      <SiteFormModal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        site={site}
      />

    </div>
  );
};
