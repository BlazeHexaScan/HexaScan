import { FormEvent, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle, AlertTriangle } from 'lucide-react';
import { Card, Button, Input } from '@/components/ui';
import { useAuth } from '@/features/auth/hooks/useAuth';

const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])/;

export const ResetPasswordPage = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const { resetPasswordAsync, isResetPasswordPending, resetPasswordError } = useAuth();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [validationError, setValidationError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setValidationError('');

    if (password.length < 8) {
      setValidationError('Password must be at least 8 characters.');
      return;
    }

    if (!PASSWORD_REGEX.test(password)) {
      setValidationError(
        'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character (@$!%*?&).'
      );
      return;
    }

    if (password !== confirmPassword) {
      setValidationError('Passwords do not match.');
      return;
    }

    try {
      await resetPasswordAsync({ token: token!, password });
      setSuccess(true);
    } catch {
      // Error is handled by the hook
    }
  };

  // No token in URL
  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-brand-50 to-brand-100 dark:from-gray-900 dark:to-gray-800 px-4">
        <Card variant="elevated" padding="lg" className="w-full max-w-md">
          <div className="text-center space-y-4">
            <div className="flex justify-center">
              <div className="rounded-full bg-amber-100 dark:bg-amber-900/30 p-3">
                <AlertTriangle className="h-8 w-8 text-amber-600 dark:text-amber-400" />
              </div>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              Invalid reset link
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              This password reset link is invalid or missing a token. Please request a new one.
            </p>
            <div className="pt-2 space-y-2">
              <Link
                to="/forgot-password"
                className="block text-sm font-medium text-brand-600 hover:text-brand-500 dark:text-brand-400"
              >
                Request a new reset link
              </Link>
              <Link
                to="/login"
                className="block text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
              >
                Back to login
              </Link>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  // Success state
  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-brand-50 to-brand-100 dark:from-gray-900 dark:to-gray-800 px-4">
        <Card variant="elevated" padding="lg" className="w-full max-w-md">
          <div className="text-center space-y-4">
            <div className="flex justify-center">
              <div className="rounded-full bg-green-100 dark:bg-green-900/30 p-3">
                <CheckCircle className="h-8 w-8 text-green-600 dark:text-green-400" />
              </div>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              Password reset successful
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Your password has been reset. You can now log in with your new password.
            </p>
            <div className="pt-2">
              <Link
                to="/login"
                className="inline-flex items-center justify-center w-full rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 transition-colors"
              >
                Go to login
              </Link>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  // Reset form
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-brand-50 to-brand-100 dark:from-gray-900 dark:to-gray-800 px-4">
      <Card variant="elevated" padding="lg" className="w-full max-w-md">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              Set new password
            </h2>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
              Enter your new password below.
            </p>
          </div>

          {(validationError || resetPasswordError) && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
              <p className="text-sm text-red-800 dark:text-red-200">
                {validationError || resetPasswordError}
              </p>
            </div>
          )}

          <div className="space-y-4">
            <Input
              label="New password"
              type="password"
              autoComplete="new-password"
              required
              fullWidth
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setValidationError('');
              }}
              placeholder="Enter new password"
              disabled={isResetPasswordPending}
            />

            <Input
              label="Confirm new password"
              type="password"
              autoComplete="new-password"
              required
              fullWidth
              value={confirmPassword}
              onChange={(e) => {
                setConfirmPassword(e.target.value);
                setValidationError('');
              }}
              placeholder="Confirm new password"
              disabled={isResetPasswordPending}
            />
          </div>

          <p className="text-xs text-gray-500 dark:text-gray-400">
            Password must be at least 8 characters and contain an uppercase letter, lowercase letter, number, and special character (@$!%*?&).
          </p>

          <Button type="submit" fullWidth isLoading={isResetPasswordPending}>
            Reset password
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
      </Card>
    </div>
  );
};
