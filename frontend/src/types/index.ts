/**
 * Central exports for all TypeScript types
 */

export * from './site';
export * from './check';
export * from './dashboard';
export * from './agent';
export * from './notification';
export * from './contact';
export * from './repo-scanner';
export * from './admin';
export * from './plan';

/**
 * Generic API response wrapper
 */
export interface ApiResponse<T> {
  success: boolean;
  data: T;
}

/**
 * Paginated API response
 */
export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
