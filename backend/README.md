# HexaScan Backend

Fastify API for the HexaScan website and server monitoring platform.

## Tech Stack

- Fastify 5.x with TypeScript
- PostgreSQL with Prisma ORM
- Redis with ioredis
- BullMQ job queue
- JWT authentication
- Zod validation
- Nodemailer (email notifications)
- Playwright (browser-based monitors)

## Quick Start

```bash
npm install
cp .env.example .env
npx prisma migrate dev
npx prisma generate
npm run dev
```

Backend runs at http://localhost:3000

## Environment Variables

Copy `.env.example` to `.env` and configure:

### Required

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@localhost:5432/hexascan?schema=public&connection_limit=10&pool_timeout=20` |
| `JWT_SECRET` | JWT signing key (min 32 chars) | Generate with `openssl rand -base64 32` |
| `JWT_REFRESH_SECRET` | Refresh token key (min 32 chars) | Generate with `openssl rand -base64 32` |
| `ENCRYPTION_SECRET` | Encryption key (min 32 chars) | Generate with `openssl rand -base64 32` |

### Server

| Variable | Default | Description |
|----------|---------|-------------|
| `NODE_ENV` | `development` | Environment (`development`, `production`, `test`) |
| `PORT` | `3000` | Server port |
| `HOST` | `0.0.0.0` | Server host |

### Redis

| Variable | Default | Description |
|----------|---------|-------------|
| `REDIS_HOST` | `localhost` | Redis host |
| `REDIS_PORT` | `6379` | Redis port |
| `REDIS_PASSWORD` | _(empty)_ | Redis password (optional) |

### CORS & Frontend

| Variable | Default | Description |
|----------|---------|-------------|
| `CORS_ORIGIN` | `http://localhost:5173` | Comma-separated allowed origins |
| `FRONTEND_URL` | _(first CORS origin)_ | Public frontend URL for notification links |

### Rate Limiting

| Variable | Default | Description |
|----------|---------|-------------|
| `RATE_LIMIT_GLOBAL` | `100` | Global requests per minute |
| `RATE_LIMIT_AUTH` | `10` | Auth endpoint requests per minute per IP |
| `RATE_LIMIT_API` | `100` | API requests per minute per user |

### Optional Services

| Variable | Description |
|----------|-------------|
| `GOOGLE_PAGESPEED_API_KEY` | Google PageSpeed Insights API key (works without but lower rate limits) |
| `SUPER_ADMIN_EMAIL` | User with this email gets SUPER_ADMIN role on login |
| `STRIPE_SECRET_KEY` | Stripe secret key for plan payments |
| `STRIPE_PUBLISHABLE_KEY` | Stripe publishable key |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret |

### SMTP (Email Notifications)

| Variable | Default | Description |
|----------|---------|-------------|
| `SMTP_HOST` | `smtp.gmail.com` | SMTP server host |
| `SMTP_PORT` | `587` | SMTP server port |
| `SMTP_USER` | _(empty)_ | SMTP username |
| `SMTP_PASSWORD` | _(empty)_ | SMTP password (use App Password for Gmail) |
| `SMTP_SECURE` | `false` | Use TLS (`true`/`false`) |
| `SMTP_FROM_ADDRESS` | _(empty)_ | Sender email address |
| `SMTP_FROM_NAME` | `HexaScan` | Sender display name |

> **Note:** JWT access and refresh token expiry durations are configured via the Admin Panel (System Config), not environment variables. Defaults: `1d` (access), `7d` (refresh).

## Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm start` - Start production server
- `npx prisma migrate dev` - Run migrations
- `npx prisma studio` - Open Prisma Studio
- `npm run db:generate` - Generate Prisma client
- `npm run db:seed` - Seed demo data

## Features

### Authentication & Authorization
- JWT access tokens with opaque refresh tokens
- Role-based access: `SUPER_ADMIN`, `ADMIN`, `MEMBER`, `VIEWER`
- Super Admin auto-promotion via `SUPER_ADMIN_EMAIL` env var
- User profile management (name edit, password change)

### Multi-Tenancy
- Organizations with isolated data
- Teams with user and site assignment
- Per-organization quotas (sites, agents, monitors)

### Site Management
- CRUD operations with health score tracking
- Site types: Magento 2, WordPress, Custom, Generic
- Automatic health score calculation (weighted average of monitor results)
- Manual and scheduled scan execution

### Monitor Types

#### External Monitors (run by backend)

| Type | Description |
|------|-------------|
| `WEB_MONITORING` | Combined uptime, response time, and SSL certificate check |
| `PAGE_SPEED` | Google PageSpeed Insights with Core Web Vitals (mobile + desktop) |
| `PLAYWRIGHT_CRITICAL_FLOWS` | Custom Playwright scripts for browser-based flow testing |

#### Agent-Based Monitors (run by deployed agents)

| Type | Description |
|------|-------------|
| `SYSTEM_HEALTH` | CPU, memory, disk, load average, services status |
| `LOG_MONITORING` | Raw log display for Magento, WordPress, and system logs |
| `FILESYSTEM_INTEGRITY` | Checksum-based file change detection with optional Git status |
| `MAGENTO_HEALTH` | Orders, version, security, database size, disk usage, customers |
| `WORDPRESS_HEALTH` | Version, plugins, themes, security, database, WooCommerce stats |
| `CRITICAL_FLOWS` | Magento 2 checkout flow simulation via Playwright |
| `CUSTOM` | User-defined bash scripts with security restrictions |

### Check Execution Engine
- BullMQ queue with automatic retry (3 attempts: 30s, 60s, 120s)
- Cron-based recurring schedules
- Concurrent execution with rate limiting
- Health score updates after each result

### Agent System
- Python monitoring agent deployed to target servers
- API key authentication with heartbeat
- Task polling and result submission
- System checks: disk, CPU, memory, logs, filesystem integrity
- CMS checks: Magento 2 health, WordPress health
- Browser checks: Playwright-based critical flow testing

### Notifications
- **Telegram**: Bot token + chat ID, formatted messages with status emojis
- **Email**: SMTP-based with HTML templates, recipient-only config per channel
- 30-minute cooldown to prevent spam
- Recovery notifications when issues resolve
- Alert records stored in database

### Escalation Matrix
- Automatic escalation through 3 contact levels
- Configurable escalation window (default 10 minutes)
- Public token-based issue pages (no login required)
- Level-based access control (lower levels locked out after escalation)
- Email notifications at each escalation level
- Status tracking: Open, Acknowledged, In Progress, Resolved, Exhausted

### Repository Security Scanner
- Scan public Git repositories for security vulnerabilities
- Detects: hardcoded secrets, backdoors, injection, obfuscation, crypto miners
- Dependency vulnerability checking via Google OSV API
- Supports: PHP, JavaScript/TypeScript, Python
- BullMQ queue for async scanning
- Scan history with severity/category filtering

### Plans & Payments
- Stripe Checkout integration for plan upgrades
- Plan tiers: Free, Cloud, Self-Hosted, Enterprise
- Payment history and subscription tracking
- Webhook handler with idempotency protection

### Super Admin Panel
- Dashboard with platform-wide statistics
- User management (list, edit role, delete)
- Organization overview with plan/subscription info
- All sites view across organizations
- Payment history with filters and stats
- System Configuration (~40 settings across 9 categories)

### Dynamic System Configuration
- ~40 previously hardcoded values stored in `SystemConfig` database table
- Editable via Admin Panel UI
- Categories: escalation, alerts, healthScore, webMonitoring, checkExecution, repoScanner, agent, auth, pageSpeedPlaywright
- Public config endpoint for frontend (`GET /api/v1/config/public`)

## API Endpoints

### Authentication
| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/v1/auth/register` | POST | No | Register user + organization |
| `/api/v1/auth/login` | POST | No | Login, returns tokens |
| `/api/v1/auth/refresh` | POST | No | Refresh access token |
| `/api/v1/auth/logout` | POST | Yes | Invalidate refresh token |
| `/api/v1/auth/me` | GET | Yes | Get current user |
| `/api/v1/auth/profile` | PATCH | Yes | Update name |
| `/api/v1/auth/change-password` | POST | Yes | Change password |

### Sites
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/sites` | GET | List sites for organization |
| `/api/v1/sites` | POST | Create site |
| `/api/v1/sites/:id` | GET | Get site details |
| `/api/v1/sites/:id` | PATCH | Update site |
| `/api/v1/sites/:id` | DELETE | Delete site |
| `/api/v1/sites/:id/scan` | POST | Run all monitors |

### Monitors (Checks)
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/checks/types` | GET | List monitor types |
| `/api/v1/checks/sites/:siteId/checks` | GET | Get monitors for site |
| `/api/v1/checks` | POST | Create monitor |
| `/api/v1/checks/:id` | PATCH | Update monitor |
| `/api/v1/checks/:id` | DELETE | Delete monitor |
| `/api/v1/checks/:id/run` | POST | Run monitor |

### Check Results
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/sites/:siteId/results` | GET | Results for site |
| `/api/v1/checks/:id/results` | GET | Results for monitor |

### Agents
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/agents` | GET | List agents |
| `/api/v1/agents` | POST | Create agent (returns API key) |
| `/api/v1/agents/:id` | GET | Get agent details |
| `/api/v1/agents/:id` | PATCH | Update agent |
| `/api/v1/agents/:id` | DELETE | Delete agent |
| `/api/v1/agents/:id/regenerate-key` | POST | Regenerate API key |

### Agent Communication
| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/v1/agent/heartbeat` | POST | Agent Key | Send heartbeat |
| `/api/v1/agent/tasks` | GET | Agent Key | Poll for tasks |
| `/api/v1/agent/tasks/:id/complete` | POST | Agent Key | Submit results |

### Notifications
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/notifications` | GET | List channels |
| `/api/v1/notifications` | POST | Create channel |
| `/api/v1/notifications/:id` | GET | Get channel |
| `/api/v1/notifications/:id` | PATCH | Update channel |
| `/api/v1/notifications/:id` | DELETE | Delete channel |
| `/api/v1/notifications/:id/test` | POST | Send test notification |

### Escalations
| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/v1/escalations` | GET | Yes | List escalation issues |
| `/api/v1/escalations/:id` | GET | Yes | Get issue by ID |
| `/api/v1/escalations/public/:token` | GET | No | Get issue by token |
| `/api/v1/escalations/public/:token/viewed` | POST | No | Record view |
| `/api/v1/escalations/public/:token/status` | POST | No | Update status |

### Repository Scanner
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/repo-scanner/repositories` | GET | List repositories |
| `/api/v1/repo-scanner/repositories` | POST | Add repository |
| `/api/v1/repo-scanner/repositories/:id` | GET | Get repository |
| `/api/v1/repo-scanner/repositories/:id` | PATCH | Update repository |
| `/api/v1/repo-scanner/repositories/:id` | DELETE | Delete repository |
| `/api/v1/repo-scanner/repositories/:id/scan` | POST | Start scan |
| `/api/v1/repo-scanner/repositories/:id/scans` | GET | Scan history |
| `/api/v1/repo-scanner/scans/:id/progress` | GET | Scan progress |
| `/api/v1/repo-scanner/scans/:id` | GET | Scan results |

### Plans & Payments
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/plans/current` | GET | Get current plan |
| `/api/v1/plans/checkout` | POST | Create Stripe checkout session |
| `/api/v1/plans/verify` | POST | Verify checkout session |
| `/api/v1/plans/webhook` | POST | Stripe webhook handler |

### Dashboard
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/dashboard/overview` | GET | Dashboard stats |

### Admin (Super Admin only)
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/admin/dashboard` | GET | Platform-wide stats |
| `/api/v1/admin/users` | GET | List all users |
| `/api/v1/admin/users/:id` | GET | User details |
| `/api/v1/admin/users/:id` | PATCH | Edit user |
| `/api/v1/admin/users/:id` | DELETE | Delete user |
| `/api/v1/admin/organizations` | GET | List all organizations |
| `/api/v1/admin/organizations/:id` | GET | Organization details |
| `/api/v1/admin/sites` | GET | List all sites |
| `/api/v1/admin/payments` | GET | List all payments |
| `/api/v1/admin/payments/stats` | GET | Payment statistics |
| `/api/v1/admin/config` | GET | Get system config |
| `/api/v1/admin/config` | PATCH | Update system config |
| `/api/v1/admin/config/reset/:key` | POST | Reset config to default |

### Public
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/config/public` | GET | Health score thresholds for frontend |

## Project Structure

```
backend/
├── prisma/
│   └── schema.prisma          # Database schema
├── src/
│   ├── config/                # Environment config with Zod validation
│   ├── core/
│   │   ├── alerts/            # Alert trigger service
│   │   ├── checks/            # Check execution engine + implementations
│   │   ├── config/            # SystemConfig service (dynamic settings)
│   │   ├── database/          # Prisma client singleton
│   │   ├── encryption/        # AES-256-GCM encryption utils
│   │   ├── queue/             # BullMQ queue manager
│   │   └── security-scanner/  # Repo scanner engine + patterns
│   ├── modules/
│   │   ├── admin/             # Super admin panel
│   │   ├── agents/            # Agent management + communication
│   │   ├── auth/              # Authentication + profile
│   │   ├── check-results/     # Monitor results
│   │   ├── checks/            # Monitor configuration
│   │   ├── dashboard/         # Dashboard stats
│   │   ├── escalations/       # Escalation matrix
│   │   ├── notifications/     # Telegram + Email channels
│   │   ├── organizations/     # Organization management
│   │   ├── plans/             # Plans + Stripe payments
│   │   ├── repo-scanner/      # Repository security scanner
│   │   ├── sites/             # Site management
│   │   ├── teams/             # Team management
│   │   └── users/             # User management
│   ├── shared/
│   │   ├── middleware/        # Auth, rate limiting
│   │   └── utils/             # Password, quota, script security
│   ├── app.ts                 # Fastify app with route registration
│   └── index.ts               # Server entry point
└── .env.example               # Environment variable template
```
