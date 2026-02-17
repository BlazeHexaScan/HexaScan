import { FormEvent, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle } from 'lucide-react';
import { Card, Button, Input } from '@/components/ui';
import { useAuth } from '@/features/auth/hooks/useAuth';

export const ForgotPasswordPage = () => {
  const { forgotPasswordAsync, isForgotPasswordPending, forgotPasswordError } = useAuth();
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    try {
      await forgotPasswordAsync(email);
      setSubmitted(true);
    } catch {
      // Error is handled by the hook
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-brand-50 to-brand-100 dark:from-gray-900 dark:to-gray-800 px-4">
      <Card variant="elevated" padding="lg" className="w-full max-w-md">
        {submitted ? (
          <div className="text-center space-y-4">
            <div className="flex justify-center">
              <div className="rounded-full bg-green-100 dark:bg-green-900/30 p-3">
                <CheckCircle className="h-8 w-8 text-green-600 dark:text-green-400" />
              </div>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              Check your email
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              If an account exists with <strong>{email}</strong>, we've sent a password reset link.
              Check your inbox and spam folder.
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-500">
              The link will expire in 1 hour.
            </p>
            <div className="pt-2">
              <Link
                to="/login"
                className="text-sm font-medium text-brand-600 hover:text-brand-500 dark:text-brand-400"
              >
                Back to login
              </Link>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                Forgot your password?
              </h2>
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                Enter your email address and we'll send you a link to reset your password.
              </p>
            </div>

            {forgotPasswordError && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                <p className="text-sm text-red-800 dark:text-red-200">{forgotPasswordError}</p>
              </div>
            )}

            <Input
              label="Email address"
              type="email"
              autoComplete="email"
              required
              fullWidth
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              disabled={isForgotPasswordPending}
            />

            <Button type="submit" fullWidth isLoading={isForgotPasswordPending}>
              Send reset link
            </Button>

            <div className="text-center">
              <Link
                to="/login"
                className="text-sm font-medium text-brand-600 hover:text-brand-500 dark:text-brand-400"
              >
                Back to login
              </Link>
            </div>
          </form>
        )}
      </Card>
    </div>
  );
};
