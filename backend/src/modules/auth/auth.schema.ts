import { z } from 'zod';

// Registration schema
export const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])/,
      'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'
    ),
  name: z.string().min(2, 'Name must be at least 2 characters'),
  organizationName: z.string().min(2, 'Organization name must be at least 2 characters'),
});

export type RegisterInput = z.infer<typeof registerSchema>;

// Login schema
export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
  totpCode: z.string().length(6).optional(),
});

export type LoginInput = z.infer<typeof loginSchema>;

// Refresh token schema
export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

export type RefreshTokenInput = z.infer<typeof refreshTokenSchema>;

// TOTP setup schema
export const setupTotpSchema = z.object({
  totpCode: z.string().length(6, 'TOTP code must be 6 digits'),
});

export type SetupTotpInput = z.infer<typeof setupTotpSchema>;

// TOTP verify schema
export const verifyTotpSchema = z.object({
  totpCode: z.string().length(6, 'TOTP code must be 6 digits'),
});

export type VerifyTotpInput = z.infer<typeof verifyTotpSchema>;

// Password reset request schema
export const passwordResetRequestSchema = z.object({
  email: z.string().email('Invalid email address'),
});

export type PasswordResetRequestInput = z.infer<typeof passwordResetRequestSchema>;

// Password reset schema
export const passwordResetSchema = z.object({
  token: z.string().min(1, 'Reset token is required'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])/,
      'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'
    ),
});

export type PasswordResetInput = z.infer<typeof passwordResetSchema>;

// Logout schema
export const logoutSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

export type LogoutInput = z.infer<typeof logoutSchema>;

// Update profile schema
export const updateProfileSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

// Change password schema
export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])/,
      'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'
    ),
});

export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
