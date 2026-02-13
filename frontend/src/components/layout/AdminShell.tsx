import { useState, useEffect } from 'react';
import { Outlet, NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  Building2,
  Globe,
  Settings,
  ArrowLeft,
  X,
  CreditCard,
  DollarSign,
} from 'lucide-react';
import { clsx } from 'clsx';
import { Header } from './Header';
import { Button } from '@/components/ui';

interface NavItem {
  to: string;
  icon: typeof LayoutDashboard;
  label: string;
}

const adminNavItems: NavItem[] = [
  { to: '/admin', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/admin/users', icon: Users, label: 'Users' },
  { to: '/admin/organizations', icon: Building2, label: 'Organizations' },
  { to: '/admin/plans', icon: CreditCard, label: 'Plans & Pricing' },
  { to: '/admin/payments', icon: DollarSign, label: 'Payments' },
  { to: '/admin/sites', icon: Globe, label: 'Sites' },
  { to: '/admin/config', icon: Settings, label: 'System Config' },
];

/**
 * Admin panel shell with header, admin sidebar, and content area
 * Uses purple/violet accent colors to distinguish from main app
 */
export const AdminShell = () => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const toggleMobileMenu = () => setIsMobileMenuOpen(!isMobileMenuOpen);
  const closeMobileMenu = () => setIsMobileMenuOpen(false);

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <Header onMenuClick={toggleMobileMenu} />
      <div className="flex-1 flex overflow-hidden">
        <AdminSidebar isOpen={isMobileMenuOpen} onClose={closeMobileMenu} />
        <main className="flex-1 overflow-auto bg-gray-100 dark:bg-gray-950">
          <div className="p-4 md:p-6 custom-scrollbar h-full">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};

interface AdminSidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Admin sidebar navigation with purple/violet accent
 */
const AdminSidebar = ({ isOpen, onClose }: AdminSidebarProps) => {
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
          <h2 className="text-lg font-semibold text-purple-600 dark:text-purple-400">
            Admin Panel
          </h2>
          <Button variant="ghost" size="sm" onClick={onClose} aria-label="Close menu">
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Desktop header */}
        <div className="hidden md:flex items-center p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-purple-600 dark:text-purple-400">
            Admin Panel
          </h2>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto custom-scrollbar">
          {adminNavItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/admin'}
                onClick={onClose}
                className={({ isActive }) =>
                  clsx(
                    'flex items-center gap-3 px-4 py-3 rounded-lg transition-colors',
                    isActive
                      ? 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300'
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

        {/* Back to App link */}
        <div className="p-4 border-t border-gray-200 dark:border-gray-700">
          <NavLink
            to="/"
            className="flex items-center gap-3 px-4 py-3 rounded-lg text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="font-medium">Back to App</span>
          </NavLink>
        </div>
      </aside>
    </>
  );
};
