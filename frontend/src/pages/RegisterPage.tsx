import { Card } from '@/components/ui';
import { RegisterForm } from '@/features/auth';

/**
 * Registration page
 */
export const RegisterPage = () => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-brand-50 to-brand-100 dark:from-gray-900 dark:to-gray-800 px-4 py-8">
      <Card variant="elevated" padding="lg" className="w-full max-w-md">
        <RegisterForm />
      </Card>
    </div>
  );
};
