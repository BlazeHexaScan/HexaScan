/**
 * Repo Scanner Validation Schemas
 */

import { z } from 'zod';

/**
 * Git URL validation regex
 * Supports: https://github.com/user/repo.git, git@github.com:user/repo.git, etc.
 */
const gitUrlRegex = /^(https?:\/\/|git@)[\w.-]+(:\d+)?[/:]([\w.-]+\/)*[\w.-]+(\.git)?$/;

const platformEnum = z.enum(['GITHUB', 'GITLAB', 'BITBUCKET', 'AZURE_DEVOPS', 'OTHER']);

/**
 * Block internal/private IP ranges to prevent SSRF
 */
const internalPatterns = [
  /^https?:\/\/localhost/i,
  /^https?:\/\/127\./,
  /^https?:\/\/10\./,
  /^https?:\/\/172\.(1[6-9]|2\d|3[01])\./,
  /^https?:\/\/192\.168\./,
  /^https?:\/\/0\./,
  /^https?:\/\/169\.254\./,
  /^https?:\/\/\[::1\]/,
  /^https?:\/\/\[fe80:/i,
  /^https?:\/\/\[fc/i,
  /^https?:\/\/\[fd/i,
];

function isInternalUrl(url: string): boolean {
  return internalPatterns.some(pattern => pattern.test(url));
}

/**
 * Create repository schema
 */
export const createRepositorySchema = z.object({
  name: z
    .string()
    .min(1, 'Name is required')
    .max(100, 'Name must be 100 characters or less'),
  url: z
    .string()
    .min(1, 'Git URL is required')
    .regex(gitUrlRegex, 'Invalid Git URL format. Use HTTPS or SSH format.')
    .refine(url => !isInternalUrl(url), 'Repository URL cannot point to internal/private networks'),
  branch: z
    .string()
    .max(100, 'Branch must be 100 characters or less')
    .regex(/^[a-zA-Z0-9._\/-]+$/, 'Branch name contains invalid characters')
    .optional()
    .default('main'),
  isPrivate: z.boolean().optional().default(false),
  platform: platformEnum.optional(),
  accessToken: z.string().max(500).optional(),
}).refine(
  (data) => {
    if (data.isPrivate) {
      return !!data.accessToken;
    }
    return true;
  },
  {
    message: 'Access token is required for private repositories',
    path: ['accessToken'],
  }
);

/**
 * Update repository schema
 */
export const updateRepositorySchema = z.object({
  name: z
    .string()
    .min(1)
    .max(100)
    .optional(),
  branch: z
    .string()
    .max(100)
    .optional(),
  isPrivate: z.boolean().optional(),
  platform: platformEnum.optional(),
  accessToken: z.string().max(500).optional(),
  removeToken: z.boolean().optional(),
});

/**
 * Start scan schema
 */
export const startScanSchema = z.object({
  repositoryId: z.string().cuid('Invalid repository ID'),
});

/**
 * Repository ID param schema
 */
export const repositoryIdParamSchema = z.object({
  id: z.string().cuid('Invalid repository ID'),
});

/**
 * Scan ID param schema
 */
export const scanIdParamSchema = z.object({
  id: z.string().cuid('Invalid scan ID'),
});

/**
 * List query schema
 */
export const listQuerySchema = z.object({
  limit: z.coerce.number().min(1).max(100).optional().default(20),
  offset: z.coerce.number().min(0).optional().default(0),
});

export type CreateRepositoryInput = z.infer<typeof createRepositorySchema>;
export type UpdateRepositoryInput = z.infer<typeof updateRepositorySchema>;
export type StartScanInput = z.infer<typeof startScanSchema>;
export type ListQueryInput = z.infer<typeof listQuerySchema>;
