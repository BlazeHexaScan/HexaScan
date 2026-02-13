import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, Clock, CheckCircle, AlertCircle, ExternalLink, Filter, RefreshCw, Ticket, Users, Plus, Pencil, Trash2 } from 'lucide-react';
import { Card, Button, Badge, Select } from '@/components/ui';
import {
  useEscalationIssues,
  EscalationIssueStatus,
  EscalationIssue,
} from '@/features/escalations';
import { useSites } from '@/features/sites';
import { useContacts, useDeleteContact, ContactFormModal } from '@/features/contacts';
import { Contact } from '@/types';
import { formatRelativeTime } from '@/lib/utils/formatters';
import { getErrorMessage } from '@/lib/api/client';

/**
 * Contact ticket stats
 */
interface ContactStats {
  open: number;        // OPEN tickets assigned to contact
  inProgress: number;  // ACKNOWLEDGED or IN_PROGRESS tickets
  resolved: number;    // RESOLVED tickets where contact resolved it
}

/**
 * Compute ticket stats for a contact by matching their email against issues
 */
function getContactStats(email: string, issues: EscalationIssue[]): ContactStats {
  let open = 0;
  let inProgress = 0;
  let resolved = 0;

  for (const issue of issues) {
    const isAssigned = issue.level1Email === email ||
                       issue.level2Email === email ||
                       issue.level3Email === email;

    if (issue.status === 'OPEN' && isAssigned) {
      open++;
    } else if ((issue.status === 'ACKNOWLEDGED' || issue.status === 'IN_PROGRESS') && isAssigned) {
      inProgress++;
    } else if (issue.status === 'RESOLVED' && issue.resolvedByEmail === email) {
      resolved++;
    }
  }

  return { open, inProgress, resolved };
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
      return 'Exhausted';
    default:
      return status;
  }
}

/**
 * Get status icon
 */
function getStatusIcon(status: EscalationIssueStatus) {
  switch (status) {
    case 'RESOLVED':
      return <CheckCircle className="w-5 h-5 text-green-500" />;
    case 'ACKNOWLEDGED':
    case 'IN_PROGRESS':
      return <Clock className="w-5 h-5 text-yellow-500" />;
    case 'EXHAUSTED':
      return <AlertCircle className="w-5 h-5 text-red-500" />;
    case 'OPEN':
    default:
      return <AlertTriangle className="w-5 h-5 text-red-500" />;
  }
}

/**
 * Format time remaining
 */
function formatTimeRemaining(ms: number): string {
  if (ms <= 0) return 'Expired';

  const hours = Math.floor(ms / (1000 * 60 * 60));
  const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

/**
 * Get last activity from events
 */
function getLastActivity(issue: EscalationIssue): { event: string; time: string } | null {
  if (!issue.events || issue.events.length === 0) return null;
  // Events are ordered desc from backend, so first is most recent
  const lastEvent = issue.events[0];
  const eventLabels: Record<string, string> = {
    'CREATED': 'Created',
    'VIEWED': 'Viewed',
    'ACKNOWLEDGED': 'Acknowledged',
    'IN_PROGRESS': 'In Progress',
    'RESOLVED': 'Resolved',
    'ESCALATED': 'Escalated',
    'EXHAUSTED': 'Exhausted',
  };
  return {
    event: eventLabels[lastEvent.eventType] || lastEvent.eventType,
    time: lastEvent.createdAt,
  };
}

/**
 * Get resolved by info
 */
function getResolvedByInfo(issue: EscalationIssue): { name: string | null; email: string; level: number } | null {
  if (issue.status !== 'RESOLVED' || !issue.resolvedByEmail) return null;

  // Determine which level resolved it by matching email
  let level = 0;
  if (issue.resolvedByEmail === issue.level1Email) level = 1;
  else if (issue.resolvedByEmail === issue.level2Email) level = 2;
  else if (issue.resolvedByEmail === issue.level3Email) level = 3;

  return {
    name: issue.resolvedByName,
    email: issue.resolvedByEmail,
    level,
  };
}

/**
 * Tickets table component
 */
const TicketsTable = ({ issues }: { issues: EscalationIssue[] }) => {
  return (
    <Card>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
              <th className="text-left text-sm font-medium text-gray-500 dark:text-gray-400 px-4 py-2">Site / Monitor</th>
              <th className="text-left text-sm font-medium text-gray-500 dark:text-gray-400 px-4 py-2">Status</th>
              <th className="text-left text-sm font-medium text-gray-500 dark:text-gray-400 px-4 py-2">Level</th>
              <th className="text-left text-sm font-medium text-gray-500 dark:text-gray-400 px-4 py-2">Time Left</th>
              <th className="text-left text-sm font-medium text-gray-500 dark:text-gray-400 px-4 py-2">Last Activity</th>
              <th className="text-left text-sm font-medium text-gray-500 dark:text-gray-400 px-4 py-2">Resolved By</th>
              <th className="text-right text-sm font-medium text-gray-500 dark:text-gray-400 px-4 py-2">Action</th>
            </tr>
          </thead>
          <tbody>
            {issues.map((issue) => {
              const isActive = issue.status !== 'RESOLVED' && issue.status !== 'EXHAUSTED';
              const lastActivity = getLastActivity(issue);
              const resolvedBy = getResolvedByInfo(issue);
              const isUrgent = isActive && issue.timeRemaining < 30 * 60 * 1000;

              return (
                <tr
                  key={issue.id}
                  className={`border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/30 ${
                    isUrgent ? 'bg-red-50/50 dark:bg-red-900/10' : ''
                  }`}
                >
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-2">
                      {getStatusIcon(issue.status)}
                      <div>
                        <p className="font-medium text-sm text-gray-900 dark:text-gray-100">{issue.siteName}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{issue.checkName}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-2">
                    <Badge variant={getStatusBadgeVariant(issue.status)}>
                      {getStatusLabel(issue.status)}
                    </Badge>
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-1">
                      {issue.level1Email && (
                        <span
                          className={`text-xs px-1.5 py-0.5 rounded cursor-help ${
                            issue.currentLevel >= 1 ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'
                          }`}
                          title={issue.level1Name ? `${issue.level1Name} (${issue.level1Email})` : issue.level1Email}
                        >
                          L1
                        </span>
                      )}
                      {issue.level2Email && (
                        <span
                          className={`text-xs px-1.5 py-0.5 rounded cursor-help ${
                            issue.currentLevel >= 2 ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'
                          }`}
                          title={issue.level2Name ? `${issue.level2Name} (${issue.level2Email})` : issue.level2Email}
                        >
                          L2
                        </span>
                      )}
                      {issue.level3Email && (
                        <span
                          className={`text-xs px-1.5 py-0.5 rounded cursor-help ${
                            issue.currentLevel >= 3 ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'
                          }`}
                          title={issue.level3Name ? `${issue.level3Name} (${issue.level3Email})` : issue.level3Email}
                        >
                          L3
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-2">
                    {isActive ? (
                      <span className={`text-sm font-medium ${isUrgent ? 'text-red-600' : 'text-orange-600'}`}>
                        {formatTimeRemaining(issue.timeRemaining)}
                      </span>
                    ) : (
                      <span className="text-sm text-gray-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2">
                    {lastActivity ? (
                      <div>
                        <p className="text-sm text-gray-900 dark:text-gray-100">{lastActivity.event}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{formatRelativeTime(lastActivity.time)}</p>
                      </div>
                    ) : (
                      <span className="text-sm text-gray-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2">
                    {resolvedBy ? (
                      <div className="flex items-center gap-1.5">
                        <span className={`text-xs px-1.5 py-0.5 rounded ${
                          resolvedBy.level === 1 ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                          resolvedBy.level === 2 ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' :
                          resolvedBy.level === 3 ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                          'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'
                        }`}>
                          L{resolvedBy.level || '?'}
                        </span>
                        <span
                          className="text-xs text-gray-600 dark:text-gray-300 truncate max-w-[100px] cursor-help"
                          title={resolvedBy.name ? `${resolvedBy.name} (${resolvedBy.email})` : resolvedBy.email}
                        >
                          {resolvedBy.name || resolvedBy.email}
                        </span>
                      </div>
                    ) : (
                      <span className="text-sm text-gray-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <Link
                      to={`/sites/${issue.siteId}`}
                      className="text-sm text-blue-600 hover:underline inline-flex items-center gap-1"
                    >
                      View
                      <ExternalLink className="w-3 h-3" />
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
};

/**
 * Tickets dashboard page
 * Shows all ticket issues for the organization
 */
export const EscalationsPage = () => {
  const [statusFilter, setStatusFilter] = useState<EscalationIssueStatus | ''>('');
  const [siteFilter, setSiteFilter] = useState<string>('');
  const [contactModalOpen, setContactModalOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const { data, isLoading, error, refetch, isFetching } = useEscalationIssues({
    status: statusFilter || undefined,
    siteId: siteFilter || undefined,
    limit: 50,
  });

  const { data: sites } = useSites();
  const { data: contacts, isLoading: contactsLoading } = useContacts();
  const deleteContact = useDeleteContact();

  const handleDeleteContact = async (contact: Contact) => {
    if (!window.confirm(`Delete contact "${contact.name}"?`)) return;
    setDeleteError(null);
    try {
      await deleteContact.mutateAsync(contact.id);
    } catch (err) {
      setDeleteError(getErrorMessage(err));
    }
  };

  const handleEditContact = (contact: Contact) => {
    setEditingContact(contact);
    setContactModalOpen(true);
  };

  const handleAddContact = () => {
    setEditingContact(null);
    setContactModalOpen(true);
  };

  // Status options for filter
  const statusOptions = [
    { label: 'All Status', value: '' },
    { label: 'Open', value: 'OPEN' },
    { label: 'Acknowledged', value: 'ACKNOWLEDGED' },
    { label: 'In Progress', value: 'IN_PROGRESS' },
    { label: 'Resolved', value: 'RESOLVED' },
    { label: 'Exhausted', value: 'EXHAUSTED' },
  ];

  // Site options for filter
  const siteOptions = [
    { label: 'All Sites', value: '' },
    ...(sites?.map((site) => ({ label: site.name, value: site.id })) || []),
  ];

  // Count active issues
  const activeIssues = data?.issues.filter(
    (issue) => issue.status !== 'RESOLVED' && issue.status !== 'EXHAUSTED'
  ) || [];

  if (error) {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Tickets</h1>
        </div>
        <Card>
          <div className="p-4 text-center">
            <p className="text-sm text-red-600 dark:text-red-400">
              Failed to load tickets. Please try again.
            </p>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex gap-4">
      {/* Main Tickets Section - 75% */}
      <div className="flex-1 min-w-0 space-y-3" style={{ flexBasis: '75%' }}>
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Tickets</h1>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Manage critical issues requiring attention
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
          >
            <RefreshCw className={`w-3 h-3 mr-1 ${isFetching ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <Card>
            <div className="p-2">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-red-100 dark:bg-red-900/30 rounded">
                  <AlertTriangle className="w-4 h-4 text-red-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Active</p>
                  <p className="text-xl font-bold text-gray-900 dark:text-gray-100">
                    {activeIssues.length}
                  </p>
                </div>
              </div>
            </div>
          </Card>
          <Card>
            <div className="p-2">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-yellow-100 dark:bg-yellow-900/30 rounded">
                  <Clock className="w-4 h-4 text-yellow-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">In Progress</p>
                  <p className="text-xl font-bold text-gray-900 dark:text-gray-100">
                    {data?.issues.filter((i) => i.status === 'IN_PROGRESS').length || 0}
                  </p>
                </div>
              </div>
            </div>
          </Card>
          <Card>
            <div className="p-2">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-green-100 dark:bg-green-900/30 rounded">
                  <CheckCircle className="w-4 h-4 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Resolved Today</p>
                  <p className="text-xl font-bold text-gray-900 dark:text-gray-100">
                    {data?.issues.filter((i) => {
                      if (i.status !== 'RESOLVED' || !i.resolvedAt) return false;
                      const today = new Date();
                      const resolved = new Date(i.resolvedAt);
                      return resolved.toDateString() === today.toDateString();
                    }).length || 0}
                  </p>
                </div>
              </div>
            </div>
          </Card>
          <Card>
            <div className="p-2">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-gray-100 dark:bg-gray-800 rounded">
                  <AlertCircle className="w-4 h-4 text-gray-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Total</p>
                  <p className="text-xl font-bold text-gray-900 dark:text-gray-100">
                    {data?.total || 0}
                  </p>
                </div>
              </div>
            </div>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <div className="p-2">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-gray-400" />
              <div className="flex gap-2 flex-1">
                <Select
                  label=""
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as EscalationIssueStatus | '')}
                  options={statusOptions}
                  className="w-40"
                />
                <Select
                  label=""
                  value={siteFilter}
                  onChange={(e) => setSiteFilter(e.target.value)}
                  options={siteOptions}
                  className="w-40"
                />
              </div>
            </div>
          </div>
        </Card>

        {/* Issues List */}
        {isLoading ? (
          <div className="flex items-center justify-center py-6">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
          </div>
        ) : data?.issues.length === 0 ? (
          <Card>
            <div className="p-4 text-center">
              <Ticket className="w-10 h-10 text-green-500 mx-auto mb-2" />
              <h3 className="text-base font-medium text-gray-900 dark:text-gray-100 mb-1">
                No Open Tickets
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {statusFilter || siteFilter
                  ? 'No tickets match your current filters.'
                  : 'All clear! No critical issues require attention.'}
              </p>
            </div>
          </Card>
        ) : (
          <TicketsTable issues={data?.issues || []} />
        )}
      </div>

      {/* Contacts Sidebar - 25% */}
      <div className="w-72 flex-shrink-0">
        <Card className="sticky top-4">
          <div className="p-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-blue-600" />
                <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
                  Contacts
                </h2>
                <Badge variant="info">{contacts?.length || 0}</Badge>
              </div>
              <Button size="sm" variant="ghost" onClick={handleAddContact} title="Add contact">
                <Plus className="w-4 h-4" />
              </Button>
            </div>

            <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
              Assign contacts to sites for ticket escalation levels.
            </p>

            {deleteError && (
              <div className="p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-xs text-red-600 dark:text-red-400 mb-3">
                {deleteError}
              </div>
            )}

            {contactsLoading ? (
              <div className="flex items-center justify-center py-6">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
              </div>
            ) : contacts?.length === 0 ? (
              <div className="text-center py-6">
                <Users className="w-8 h-8 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  No contacts yet
                </p>
                <Button size="sm" onClick={handleAddContact} className="mt-3">
                  <Plus className="w-4 h-4 mr-1" />
                  Add Contact
                </Button>
              </div>
            ) : (
              <div className="space-y-2 max-h-[calc(100vh-300px)] overflow-y-auto">
                {contacts?.map((contact) => {
                  const stats = getContactStats(contact.email, data?.issues || []);
                  const hasStats = stats.open > 0 || stats.inProgress > 0 || stats.resolved > 0;

                  return (
                    <div
                      key={contact.id}
                      className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-800 rounded-lg group"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-sm text-gray-900 dark:text-gray-100 truncate">
                          {contact.name}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                          {contact.email}
                        </p>
                        {/* Ticket Stats */}
                        {hasStats && (
                          <div className="flex items-center gap-2 mt-1 text-xs">
                            {stats.open > 0 && (
                              <span className="text-red-600 dark:text-red-400" title="Open tickets">
                                🔴 {stats.open}
                              </span>
                            )}
                            {stats.inProgress > 0 && (
                              <span className="text-orange-600 dark:text-orange-400" title="In progress">
                                🟠 {stats.inProgress}
                              </span>
                            )}
                            {stats.resolved > 0 && (
                              <span className="text-green-600 dark:text-green-400" title="Resolved">
                                🟢 {stats.resolved}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => handleEditContact(contact)}
                          className="p-1 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400"
                          title="Edit contact"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteContact(contact)}
                          className="p-1 text-gray-400 hover:text-red-600 dark:hover:text-red-400"
                          title="Delete contact"
                          disabled={deleteContact.isPending}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* Contact Form Modal */}
      <ContactFormModal
        isOpen={contactModalOpen}
        onClose={() => {
          setContactModalOpen(false);
          setEditingContact(null);
        }}
        contact={editingContact}
      />
    </div>
  );
};
