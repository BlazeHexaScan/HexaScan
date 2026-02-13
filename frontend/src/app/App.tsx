import { useEffect } from 'react';
import { RouterProvider } from 'react-router-dom';
import { AppProviders } from './providers';
import { router } from './routes';
import { useAuthStore } from '@/features/auth';
import { fetchPublicConfig } from '@/lib/api/publicConfig';

/**
 * Auth initializer component that sets loading state
 */
const AuthInitializer = ({ children }: { children: React.ReactNode }) => {
  const setLoading = useAuthStore((state) => state.setLoading);

  useEffect(() => {
    // Mark auth as initialized after checking persisted state
    setLoading(false);
    // Fetch public config on app load
    fetchPublicConfig();
  }, [setLoading]);

  return <>{children}</>;
};

/**
 * Main App component
 */
export const App = () => {
  return (
    <AppProviders>
      <AuthInitializer>
        <RouterProvider router={router} />
      </AuthInitializer>
    </AppProviders>
  );
};
