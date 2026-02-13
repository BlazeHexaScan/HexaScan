import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAdminUsers, useUpdateAdminUser, useDeleteAdminUser } from '@/features/admin';
import { AdminUser, UpdateAdminUserRequest } from '@/types/admin';
import { Search, Pencil, Trash2, X, Save, ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react';

const ROLES = ['ORG_ADMIN', 'ORG_MEMBER', 'ORG_VIEWER', 'SUPER_ADMIN'];

type SortField = 'name' | 'email' | 'role' | 'organizationName' | 'createdAt';
type SortDirection = 'asc' | 'desc';

const compareFn = (a: AdminUser, b: AdminUser, field: SortField, dir: SortDirection): number => {
  let aVal: any;
  let bVal: any;

  switch (field) {
    case 'name':
    case 'email':
    case 'role':
    case 'organizationName':
      aVal = (a[field] ?? '').toLowerCase();
      bVal = (b[field] ?? '').toLowerCase();
      break;
    case 'createdAt':
      aVal = a[field] ? new Date(a[field]).getTime() : 0;
      bVal = b[field] ? new Date(b[field]).getTime() : 0;
      break;
    default:
      return 0;
  }

  if (aVal < bVal) return dir === 'asc' ? -1 : 1;
  if (aVal > bVal) return dir === 'asc' ? 1 : -1;
  return 0;
};

export const AdminUsersPage = () => {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [sortField, setSortField] = useState<SortField>('createdAt');
  const [sortDir, setSortDir] = useState<SortDirection>('desc');
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);
  const [editForm, setEditForm] = useState<UpdateAdminUserRequest>({});
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const { data, isLoading } = useAdminUsers({ search: search || undefined, page, limit: 25 });
  const updateUser = useUpdateAdminUser();
  const deleteUser = useDeleteAdminUser();

  const sortedUsers = useMemo(() => {
    if (!data?.users) return [];
    return [...data.users].sort((a, b) => compareFn(a, b, sortField, sortDir));
  }, [data?.users, sortField, sortDir]);

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

  const handleEdit = (user: AdminUser) => {
    setEditingUser(user);
    setEditForm({ name: user.name, email: user.email, role: user.role });
  };

  const handleSave = async () => {
    if (!editingUser) return;
    try {
      await updateUser.mutateAsync({ userId: editingUser.id, data: editForm });
      setEditingUser(null);
    } catch (err: any) {
      alert(err?.response?.data?.error || 'Failed to update user');
    }
  };

  const handleDelete = async (userId: string) => {
    try {
      await deleteUser.mutateAsync(userId);
      setDeleteConfirm(null);
    } catch (err: any) {
      alert(err?.response?.data?.error || 'Failed to delete user');
    }
  };

  const totalPages = data ? Math.ceil(data.total / 25) : 1;
  const thClass = 'px-4 py-3 font-medium text-gray-500 dark:text-gray-400 select-none cursor-pointer hover:text-gray-700 dark:hover:text-gray-200 transition-colors';

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Users</h1>
        <span className="text-2xl font-bold text-purple-600 dark:text-purple-400">
          {data?.total ?? 0}
        </span>
      </div>

      {/* Search */}
      <div className="mb-4 relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          placeholder="Search by name or email..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-violet-500 focus:border-transparent"
        />
      </div>

      {/* Table */}
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
                  <th className={`text-left ${thClass}`} onClick={() => handleSort('email')}>
                    <span className="inline-flex items-center gap-1">Email <SortIcon field="email" /></span>
                  </th>
                  <th className={`text-left ${thClass}`} onClick={() => handleSort('role')}>
                    <span className="inline-flex items-center gap-1">Role <SortIcon field="role" /></span>
                  </th>
                  <th className={`text-left ${thClass}`} onClick={() => handleSort('organizationName')}>
                    <span className="inline-flex items-center gap-1">Organization <SortIcon field="organizationName" /></span>
                  </th>
                  <th className={`text-left ${thClass}`} onClick={() => handleSort('createdAt')}>
                    <span className="inline-flex items-center gap-1">Created <SortIcon field="createdAt" /></span>
                  </th>
                  <th className="text-right px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {sortedUsers.map((user) => (
                  <tr key={user.id} onClick={() => navigate(`/admin/users/${user.id}`)} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer">
                    <td className="px-4 py-3 text-gray-900 dark:text-gray-100 font-medium">{user.name}</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{user.email}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${
                        user.role === 'SUPER_ADMIN' ? 'bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-300' :
                        user.role === 'ORG_ADMIN' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300' :
                        'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                      }`}>
                        {user.role}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{user.organizationName}</td>
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400">
                      {new Date(user.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-2">
                        <button onClick={() => handleEdit(user)} className="p-1 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400" title="Edit">
                          <Pencil className="w-4 h-4" />
                        </button>
                        {deleteConfirm === user.id ? (
                          <div className="flex items-center gap-1">
                            <button onClick={() => handleDelete(user.id)} className="text-xs text-red-600 font-medium hover:underline">Confirm</button>
                            <button onClick={() => setDeleteConfirm(null)} className="text-xs text-gray-500 hover:underline">Cancel</button>
                          </div>
                        ) : (
                          <button onClick={() => setDeleteConfirm(user.id)} className="p-1 text-gray-400 hover:text-red-600 dark:hover:text-red-400" title="Delete">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {sortedUsers.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">No users found</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Page {page} of {totalPages}
          </p>
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

      {/* Edit Modal */}
      {editingUser && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Edit User</h2>
              <button onClick={() => setEditingUser(null)} className="text-gray-400 hover:text-gray-600">
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
              <button onClick={() => setEditingUser(null)}
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
