import { useState, useMemo } from 'react';
import { useAdminOrganizations } from '@/features/admin';
import { Search, Users, Globe, Server, ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react';
import type { AdminOrganization } from '@/types/admin';

type SortField = 'name' | 'slug' | 'plan' | 'usersCount' | 'sitesCount' | 'agentsCount' | 'subscriptionStartsAt' | 'subscriptionExpiresAt' | 'createdAt';
type SortDirection = 'asc' | 'desc';

const compareFn = (a: AdminOrganization, b: AdminOrganization, field: SortField, dir: SortDirection): number => {
  let aVal: any;
  let bVal: any;

  switch (field) {
    case 'name':
    case 'slug':
    case 'plan':
      aVal = (a[field] ?? '').toLowerCase();
      bVal = (b[field] ?? '').toLowerCase();
      break;
    case 'usersCount':
    case 'sitesCount':
    case 'agentsCount':
      aVal = a[field] ?? 0;
      bVal = b[field] ?? 0;
      break;
    case 'subscriptionStartsAt':
    case 'subscriptionExpiresAt':
    case 'createdAt':
      aVal = a[field] ? new Date(a[field]!).getTime() : 0;
      bVal = b[field] ? new Date(b[field]!).getTime() : 0;
      break;
    default:
      return 0;
  }

  if (aVal < bVal) return dir === 'asc' ? -1 : 1;
  if (aVal > bVal) return dir === 'asc' ? 1 : -1;
  return 0;
};

export const AdminOrganizationsPage = () => {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [sortField, setSortField] = useState<SortField>('createdAt');
  const [sortDir, setSortDir] = useState<SortDirection>('desc');
  const { data, isLoading } = useAdminOrganizations({ search: search || undefined, page, limit: 25 });

  const totalPages = data ? Math.ceil(data.total / 25) : 1;

  const sortedOrgs = useMemo(() => {
    if (!data?.organizations) return [];
    return [...data.organizations].sort((a, b) => compareFn(a, b, sortField, sortDir));
  }, [data?.organizations, sortField, sortDir]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ChevronsUpDown className="w-3.5 h-3.5 opacity-40" />;
    return sortDir === 'asc'
      ? <ChevronUp className="w-3.5 h-3.5 text-violet-500" />
      : <ChevronDown className="w-3.5 h-3.5 text-violet-500" />;
  };

  const thClass = 'px-4 py-3 font-medium text-gray-500 dark:text-gray-400 select-none cursor-pointer hover:text-gray-700 dark:hover:text-gray-200 transition-colors';

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Organizations</h1>
        <span className="text-2xl font-bold text-purple-600 dark:text-purple-400">
          {data?.total ?? 0}
        </span>
      </div>

      <div className="mb-4 relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          placeholder="Search by name or slug..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-violet-500 focus:border-transparent"
        />
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-violet-600"></div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-900/50">
                <tr>
                  <th className={`text-left ${thClass}`} onClick={() => handleSort('name')}>
                    <span className="inline-flex items-center gap-1">Name <SortIcon field="name" /></span>
                  </th>
                  <th className={`text-left ${thClass}`} onClick={() => handleSort('slug')}>
                    <span className="inline-flex items-center gap-1">Slug <SortIcon field="slug" /></span>
                  </th>
                  <th className={`text-left ${thClass}`} onClick={() => handleSort('plan')}>
                    <span className="inline-flex items-center gap-1">Plan <SortIcon field="plan" /></span>
                  </th>
                  <th className={`text-center ${thClass}`} onClick={() => handleSort('usersCount')}>
                    <span className="inline-flex items-center gap-1 justify-center"><Users className="w-4 h-4" /> Users <SortIcon field="usersCount" /></span>
                  </th>
                  <th className={`text-center ${thClass}`} onClick={() => handleSort('sitesCount')}>
                    <span className="inline-flex items-center gap-1 justify-center"><Globe className="w-4 h-4" /> Sites <SortIcon field="sitesCount" /></span>
                  </th>
                  <th className={`text-center ${thClass}`} onClick={() => handleSort('agentsCount')}>
                    <span className="inline-flex items-center gap-1 justify-center"><Server className="w-4 h-4" /> Agents <SortIcon field="agentsCount" /></span>
                  </th>
                  <th className={`text-left ${thClass}`} onClick={() => handleSort('subscriptionStartsAt')}>
                    <span className="inline-flex items-center gap-1">Plan Start <SortIcon field="subscriptionStartsAt" /></span>
                  </th>
                  <th className={`text-left ${thClass}`} onClick={() => handleSort('subscriptionExpiresAt')}>
                    <span className="inline-flex items-center gap-1">Expiry <SortIcon field="subscriptionExpiresAt" /></span>
                  </th>
                  <th className={`text-left ${thClass}`} onClick={() => handleSort('createdAt')}>
                    <span className="inline-flex items-center gap-1">Created <SortIcon field="createdAt" /></span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {sortedOrgs.map((org) => (
                  <tr key={org.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                    <td className="px-4 py-3 text-gray-900 dark:text-gray-100 font-medium">{org.name}</td>
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400 font-mono text-xs">{org.slug}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${
                        org.plan === 'CLOUD' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300' :
                        org.plan === 'SELF_HOSTED' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' :
                        org.plan === 'ENTERPRISE' ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300' :
                        'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                      }`}>
                        {org.plan}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center text-gray-600 dark:text-gray-300">{org.usersCount}</td>
                    <td className="px-4 py-3 text-center text-gray-600 dark:text-gray-300">{org.sitesCount}</td>
                    <td className="px-4 py-3 text-center text-gray-600 dark:text-gray-300">{org.agentsCount}</td>
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400">
                      {org.subscriptionStartsAt ? (
                        new Date(org.subscriptionStartsAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
                      ) : (
                        <span className="text-gray-400 dark:text-gray-500">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400">
                      {org.subscriptionExpiresAt ? (
                        <span className={
                          new Date(org.subscriptionExpiresAt) < new Date()
                            ? 'text-red-600 dark:text-red-400 font-medium'
                            : new Date(org.subscriptionExpiresAt) < new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
                              ? 'text-yellow-600 dark:text-yellow-400 font-medium'
                              : ''
                        }>
                          {new Date(org.subscriptionExpiresAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                        </span>
                      ) : (
                        <span className="text-gray-400 dark:text-gray-500">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400">
                      {new Date(org.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
                {sortedOrgs.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">No organizations found</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">Page {page} of {totalPages}</p>
          <div className="flex gap-2">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
              className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50">
              Previous
            </button>
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
              className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50">
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
