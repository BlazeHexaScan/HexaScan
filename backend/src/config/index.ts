import 'dotenv/config';
import { z } from 'zod';

// Environment variable schema
const envSchema = z.object({
  // Server
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().default('3000').transform(Number),
  HOST: z.string().default('0.0.0.0'),

  // Database
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),

  // Redis
  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.string().default('6379').transform(Number),
  REDIS_PASSWORD: z.string().optional(),

  // Security
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET must be at least 32 characters'),
  ENCRYPTION_SECRET: z.string().min(32, 'ENCRYPTION_SECRET must be at least 32 characters'),

  // CORS (comma-separated list of allowed origins)
  CORS_ORIGIN: z.string().default('http://localhost:5173'),

  // Frontend URL for notification links (should be the public URL of your frontend)
  FRONTEND_URL: z.string().optional(),

  // Rate Limiting
  RATE_LIMIT_GLOBAL: z.string().default('100').transform(Number),
  RATE_LIMIT_AUTH: z.string().default('10').transform(Number),
  RATE_LIMIT_API: z.string().default('100').transform(Number),

  // External API Keys
  GOOGLE_PAGESPEED_API_KEY: z.string().optional(),

  // Super Admin
  SUPER_ADMIN_EMAIL: z.string().optional(),

  // Stripe
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_PUBLISHABLE_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),

  // SMTP Settings for Email Notifications
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.string().default('587').transform(Number),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  SMTP_SECURE: z.string().default('false').transform((val) => val === 'true'),
  SMTP_FROM_ADDRESS: z.string().optional(),
  SMTP_FROM_NAME: z.string().default('HexaScan'),
});

// Parse and validate environment variables
function loadConfig() {
  const parsed = envSchema.safeParse(process.env);

  if (!parsed.success) {
    console.error('Configuration validation failed:');
    console.error(parsed.error.format());
    process.exit(1);
  }

  return parsed.data;
}

const env = loadConfig();

// Export typed configuration
export const config = {
  env: env.NODE_ENV,
  isDevelopment: env.NODE_ENV === 'development',
  isProduction: env.NODE_ENV === 'production',
  isTest: env.NODE_ENV === 'test',

  server: {
    port: env.PORT,
    host: env.HOST,
  },

  database: {
    url: env.DATABASE_URL,
  },

  redis: {
    host: env.REDIS_HOST,
    port: env.REDIS_PORT,
    password: env.REDIS_PASSWORD,
  },

  security: {
    jwtSecret: env.JWT_SECRET,
    jwtRefreshSecret: env.JWT_REFRESH_SECRET,
    encryptionSecret: env.ENCRYPTION_SECRET,
  },

  cors: {
    // Split comma-separated origins and trim whitespace
    origins: env.CORS_ORIGIN.split(',').map(origin => origin.trim()),
  },

  // Frontend URL for notification links (falls back to first CORS origin)
  frontendUrl: env.FRONTEND_URL || env.CORS_ORIGIN.split(',')[0].trim(),

  rateLimit: {
    global: env.RATE_LIMIT_GLOBAL,
    auth: env.RATE_LIMIT_AUTH,
    api: env.RATE_LIMIT_API,
  },

  externalApis: {
    googlePageSpeedApiKey: env.GOOGLE_PAGESPEED_API_KEY,
  },

  superAdminEmail: env.SUPER_ADMIN_EMAIL,

  stripe: {
    secretKey: env.STRIPE_SECRET_KEY,
    publishableKey: env.STRIPE_PUBLISHABLE_KEY,
    webhookSecret: env.STRIPE_WEBHOOK_SECRET,
  },

  smtp: {
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    user: env.SMTP_USER,
    password: env.SMTP_PASSWORD,
    secure: env.SMTP_SECURE,
    fromAddress: env.SMTP_FROM_ADDRESS,
    fromName: env.SMTP_FROM_NAME,
  },
} as const;
