import { FormEvent, useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { Button, Input } from '@/components/ui';
import { getValidationErrors } from '@/lib/api/client';

/**
 * Login form component
 */
export const LoginForm = () => {
  const { login, isLoggingIn, loginError, loginMutationError } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Extract field-level validation errors from backend response
  useEffect(() => {
    if (loginMutationError) {
      const validationErrors = getValidationErrors(loginMutationError);
      if (validationErrors) {
        setFieldErrors(validationErrors);
      } else {
        setFieldErrors({});
      }
    } else {
      setFieldErrors({});
    }
  }, [loginMutationError]);

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setFieldErrors({});
    login({ email, password });
  };

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEmail(e.target.value);
    if (fieldErrors.email) {
      setFieldErrors((prev) => {
        const updated = { ...prev };
        delete updated.email;
        return updated;
      });
    }
  };

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPassword(e.target.value);
    if (fieldErrors.password) {
      setFieldErrors((prev) => {
        const updated = { ...prev };
        delete updated.password;
        return updated;
      });
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          Sign in to your account
        </h2>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
          Or{' '}
          <Link
            to="/register"
            className="font-medium text-brand-600 hover:text-brand-500 dark:text-brand-400"
          >
            create a new account
          </Link>
        </p>
      </div>

      {loginError && Object.keys(fieldErrors).length === 0 && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <p className="text-sm text-red-800 dark:text-red-200">{loginError}</p>
        </div>
      )}

      <div className="space-y-4">
        <Input
          label="Email address"
          type="email"
          autoComplete="email"
          required
          fullWidth
          value={email}
          onChange={handleEmailChange}
          placeholder="you@example.com"
          disabled={isLoggingIn}
          error={fieldErrors.email}
        />

        <Input
          label="Password"
          type="password"
          autoComplete="current-password"
          required
          fullWidth
          value={password}
          onChange={handlePasswordChange}
          placeholder="Enter your password"
          disabled={isLoggingIn}
          error={fieldErrors.password}
        />
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <input
            id="remember-me"
            name="remember-me"
            type="checkbox"
            className="h-4 w-4 text-brand-600 focus:ring-brand-500 border-gray-300 rounded"
          />
          <label
            htmlFor="remember-me"
            className="ml-2 block text-sm text-gray-700 dark:text-gray-300"
          >
            Remember me
          </label>
        </div>

        <div className="text-sm">
          <a
            href="#"
            className="font-medium text-brand-600 hover:text-brand-500 dark:text-brand-400"
          >
            Forgot your password?
          </a>
        </div>
      </div>

      <Button type="submit" fullWidth isLoading={isLoggingIn}>
        Sign in
      </Button>
    </form>
  );
};
