import { useParams, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { useAdminUser, useUpdateAdminUser } from '@/features/admin';
import { UpdateAdminUserRequest } from '@/types/admin';
import {
  ArrowLeft, Pencil, X, Save, User, Building2, Globe, Server, Activity,
  AlertTriangle, Calendar, Mail, Shield, Users, CreditCard, ArrowRightLeft, Clock,
  CheckCircle, XCircle,
} from 'lucide-react';

const ROLES = ['ORG_ADMIN', 'ORG_MEMBER', 'ORG_VIEWER', 'SUPER_ADMIN'];

const getRoleBadge = (role: string) => {
  switch (role) {
    case 'SUPER_ADMIN':
      return 'bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-300';
    case 'ORG_ADMIN':
      return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300';
    default:
      return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
  }
};

const getPlanBadge = (plan: string) => {
  switch (plan) {
    case 'CLOUD':
      return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300';
    case 'SELF_HOSTED':
      return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300';
    case 'ENTERPRISE':
      return 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300';
    default:
      return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
  }
};

const getStatusBadge = (status: string) => {
  switch (status) {
    case 'ACTIVE':
      return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300';
    case 'ONLINE':
      return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300';
    case 'OFFLINE':
      return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
    case 'ERROR':
      return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300';
    default:
      return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
  }
};

const getHealthColor = (score: number) => {
  if (score >= 80) return 'text-green-600 dark:text-green-400';
  if (score >= 60) return 'text-yellow-600 dark:text-yellow-400';
  if (score >= 30) return 'text-orange-600 dark:text-orange-400';
  return 'text-red-600 dark:text-red-400';
};

const getPaymentStatusBadge = (status: string) => {
  switch (status) {
    case 'COMPLETED':
      return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300';
    case 'PENDING':
      return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300';
    case 'FAILED':
      return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300';
    case 'REFUNDED':
      return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
    default:
      return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
  }
};

const getSubStatusBadge = (status: string) => {
  switch (status) {
    case 'ACTIVE':
      return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300';
    case 'EXPIRED':
      return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300';
    case 'CANCELLED':
      return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
    default:
      return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
  }
};

export const AdminUserDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: user, isLoading } = useAdminUser(id || '');
  const updateUser = useUpdateAdminUser();

  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState<UpdateAdminUserRequest>({});

  const handleEdit = () => {
    if (!user) return;
    setEditForm({ name: user.name, email: user.email, role: user.role });
    setEditing(true);
  };

  const handleSave = async () => {
    if (!user) return;
    try {
      await updateUser.mutateAsync({ userId: user.id, data: editForm });
      setEditing(false);
    } catch (err: any) {
      alert(err?.response?.data?.error || 'Failed to update user');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-600"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500 dark:text-gray-400">User not found</p>
        <button onClick={() => navigate('/admin/users')} className="mt-4 text-violet-600 hover:underline">
          Back to Users
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Back + Header */}
      <div>
        <button
          onClick={() => navigate('/admin/users')}
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-violet-600 dark:hover:text-violet-400 mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Users
        </button>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center">
              <User className="w-6 h-6 text-violet-600 dark:text-violet-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{user.name}</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">{user.email}</p>
            </div>
            <span className={`ml-2 inline-flex px-2.5 py-0.5 rounded text-xs font-medium ${getRoleBadge(user.role)}`}>
              {user.role}
            </span>
          </div>
          <button
            onClick={handleEdit}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm text-white bg-violet-600 rounded-lg hover:bg-violet-700"
          >
            <Pencil className="w-4 h-4" />
            Edit User
          </button>
        </div>
      </div>

      {/* User Info + Organization Info */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* User Info Card */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-5">
          <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4">User Information</h2>
          <dl className="space-y-3">
            <div className="flex items-center gap-3">
              <Mail className="w-4 h-4 text-gray-400 flex-shrink-0" />
              <dt className="text-sm text-gray-500 dark:text-gray-400 w-28">Email</dt>
              <dd className="text-sm text-gray-900 dark:text-gray-100">{user.email}</dd>
            </div>
            <div className="flex items-center gap-3">
              <Shield className="w-4 h-4 text-gray-400 flex-shrink-0" />
              <dt className="text-sm text-gray-500 dark:text-gray-400 w-28">Role</dt>
              <dd><span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${getRoleBadge(user.role)}`}>{user.role}</span></dd>
            </div>
            <div className="flex items-center gap-3">
              <Users className="w-4 h-4 text-gray-400 flex-shrink-0" />
              <dt className="text-sm text-gray-500 dark:text-gray-400 w-28">Team</dt>
              <dd className="text-sm text-gray-900 dark:text-gray-100">{user.team?.name || <span className="text-gray-400">None</span>}</dd>
            </div>
            <div className="flex items-center gap-3">
              <Shield className="w-4 h-4 text-gray-400 flex-shrink-0" />
              <dt className="text-sm text-gray-500 dark:text-gray-400 w-28">2FA</dt>
              <dd className="text-sm">
                {user.totpEnabled ? (
                  <span className="text-green-600 dark:text-green-400 font-medium">Enabled</span>
                ) : (
                  <span className="text-gray-400">Disabled</span>
                )}
              </dd>
            </div>
            <div className="flex items-center gap-3">
              <Calendar className="w-4 h-4 text-gray-400 flex-shrink-0" />
              <dt className="text-sm text-gray-500 dark:text-gray-400 w-28">Joined</dt>
              <dd className="text-sm text-gray-900 dark:text-gray-100">
                {new Date(user.createdAt).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}
              </dd>
            </div>
            <div className="flex items-center gap-3">
              <Calendar className="w-4 h-4 text-gray-400 flex-shrink-0" />
              <dt className="text-sm text-gray-500 dark:text-gray-400 w-28">Last Updated</dt>
              <dd className="text-sm text-gray-900 dark:text-gray-100">
                {new Date(user.updatedAt).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}
              </dd>
            </div>
          </dl>
        </div>

        {/* Organization Card */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-5">
          <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4">Organization</h2>
          <dl className="space-y-3">
            <div className="flex items-center gap-3">
              <Building2 className="w-4 h-4 text-gray-400 flex-shrink-0" />
              <dt className="text-sm text-gray-500 dark:text-gray-400 w-28">Name</dt>
              <dd className="text-sm text-gray-900 dark:text-gray-100 font-medium">{user.organization.name}</dd>
            </div>
            <div className="flex items-center gap-3">
              <Building2 className="w-4 h-4 text-gray-400 flex-shrink-0" />
              <dt className="text-sm text-gray-500 dark:text-gray-400 w-28">Slug</dt>
              <dd className="text-sm text-gray-500 dark:text-gray-400 font-mono text-xs">{user.organization.slug}</dd>
            </div>
            <div className="flex items-center gap-3">
              <Shield className="w-4 h-4 text-gray-400 flex-shrink-0" />
              <dt className="text-sm text-gray-500 dark:text-gray-400 w-28">Plan</dt>
              <dd><span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${getPlanBadge(user.organization.plan)}`}>{user.organization.plan}</span></dd>
            </div>
            {user.organization.subscriptionStatus && (
              <div className="flex items-center gap-3">
                <Activity className="w-4 h-4 text-gray-400 flex-shrink-0" />
                <dt className="text-sm text-gray-500 dark:text-gray-400 w-28">Subscription</dt>
                <dd className="text-sm text-gray-900 dark:text-gray-100">{user.organization.subscriptionStatus}</dd>
              </div>
            )}
            {user.organization.subscriptionStartsAt && (
              <div className="flex items-center gap-3">
                <Calendar className="w-4 h-4 text-gray-400 flex-shrink-0" />
                <dt className="text-sm text-gray-500 dark:text-gray-400 w-28">Plan Start</dt>
                <dd className="text-sm text-gray-900 dark:text-gray-100">
                  {new Date(user.organization.subscriptionStartsAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                </dd>
              </div>
            )}
            {user.organization.subscriptionExpiresAt && (
              <div className="flex items-center gap-3">
                <Calendar className="w-4 h-4 text-gray-400 flex-shrink-0" />
                <dt className="text-sm text-gray-500 dark:text-gray-400 w-28">Expiry</dt>
                <dd className={`text-sm ${
                  new Date(user.organization.subscriptionExpiresAt) < new Date()
                    ? 'text-red-600 dark:text-red-400 font-medium'
                    : new Date(user.organization.subscriptionExpiresAt) < new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
                      ? 'text-yellow-600 dark:text-yellow-400 font-medium'
                      : 'text-gray-900 dark:text-gray-100'
                }`}>
                  {new Date(user.organization.subscriptionExpiresAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                </dd>
              </div>
            )}
            <div className="flex items-center gap-3">
              <Calendar className="w-4 h-4 text-gray-400 flex-shrink-0" />
              <dt className="text-sm text-gray-500 dark:text-gray-400 w-28">Created</dt>
              <dd className="text-sm text-gray-900 dark:text-gray-100">
                {new Date(user.organization.createdAt).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}
              </dd>
            </div>
          </dl>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
              <Globe className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Sites</p>
              <p className="text-xl font-bold text-gray-900 dark:text-gray-100">{user.stats.sitesCount}</p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900/30">
              <Server className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Agents</p>
              <p className="text-xl font-bold text-gray-900 dark:text-gray-100">{user.stats.agentsCount}</p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/30">
              <Activity className="w-5 h-5 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Monitors</p>
              <p className="text-xl font-bold text-gray-900 dark:text-gray-100">{user.stats.monitorsCount}</p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-orange-100 dark:bg-orange-900/30">
              <AlertTriangle className="w-5 h-5 text-orange-600 dark:text-orange-400" />
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Open Escalations</p>
              <p className="text-xl font-bold text-gray-900 dark:text-gray-100">{user.stats.openEscalations}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Sites Table */}
      {user.sites.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Sites ({user.sites.length})
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-900/50">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Name</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-gray-400">URL</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Type</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Status</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Health</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {user.sites.map((site) => (
                  <tr key={site.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                    <td className="px-4 py-3 text-gray-900 dark:text-gray-100 font-medium">{site.name}</td>
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400 text-xs font-mono truncate max-w-[250px]">{site.url}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300">
                        {site.siteType}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${getStatusBadge(site.status)}`}>
                        {site.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className={`font-semibold ${getHealthColor(site.healthScore)}`}>
                        {site.healthScore}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Agents Table */}
      {user.agents.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Agents ({user.agents.length})
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-900/50">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Name</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Status</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Last Seen</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {user.agents.map((agent) => (
                  <tr key={agent.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                    <td className="px-4 py-3 text-gray-900 dark:text-gray-100 font-medium">{agent.name}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${getStatusBadge(agent.status)}`}>
                        {agent.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400">
                      {agent.lastSeenAt
                        ? new Date(agent.lastSeenAt).toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })
                        : <span className="text-gray-400">Never</span>
                      }
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Subscription History */}
      {user.subscriptions.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Subscription History ({user.subscriptions.length})
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-900/50">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Plan</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Status</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Start Date</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Expiry Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {user.subscriptions.map((sub) => (
                  <tr key={sub.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${getPlanBadge(sub.plan)}`}>
                        {sub.plan}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${getSubStatusBadge(sub.status)}`}>
                        {sub.status === 'ACTIVE' && <CheckCircle className="w-3 h-3" />}
                        {sub.status === 'EXPIRED' && <XCircle className="w-3 h-3" />}
                        {sub.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400">
                      {new Date(sub.startsAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                    </td>
                    <td className="px-4 py-3">
                      <span className={
                        new Date(sub.expiresAt) < new Date()
                          ? 'text-red-600 dark:text-red-400 font-medium'
                          : new Date(sub.expiresAt) < new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
                            ? 'text-yellow-600 dark:text-yellow-400 font-medium'
                            : 'text-gray-500 dark:text-gray-400'
                      }>
                        {new Date(sub.expiresAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Payment History */}
      {user.payments.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider flex items-center gap-2">
              <CreditCard className="w-4 h-4" />
              Payment History ({user.payments.length})
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-900/50">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Amount</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Plan</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Status</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Stripe Session</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {user.payments.map((payment) => (
                  <tr key={payment.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                    <td className="px-4 py-3 text-gray-900 dark:text-gray-100 font-semibold">
                      ${payment.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${getPlanBadge(payment.plan)}`}>
                        {payment.plan}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${getPaymentStatusBadge(payment.status)}`}>
                        {payment.status === 'COMPLETED' && <CheckCircle className="w-3 h-3" />}
                        {payment.status === 'PENDING' && <Clock className="w-3 h-3" />}
                        {payment.status === 'FAILED' && <XCircle className="w-3 h-3" />}
                        {payment.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {payment.stripeSessionId ? (
                        <span className="text-gray-500 dark:text-gray-400 font-mono text-xs truncate max-w-[160px] inline-block" title={payment.stripeSessionId}>
                          {payment.stripeSessionId.substring(0, 20)}...
                        </span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400">
                      {new Date(payment.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Plan Changes */}
      {user.planChanges.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider flex items-center gap-2">
              <ArrowRightLeft className="w-4 h-4" />
              Plan Changes ({user.planChanges.length})
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-900/50">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-gray-400">From</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-gray-400">To</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Reason</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Effective</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {user.planChanges.map((change) => (
                  <tr key={change.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${getPlanBadge(change.fromPlan)}`}>
                        {change.fromPlan}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${getPlanBadge(change.toPlan)}`}>
                        {change.toPlan}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-300 capitalize">
                      {change.reason.toLowerCase().replace(/_/g, ' ')}
                    </td>
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400">
                      {new Date(change.effectiveAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                    </td>
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400">
                      {new Date(change.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editing && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Edit User</h2>
              <button onClick={() => setEditing(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Name</label>
                <input type="text" value={editForm.name || ''} onChange={(e) => setEditForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email</label>
                <input type="email" value={editForm.email || ''} onChange={(e) => setEditForm(f => ({ ...f, email: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Role</label>
                <select value={editForm.role || ''} onChange={(e) => setEditForm(f => ({ ...f, role: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100">
                  {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setEditing(false)}
                className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700">
                Cancel
              </button>
              <button onClick={handleSave} disabled={updateUser.isPending}
                className="px-4 py-2 text-sm text-white bg-violet-600 rounded-lg hover:bg-violet-700 disabled:opacity-50 flex items-center gap-2">
                <Save className="w-4 h-4" />
                {updateUser.isPending ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
