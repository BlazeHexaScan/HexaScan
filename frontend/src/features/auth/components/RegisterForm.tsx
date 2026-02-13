import { FormEvent, useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { Button, Input } from '@/components/ui';
import { getValidationErrors } from '@/lib/api/client';

/**
 * Registration form component
 */
export const RegisterForm = () => {
  const { register, isRegistering, registerError, registerMutationError } = useAuth();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    organizationName: '',
    password: '',
    confirmPassword: '',
  });
  const [validationError, setValidationError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Extract field-level validation errors from backend response
  useEffect(() => {
    if (registerMutationError) {
      const validationErrors = getValidationErrors(registerMutationError);
      if (validationErrors) {
        setFieldErrors(validationErrors);
      } else {
        setFieldErrors({});
      }
    } else {
      setFieldErrors({});
    }
  }, [registerMutationError]);

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setValidationError('');
    setFieldErrors({});

    // Validate passwords match
    if (formData.password !== formData.confirmPassword) {
      setValidationError('Passwords do not match');
      return;
    }

    // Validate password strength
    if (formData.password.length < 8) {
      setValidationError('Password must be at least 8 characters long');
      return;
    }

    // Validate password complexity
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])/;
    if (!passwordRegex.test(formData.password)) {
      setValidationError('Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character (@$!%*?&)');
      return;
    }

    register({
      name: formData.name,
      email: formData.email,
      organizationName: formData.organizationName,
      password: formData.password,
    });
  };

  const handleChange = (field: keyof typeof formData) => (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    setFormData((prev) => ({ ...prev, [field]: e.target.value }));
    // Clear field error when user starts typing
    if (fieldErrors[field]) {
      setFieldErrors((prev) => {
        const updated = { ...prev };
        delete updated[field];
        return updated;
      });
    }
  };

  const error = validationError || (registerError && Object.keys(fieldErrors).length === 0 ? registerError : '');

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          Create your account
        </h2>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
          Already have an account?{' '}
          <Link
            to="/login"
            className="font-medium text-brand-600 hover:text-brand-500 dark:text-brand-400"
          >
            Sign in
          </Link>
        </p>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
        </div>
      )}

      <div className="space-y-4">
        <Input
          label="Full name"
          type="text"
          autoComplete="name"
          required
          fullWidth
          value={formData.name}
          onChange={handleChange('name')}
          placeholder="John Doe"
          disabled={isRegistering}
          error={fieldErrors.name}
        />

        <Input
          label="Email address"
          type="email"
          autoComplete="email"
          required
          fullWidth
          value={formData.email}
          onChange={handleChange('email')}
          placeholder="you@example.com"
          disabled={isRegistering}
          error={fieldErrors.email}
        />

        <Input
          label="Organization name"
          type="text"
          autoComplete="organization"
          required
          fullWidth
          value={formData.organizationName}
          onChange={handleChange('organizationName')}
          placeholder="Acme Inc."
          helperText={!fieldErrors.organizationName ? "This will be your workspace name" : undefined}
          disabled={isRegistering}
          error={fieldErrors.organizationName}
        />

        <Input
          label="Password"
          type="password"
          autoComplete="new-password"
          required
          fullWidth
          value={formData.password}
          onChange={handleChange('password')}
          placeholder="Minimum 8 characters"
          helperText={!fieldErrors.password ? "Use 8 or more characters with a mix of letters, numbers & symbols, include uppercase" : undefined}
          disabled={isRegistering}
          error={fieldErrors.password}
        />

        <Input
          label="Confirm password"
          type="password"
          autoComplete="new-password"
          required
          fullWidth
          value={formData.confirmPassword}
          onChange={handleChange('confirmPassword')}
          placeholder="Re-enter your password"
          disabled={isRegistering}
        />
      </div>

      <div className="flex items-start">
        <div className="flex items-center h-5">
          <input
            id="terms"
            name="terms"
            type="checkbox"
            required
            className="h-4 w-4 text-brand-600 focus:ring-brand-500 border-gray-300 rounded"
            disabled={isRegistering}
          />
        </div>
        <div className="ml-3 text-sm">
          <label htmlFor="terms" className="text-gray-700 dark:text-gray-300">
            I agree to the{' '}
            <a
              href="#"
              className="font-medium text-brand-600 hover:text-brand-500 dark:text-brand-400"
            >
              Terms of Service
            </a>{' '}
            and{' '}
            <a
              href="#"
              className="font-medium text-brand-600 hover:text-brand-500 dark:text-brand-400"
            >
              Privacy Policy
            </a>
          </label>
        </div>
      </div>

      <Button type="submit" fullWidth isLoading={isRegistering}>
        Create account
      </Button>
    </form>
  );
};
