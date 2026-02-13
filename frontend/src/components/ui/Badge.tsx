import { HTMLAttributes, forwardRef } from 'react';
import { clsx } from 'clsx';

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'critical';
  size?: 'sm' | 'md' | 'lg';
}

/**
 * Badge component for displaying status indicators and labels
 */
export const Badge = forwardRef<HTMLSpanElement, BadgeProps>(
  ({ children, variant = 'default', size = 'md', className, ...props }, ref) => {
    const baseClasses = 'inline-flex items-center font-medium rounded-full';

    const variantClasses = {
      default:
        'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
      success:
        'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
      warning:
        'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
      danger:
        'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
      critical:
        'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300',
      info:
        'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
    };

    const sizeClasses = {
      sm: 'px-2 py-0.5 text-xs',
      md: 'px-2.5 py-1 text-sm',
      lg: 'px-3 py-1.5 text-base',
    };

    return (
      <span
        ref={ref}
        className={clsx(
          baseClasses,
          variantClasses[variant],
          sizeClasses[size],
          className
        )}
        {...props}
      >
        {children}
      </span>
    );
  }
);

Badge.displayName = 'Badge';
