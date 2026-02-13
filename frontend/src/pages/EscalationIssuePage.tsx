import { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { AlertTriangle, Clock, CheckCircle, AlertCircle, ExternalLink, User, FileText, Send } from 'lucide-react';
import { Card, Button, Input, Badge } from '@/components/ui';
import {
  usePublicEscalationIssue,
  useRecordIssueViewed,
  useUpdateIssueStatus,
  useAddReport,
  EscalationIssueStatus,
  EscalationEventType,
} from '@/features/escalations';
import { getErrorMessage } from '@/lib/api/client';

/**
 * Format time remaining as human readable string
 */
function formatTimeRemaining(ms: number): string {
  if (ms <= 0) return 'Expired';

  const hours = Math.floor(ms / (1000 * 60 * 60));
  const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((ms % (1000 * 60)) / 1000);

  if (hours > 0) {
    return `${hours}h ${minutes}m remaining`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds}s remaining`;
  }
  return `${seconds}s remaining`;
}

/**
 * Get status badge variant
 */
function getStatusBadgeVariant(status: EscalationIssueStatus): 'success' | 'warning' | 'danger' | 'info' | 'critical' {
  switch (status) {
    case 'RESOLVED':
      return 'success';
    case 'ACKNOWLEDGED':
    case 'IN_PROGRESS':
      return 'warning';
    case 'EXHAUSTED':
      return 'critical';
    case 'OPEN':
    default:
      return 'danger';
  }
}

/**
 * Get status label
 */
function getStatusLabel(status: EscalationIssueStatus): string {
  switch (status) {
    case 'OPEN':
      return 'Open';
    case 'ACKNOWLEDGED':
      return 'Acknowledged';
    case 'IN_PROGRESS':
      return 'In Progress';
    case 'RESOLVED':
      return 'Resolved';
    case 'EXHAUSTED':
      return 'Ticket Exhausted';
    default:
      return status;
  }
}

/**
 * Get event type icon
 */
function getEventIcon(eventType: EscalationEventType) {
  switch (eventType) {
    case 'CREATED':
      return <AlertTriangle className="w-4 h-4 text-red-500" />;
    case 'VIEWED':
      return <User className="w-4 h-4 text-gray-500" />;
    case 'ACKNOWLEDGED':
      return <CheckCircle className="w-4 h-4 text-blue-500" />;
    case 'IN_PROGRESS':
      return <Clock className="w-4 h-4 text-yellow-500" />;
    case 'RESOLVED':
      return <CheckCircle className="w-4 h-4 text-green-500" />;
    case 'ESCALATED':
      return <AlertCircle className="w-4 h-4 text-orange-500" />;
    case 'EXHAUSTED':
      return <AlertCircle className="w-4 h-4 text-red-500" />;
    case 'REPORT_ADDED':
      return <FileText className="w-4 h-4 text-purple-500" />;
    default:
      return <Clock className="w-4 h-4 text-gray-500" />;
  }
}

/**
 * Get event type label
 */
function getEventLabel(eventType: EscalationEventType): string {
  switch (eventType) {
    case 'CREATED':
      return 'Ticket Created';
    case 'VIEWED':
      return 'Viewed';
    case 'ACKNOWLEDGED':
      return 'Acknowledged';
    case 'IN_PROGRESS':
      return 'Marked In Progress';
    case 'RESOLVED':
      return 'Resolved';
    case 'ESCALATED':
      return 'Escalated';
    case 'EXHAUSTED':
      return 'Ticket Exhausted';
    case 'REPORT_ADDED':
      return 'Report Added';
    default:
      return eventType;
  }
}

/**
 * Public Ticket Page
 * Accessible via token - allows viewing and updating ticket status
 */
export const EscalationIssuePage = () => {
  const { token } = useParams<{ token: string }>();
  const [searchParams] = useSearchParams();
  const levelParam = searchParams.get('l');
  const signature = searchParams.get('s') || undefined; // HMAC signature for secure level verification
  const viewerLevel = levelParam ? parseInt(levelParam, 10) : undefined;
  const { data: issue, isLoading, error, refetch } = usePublicEscalationIssue(token, viewerLevel, signature);
  const recordViewed = useRecordIssueViewed();
  const updateStatus = useUpdateIssueStatus(token || '');
  const addReportMutation = useAddReport(token || '', viewerLevel, signature);

  const [userName, setUserName] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [message, setMessage] = useState('');
  const [reportMessage, setReportMessage] = useState('');
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [reportError, setReportError] = useState<string | null>(null);
  const [hasRecordedView, setHasRecordedView] = useState(false);

  // Calculate time remaining (updates every second)
  const [timeRemaining, setTimeRemaining] = useState(0);

  // Set email and name based on level parameter from URL
  useEffect(() => {
    if (issue && !userEmail) {
      const level = levelParam ? parseInt(levelParam, 10) : issue.currentLevel;
      const levelEmail = level === 1 ? issue.level1Email
        : level === 2 ? issue.level2Email
        : level === 3 ? issue.level3Email
        : null;
      const levelName = level === 1 ? issue.level1Name
        : level === 2 ? issue.level2Name
        : level === 3 ? issue.level3Name
        : null;
      if (levelEmail) {
        setUserEmail(levelEmail);
      }
      if (levelName) {
        setUserName(levelName);
      }
    }
  }, [issue, userEmail, levelParam]);

  useEffect(() => {
    if (issue) {
      setTimeRemaining(issue.timeRemaining);

      // Update countdown every second
      const interval = setInterval(() => {
        setTimeRemaining((prev) => Math.max(0, prev - 1000));
      }, 1000);

      return () => clearInterval(interval);
    }
  }, [issue]);

  // Record view when page loads and user email is known
  useEffect(() => {
    if (token && userEmail && !hasRecordedView) {
      recordViewed.mutate({ token, userEmail });
      setHasRecordedView(true);
    }
  }, [token, userEmail, hasRecordedView, recordViewed]);

  const handleStatusUpdate = async (newStatus: 'ACKNOWLEDGED' | 'IN_PROGRESS' | 'RESOLVED') => {
    if (!userEmail) {
      setSubmitError('Please enter your email address');
      return;
    }

    setSubmitError(null);

    try {
      await updateStatus.mutateAsync({
        status: newStatus,
        userName: userName || userEmail.split('@')[0], // Fallback to email prefix if no name
        userEmail,
        message: message || undefined,
      });
      setMessage('');
      refetch();
    } catch (err) {
      setSubmitError(getErrorMessage(err));
    }
  };

  const handleAddReport = async () => {
    if (!userEmail) {
      setReportError('Please enter your email address');
      return;
    }

    if (!reportMessage.trim()) {
      setReportError('Please enter a report message');
      return;
    }

    setReportError(null);

    try {
      await addReportMutation.mutateAsync({
        userName: userName || userEmail.split('@')[0], // Fallback to email prefix if no name
        userEmail,
        message: reportMessage.trim(),
      });
      setReportMessage('');
      refetch();
    } catch (err) {
      setReportError(getErrorMessage(err));
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error || !issue) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <div className="p-6 text-center">
            <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">
              Issue Not Found
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              This ticket link may be invalid or expired.
              Please check your email for a valid link.
            </p>
          </div>
        </Card>
      </div>
    );
  }

  const isActive = issue.status !== 'RESOLVED' && issue.status !== 'EXHAUSTED';
  const canUpdate = issue.canUpdate && userEmail;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-4 px-4">
      <div className="max-w-4xl mx-auto space-y-3">
        {/* Status Banner */}
        <Card className={`${
          issue.status === 'RESOLVED'
            ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
            : issue.status === 'EXHAUSTED'
            ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
            : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
        }`}>
          <div className="p-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              {issue.status === 'RESOLVED' ? (
                <CheckCircle className="w-6 h-6 text-green-600" />
              ) : (
                <AlertTriangle className="w-6 h-6 text-red-600" />
              )}
              <div>
                <div className="flex items-center gap-2">
                  <Badge variant={getStatusBadgeVariant(issue.status)}>
                    {getStatusLabel(issue.status)}
                  </Badge>
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    Level {issue.currentLevel}/{issue.maxLevel}
                  </span>
                </div>
              </div>
            </div>
            {isActive && (
              <div className="text-right">
                <div className={`text-base font-bold ${timeRemaining < 30 * 60 * 1000 ? 'text-red-600' : 'text-orange-600'}`}>
                  <Clock className="w-4 h-4 inline mr-1" />
                  {formatTimeRemaining(timeRemaining)}
                </div>
              </div>
            )}
          </div>
        </Card>

        {/* Site and Monitor Info */}
        <Card>
          <div className="p-4">
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-2">Ticket Details</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <div>
                <p className="text-gray-500 dark:text-gray-400">Site</p>
                <p className="font-medium text-gray-900 dark:text-gray-100">{issue.siteName}</p>
                <a href={issue.siteUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline inline-flex items-center gap-1">
                  {issue.siteUrl} <ExternalLink className="w-3 h-3" />
                </a>
              </div>
              <div>
                <p className="text-gray-500 dark:text-gray-400">Monitor</p>
                <p className="font-medium text-gray-900 dark:text-gray-100">{issue.checkName}</p>
                <p className="text-xs text-gray-600 dark:text-gray-400">{issue.monitorType}</p>
              </div>
              <div>
                <p className="text-gray-500 dark:text-gray-400">Result</p>
                <Badge variant="critical">{issue.checkResult.status}</Badge>
                <p className="text-xs text-gray-600 dark:text-gray-400">Score: {issue.checkResult.score}/100</p>
              </div>
              <div>
                <p className="text-gray-500 dark:text-gray-400">Created</p>
                <p className="font-medium text-gray-900 dark:text-gray-100">{new Date(issue.createdAt).toLocaleString()}</p>
              </div>
            </div>
            {issue.checkResult.message && (
              <div className="mt-2 p-2 bg-gray-100 dark:bg-gray-800 rounded text-sm text-gray-700 dark:text-gray-300">
                {issue.checkResult.message}
              </div>
            )}
          </div>
        </Card>

        {/* Escalation Notice - when user cannot update due to escalation */}
        {isActive && !issue.canUpdate && viewerLevel && viewerLevel < issue.currentLevel && (
          <Card className="bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800">
            <div className="p-4 flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                  Ticket Escalated to Level {issue.currentLevel}
                </p>
                <p className="text-sm text-amber-700 dark:text-amber-300">
                  This ticket has been escalated and is now assigned to the Level {issue.currentLevel} contact.
                  Only they can update its status.
                </p>
              </div>
            </div>
          </Card>
        )}

        {/* Update Status */}
        {issue.canUpdate && (
          <Card>
            <div className="p-4">
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2 text-sm">
                  <User className="w-4 h-4 text-gray-400" />
                  <span className="text-gray-500">Acting as:</span>
                  <span className="font-medium text-gray-900 dark:text-gray-100">
                    {userName ? `${userName} (${userEmail})` : userEmail}
                  </span>
                </div>
                <div className="flex-1" />
                <Input
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Add a note (optional)"
                  className="w-48"
                />
                {issue.status === 'OPEN' && (
                  <Button variant="outline" size="sm" onClick={() => handleStatusUpdate('ACKNOWLEDGED')} isLoading={updateStatus.isPending} disabled={!canUpdate}>
                    Acknowledge
                  </Button>
                )}
                {(issue.status === 'OPEN' || issue.status === 'ACKNOWLEDGED') && (
                  <Button variant="outline" size="sm" onClick={() => handleStatusUpdate('IN_PROGRESS')} isLoading={updateStatus.isPending} disabled={!canUpdate}>
                    In Progress
                  </Button>
                )}
                <Button size="sm" onClick={() => handleStatusUpdate('RESOLVED')} isLoading={updateStatus.isPending} disabled={!canUpdate} className="bg-green-600 hover:bg-green-700">
                  Resolve
                </Button>
              </div>
              {submitError && (
                <div className="mt-2 p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-sm text-red-600 dark:text-red-400">
                  {submitError}
                </div>
              )}
            </div>
          </Card>
        )}

        {/* Report - allow previous levels to add context */}
        {issue.canAddReport && (
          <Card className="border-purple-200 dark:border-purple-800">
            <div className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <FileText className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">Add Report</h2>
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
                Share details about what you've tried or are currently working on to help the next level resolve this issue efficiently.
              </p>
              <div className="flex gap-2">
                <textarea
                  value={reportMessage}
                  onChange={(e) => setReportMessage(e.target.value)}
                  placeholder="Describe what you've investigated, tried, or any relevant findings..."
                  className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm min-h-[80px] resize-y focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  maxLength={2000}
                />
              </div>
              <div className="flex items-center justify-between mt-2">
                <span className="text-xs text-gray-400">{reportMessage.length}/2000 characters</span>
                <Button
                  size="sm"
                  onClick={handleAddReport}
                  isLoading={addReportMutation.isPending}
                  disabled={!reportMessage.trim()}
                  className="bg-purple-600 hover:bg-purple-700"
                >
                  <Send className="w-4 h-4 mr-1" />
                  Submit Report
                </Button>
              </div>
              {reportError && (
                <div className="mt-2 p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-sm text-red-600 dark:text-red-400">
                  {reportError}
                </div>
              )}
            </div>
          </Card>
        )}

        {/* Timeline */}
        <Card>
          <div className="p-4">
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-2">Timeline</h2>
            <div className="space-y-2">
              {issue.events.map((event) => (
                <div
                  key={event.id}
                  className={`flex items-start gap-2 text-sm ${
                    event.eventType === 'REPORT_ADDED'
                      ? 'bg-purple-50 dark:bg-purple-900/20 p-2 rounded-md border-l-2 border-purple-500'
                      : ''
                  }`}
                >
                  {getEventIcon(event.eventType)}
                  <div className="flex-1 flex flex-wrap items-center gap-x-2">
                    <span className={`font-medium ${
                      event.eventType === 'REPORT_ADDED'
                        ? 'text-purple-700 dark:text-purple-300'
                        : 'text-gray-900 dark:text-gray-100'
                    }`}>
                      {getEventLabel(event.eventType)}
                    </span>
                    {event.level && (
                      <Badge variant={event.eventType === 'REPORT_ADDED' ? 'warning' : 'info'}>
                        L{event.level}
                      </Badge>
                    )}
                    {(event.userName || event.userEmail) && (
                      <span className="text-gray-500">
                        by {event.userName ? `${event.userName}` : event.userEmail}
                      </span>
                    )}
                    <span className="text-xs text-gray-400">{new Date(event.createdAt).toLocaleString()}</span>
                    {event.message && (
                      <div className={`w-full mt-1 ${
                        event.eventType === 'REPORT_ADDED'
                          ? 'text-gray-700 dark:text-gray-300 whitespace-pre-wrap'
                          : 'text-gray-600 dark:text-gray-400'
                      }`}>
                        {event.eventType === 'REPORT_ADDED' ? event.message : `"${event.message}"`}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Card>

        {/* Footer */}
        <div className="text-center text-xs text-gray-400">
          Powered by HexaScan
        </div>
      </div>
    </div>
  );
};
