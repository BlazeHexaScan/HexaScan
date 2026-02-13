import { createBrowserRouter, Navigate, useParams, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/features/auth';
import { AppShell } from '@/components/layout';
import { AdminShell } from '@/components/layout/AdminShell';
import { LoginPage, RegisterPage, DashboardPage, SitesPage, SiteDetailPage, AgentsPage, NotificationsPage, EscalationsPage, EscalationIssuePage, RepoScannerPage, PlansPage, ProfilePage } from '@/pages';
import { AdminDashboardPage } from '@/pages/admin/AdminDashboardPage';
import { AdminUsersPage } from '@/pages/admin/AdminUsersPage';
import { AdminOrganizationsPage } from '@/pages/admin/AdminOrganizationsPage';
import { AdminSitesPage } from '@/pages/admin/AdminSitesPage';
import { AdminConfigPage } from '@/pages/admin/AdminConfigPage';
import { AdminPlansPage } from '@/pages/admin/AdminPlansPage';
import { AdminPaymentsPage } from '@/pages/admin/AdminPaymentsPage';
import { AdminUserDetailPage } from '@/pages/admin/AdminUserDetailPage';

/**
 * Redirect from old /escalation/:token to new /ticket/:token URL
 * Preserves query parameters (l, s)
 */
const RedirectToTicket = () => {
  const { token } = useParams<{ token: string }>();
  const location = useLocation();
  return <Navigate to={`/ticket/${token}${location.search}`} replace />;
};

/**
 * Protected route wrapper that redirects to login if not authenticated
 */
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const isLoading = useAuthStore((state) => state.isLoading);

  // Show loading state while checking auth
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

/**
 * Admin route wrapper - requires SUPER_ADMIN role
 */
const AdminRoute = ({ children }: { children: React.ReactNode }) => {
  const user = useAuthStore((state) => state.user);
  if (!user || user.role !== 'SUPER_ADMIN') {
    return <Navigate to="/dashboard" replace />;
  }
  return <>{children}</>;
};

/**
 * Public route wrapper that redirects to dashboard if authenticated
 */
const PublicRoute = ({ children }: { children: React.ReactNode }) => {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const isLoading = useAuthStore((state) => state.isLoading);

  // Show loading state while checking auth
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
};

/**
 * Application routes configuration
 */
export const router = createBrowserRouter([
  {
    path: '/',
    element: <Navigate to="/dashboard" replace />,
  },
  {
    path: '/login',
    element: (
      <PublicRoute>
        <LoginPage />
      </PublicRoute>
    ),
  },
  {
    path: '/register',
    element: (
      <PublicRoute>
        <RegisterPage />
      </PublicRoute>
    ),
  },
  // Public ticket issue page (accessible via token, no auth required)
  {
    path: '/ticket/:token',
    element: <EscalationIssuePage />,
  },
  // Redirect old escalation URL to new ticket URL
  {
    path: '/escalation/:token',
    element: <RedirectToTicket />,
  },
  {
    element: (
      <ProtectedRoute>
        <AppShell />
      </ProtectedRoute>
    ),
    children: [
      {
        path: '/dashboard',
        element: <DashboardPage />,
      },
      {
        path: '/sites',
        element: <SitesPage />,
      },
      {
        path: '/sites/:id',
        element: <SiteDetailPage />,
      },
      {
        path: '/checks',
        element: <div>Monitors - Coming Soon</div>,
      },
      {
        path: '/agents',
        element: <AgentsPage />,
      },
      {
        path: '/notifications',
        element: <NotificationsPage />,
      },
      {
        path: '/tickets',
        element: <EscalationsPage />,
      },
      // Redirect old escalations URL to tickets
      {
        path: '/escalations',
        element: <Navigate to="/tickets" replace />,
      },
      {
        path: '/repo-scanner',
        element: <RepoScannerPage />,
      },
      {
        path: '/plans',
        element: <PlansPage />,
      },
      {
        path: '/profile',
        element: <ProfilePage />,
      },
    ],
  },
  // Admin routes with separate layout
  {
    element: (
      <ProtectedRoute>
        <AdminRoute>
          <AdminShell />
        </AdminRoute>
      </ProtectedRoute>
    ),
    children: [
      { path: '/admin', element: <AdminDashboardPage /> },
      { path: '/admin/users', element: <AdminUsersPage /> },
      { path: '/admin/users/:id', element: <AdminUserDetailPage /> },
      { path: '/admin/organizations', element: <AdminOrganizationsPage /> },
      { path: '/admin/plans', element: <AdminPlansPage /> },
      { path: '/admin/payments', element: <AdminPaymentsPage /> },
      { path: '/admin/sites', element: <AdminSitesPage /> },
      { path: '/admin/config', element: <AdminConfigPage /> },
    ],
  },
  {
    path: '*',
    element: <Navigate to="/dashboard" replace />,
  },
]);
