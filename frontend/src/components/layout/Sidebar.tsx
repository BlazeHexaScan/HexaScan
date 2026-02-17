import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Globe,
  Bell,
  Server,
  X,
  Ticket,
  Shield,
  ShieldCheck,
  CreditCard,
  UserCircle,
  LifeBuoy,
} from 'lucide-react';

import { clsx } from 'clsx';
import { Button } from '@/components/ui';
import { useEffect } from 'react';
import { useAuthStore } from '@/features/auth';

interface NavItem {
  to: string;
  icon: typeof LayoutDashboard;
  label: string;
}

const navItems: NavItem[] = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/sites', icon: Globe, label: 'Sites' },
  { to: '/agents', icon: Server, label: 'Agents' },
  { to: '/notifications', icon: Bell, label: 'Notifications' },
  { to: '/tickets', icon: Ticket, label: 'Tickets' },
  { to: '/repo-scanner', icon: Shield, label: 'Repo Scanner' },
];

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Application sidebar navigation with mobile responsive behavior
 */
export const Sidebar = ({ isOpen, onClose }: SidebarProps) => {
  const user = useAuthStore((state) => state.user);
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';

  // Close sidebar on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside
        className={clsx(
          'fixed md:static inset-y-0 left-0 z-50 w-64 bg-gray-50 dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 flex flex-col transition-transform duration-300 md:translate-x-0',
          isOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Mobile close button */}
        <div className="flex items-center justify-between p-4 md:hidden border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Menu</h2>
          <Button variant="ghost" size="sm" onClick={onClose} aria-label="Close menu">
            <X className="w-5 h-5" />
          </Button>
        </div>

        <nav className="flex-1 p-4 space-y-1 overflow-y-auto custom-scrollbar">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={onClose}
                className={({ isActive }) =>
                  clsx(
                    'flex items-center gap-3 px-4 py-3 rounded-lg transition-colors',
                    isActive
                      ? 'bg-brand-100 text-brand-700 dark:bg-brand-900 dark:text-brand-300'
                      : 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800'
                  )
                }
              >
                <>
                  <Icon className="w-5 h-5" />
                  <span className="font-medium">{item.label}</span>
                </>
              </NavLink>
            );
          })}
        </nav>

        <div className="p-4 border-t border-gray-200 dark:border-gray-700">
          {/* Profile link */}
          <NavLink
            to="/profile"
            onClick={onClose}
            className={({ isActive }) =>
              clsx(
                'flex items-center gap-2 px-4 py-2 mb-3 rounded-lg text-sm font-medium transition-colors',
                isActive
                  ? 'bg-brand-100 text-brand-700 dark:bg-brand-900 dark:text-brand-300'
                  : 'bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700'
              )
            }
          >
            <UserCircle className="w-6 h-6 flex-shrink-0 text-gray-500 dark:text-gray-400" />
            <div className="flex flex-col min-w-0">
              <span className="text-gray-700 dark:text-gray-300 truncate">{user?.name || 'Profile'}</span>
              {user?.organizationName && (
                <span className="text-xs text-gray-400 dark:text-gray-500 truncate">{user.organizationName}</span>
              )}
            </div>
          </NavLink>
          {/* Plan badge */}
          <NavLink
            to="/plans"
            onClick={onClose}
            className="flex items-center gap-2 px-4 py-2 mb-3 rounded-lg text-sm font-medium bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 transition-colors"
          >
            <CreditCard className="w-4 h-4 text-purple-500" />
            <span className="text-gray-700 dark:text-gray-300">
              {{ FREE: 'Free', CLOUD: 'Cloud', SELF_HOSTED: 'Self-Hosted', ENTERPRISE: 'Enterprise' }[user?.plan || 'FREE'] || user?.plan} {user?.isTrial ? 'Trial' : 'Plan'}
            </span>
          </NavLink>
          {isSuperAdmin && (
            <NavLink
              to="/admin"
              onClick={onClose}
              className="flex items-center gap-3 px-4 py-2 mb-3 rounded-lg text-sm font-medium text-violet-700 bg-violet-50 hover:bg-violet-100 dark:text-violet-300 dark:bg-violet-900/20 dark:hover:bg-violet-900/40 transition-colors"
            >
              <ShieldCheck className="w-4 h-4" />
              Admin Panel
            </NavLink>
          )}
          <a
            href="mailto:support@hexascan.app"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-4 py-2 mb-3 rounded-lg text-sm font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-300 dark:hover:bg-gray-800 transition-colors"
          >
            <LifeBuoy className="w-4 h-4" />
            Support
          </a>
          <div className="text-xs text-gray-500 dark:text-gray-400">
            Version {import.meta.env.VITE_APP_VERSION || '0.1.0'}
          </div>
        </div>
      </aside>
    </>
  );
};
