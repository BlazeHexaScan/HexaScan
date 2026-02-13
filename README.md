# HexaScan

A comprehensive website and server monitoring platform with real-time health checks, alerting, escalation management, and an installable agent for internal metrics.

## Features

### Monitoring
- **Web Monitoring** - Combined uptime, SSL certificate, and response time checks with sensible defaults
- **PageSpeed Insights** - Google PageSpeed API integration with Core Web Vitals and mobile/desktop comparison
- **System Health** - CPU, memory, disk usage, and service status monitoring via agent
- **Magento 2 Health** - Orders, version, security patches, database size, customers, disk usage
- **WordPress Health** - Version, plugins, themes, database, disk, security, cache, WooCommerce stats
- **Filesystem Integrity** - Checksum-based file change detection with optional Git status integration
- **Log Monitoring** - Raw log display for Magento, WordPress, and system logs
- **Critical Flows** - Playwright browser automation for checkout and custom user flows
- **Custom Scripts** - User-defined bash scripts with security sandboxing
- **Repository Security Scanner** - Scan public Git repos for hardcoded secrets, backdoors, injection vulnerabilities, and dependency issues

### Alerting & Escalation
- **Telegram Notifications** - Instant alerts with 30-minute cooldown and recovery notifications
- **Email Notifications** - SMTP-based email alerts with HTML formatting
- **Escalation Matrix** - Multi-level escalation (L1 → L2 → L3) with automatic time-based escalation and public issue pages

### Platform
- Site management with weighted health scoring (Magento 2, WordPress, Generic)
- Agent management with API key authentication and installation instructions
- User authentication with JWT access/refresh tokens
- User profile page with name editing and password change
- BullMQ job queue for scheduled and manual check execution
- Multi-tenant organization support with role-based access (SUPER_ADMIN, ADMIN, MEMBER, VIEWER)
- **Plans & Payments** - Stripe Checkout integration with Free, Cloud, Self-Hosted, and Enterprise tiers
- **Super Admin Panel** - Platform-wide user, organization, site, and payment management
- **Dynamic System Configuration** - ~40 runtime settings configurable via Admin Panel (escalation timing, health thresholds, worker concurrency, etc.)

## Screenshots

<table>
  <tr>
    <td><img src="readme-assets/1.png" alt="Sites" width="100%"></td>
    <td><img src="readme-assets/2.png" alt="Monitors" width="100%"></td>
  </tr>
  <tr>
    <td><img src="readme-assets/3.png" alt="Page Speed" width="100%"></td>
    <td><img src="readme-assets/4.png" alt="Magento Health" width="100%"></td>
  </tr>
  <tr>
    <td><img src="readme-assets/5.png" alt="System Health" width="100%"></td>
    <td><img src="readme-assets/6.png" alt="Website Overview" width="100%"></td>
  </tr>
</table>

## Tech Stack

- **Backend:** Fastify 5, TypeScript, Prisma ORM, PostgreSQL, Redis, BullMQ
- **Frontend:** React 18, Vite, TypeScript, Tailwind CSS, Zustand, TanStack Query
- **Agent:** Python 3.8+, psutil, Playwright, mysql-connector-python

## Quick Start

### 1. Start Database Services

```bash
cd backend
docker compose up -d
```

This starts PostgreSQL on port 5433 and Redis on port 6379.

### 2. Setup Backend

```bash
cd backend
npm install
cp .env.example .env
```

Edit `.env` and set your values:

```env
# Server
NODE_ENV=development
PORT=3000
HOST=0.0.0.0

# Database
DATABASE_URL="postgresql://hexascan:changeme@localhost:5433/hexascan?schema=public&connection_limit=10&pool_timeout=20"

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# Security (generate with: openssl rand -base64 32)
JWT_SECRET=your-secret-key-min-32-characters
JWT_REFRESH_SECRET=your-refresh-secret-min-32-characters
ENCRYPTION_SECRET=your-encryption-secret-min-32-characters

# CORS (comma-separated list of allowed origins)
CORS_ORIGIN=http://localhost:5173

# Frontend URL for notification links (Telegram "View Dashboard", email links)
# If not set, falls back to first CORS origin
FRONTEND_URL=

# Rate Limiting
RATE_LIMIT_GLOBAL=100
RATE_LIMIT_AUTH=10
RATE_LIMIT_API=100

# Google PageSpeed API key (optional, higher rate limits with key)
GOOGLE_PAGESPEED_API_KEY=

# Super Admin (user with this email gets SUPER_ADMIN role on login)
SUPER_ADMIN_EMAIL=

# Stripe (optional, for plan payments)
STRIPE_SECRET_KEY=
STRIPE_PUBLISHABLE_KEY=
STRIPE_WEBHOOK_SECRET=

# SMTP for email notifications (optional)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=
SMTP_PASSWORD=
SMTP_SECURE=false
SMTP_FROM_ADDRESS=alerts@yourdomain.com
SMTP_FROM_NAME=HexaScan
```

Run migrations and start the server:

```bash
npx prisma migrate dev
npx prisma generate
npm run dev
```

Backend runs at http://localhost:3000

### 3. Setup Frontend

```bash
cd frontend
npm install
cp .env.example .env
```

The default `.env` works for local development:

```env
VITE_API_URL=http://localhost:3000/api/v1
VITE_APP_VERSION=0.1.0
```

Start the development server:

```bash
npm run dev
```

Frontend runs at http://localhost:5173

### 4. Setup Agent (Optional)

The agent runs on target servers to collect internal metrics (CPU, memory, disk, logs, CMS health, etc.).

#### From the Dashboard

1. Go to **Agents** page and click **Create Agent**
2. Copy the generated API key
3. Follow the installation instructions shown on the page

#### Manual Installation

On the target server:

```bash
cd agent
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

Create config file at `/etc/hexascan-agent/agent.yaml`:

```yaml
agent:
  name: "my-server"

api:
  endpoint: "https://your-api-domain.com/api/v1"
  api_key_source: "file"
  api_key_file: "/etc/hexascan-agent/api_key"
  poll_interval: 60

permissions:
  level: "read_only"
  allowed_paths:
    - "/var/log"
    - "/var/www"
```

Save your API key to `/etc/hexascan-agent/api_key` and start the agent:

```bash
python -m hexascan_agent
```

The agent installs to `/opt/hexascan-agent/` and runs as a systemd service.

## Monitor Types

### External (No Agent Required)

| Type | Description |
|------|-------------|
| Web Monitoring | Combined HTTP uptime, SSL certificate validation, and response time |
| PageSpeed | Google PageSpeed Insights with Lighthouse scores and Core Web Vitals |
| Critical Flows (Playwright) | Custom Playwright scripts for browser-based flow testing |

### Agent-Based

| Type | Description |
|------|-------------|
| System Health | CPU, memory, disk, service status |
| Magento 2 Health | Orders, version, security, database, customers, disk |
| WordPress Health | Version, plugins, themes, database, security, WooCommerce |
| Filesystem Integrity | Checksum-based change detection with optional Git status |
| Log Monitoring | Raw log display for application and system logs |
| Critical Flows (Magento) | Automated Magento checkout flow testing |
| Custom Script | User-defined bash scripts with security restrictions |

### Repository Scanner

Scan public Git repositories for security issues:
- Hardcoded secrets and API keys
- Backdoors and reverse shells
- SQL/command injection vulnerabilities
- Obfuscated code and crypto miners
- Data exfiltration patterns
- Dependency vulnerabilities (via OSV database)

## Notification Channels

### Telegram
1. Create a bot via [@BotFather](https://t.me/BotFather) and get the bot token
2. Get your chat ID (send a message to the bot, then check the API)
3. Add a Telegram channel in the **Notifications** page with bot token and chat ID

### Email
SMTP settings are configured in the backend `.env` file. Users only need to specify recipient email addresses when creating a channel.

For Gmail, use an [App Password](https://myaccount.google.com/apppasswords) as `SMTP_PASSWORD`.

## Escalation Matrix

Configure per-site escalation in **Site Settings**:

1. Enable escalation for the site
2. Set Level 1, 2, and 3 email addresses
3. When a monitor returns CRITICAL/ERROR, Level 1 is notified
4. If not acknowledged within the escalation window, Level 2 is notified
5. If still unresolved, Level 3 is notified
6. Each level receives an email with a link to a public issue page where they can acknowledge/resolve

## Health Score

Health score is a weighted average of all enabled monitor results (0-100):

| Status | Score | Weight (Critical monitors) | Weight (Standard) |
|--------|-------|---------------------------|-------------------|
| Passed | 100 | 2.0 | 1.0 |
| Warning | 70 | 2.0 | 1.0 |
| Critical | 30 | 2.0 | 1.0 |
| Error | 0 | 2.0 | 1.0 |

Informational monitors (Custom Script, Log Monitoring, Filesystem Integrity) are excluded from health score calculation.

## Required Ports

| Port | Service |
|------|---------|
| 3000 | Backend API |
| 5173 | Frontend dev server |
| 5433 | PostgreSQL |
| 6379 | Redis |

## Author

Developed with ❤️ by [BlazeHexa](https://blazehexa.com/)
