# HexaScan Frontend

React 18 frontend for the HexaScan website and server monitoring platform.

## Tech Stack

- React 18 with TypeScript
- Vite build tool
- Tailwind CSS
- Zustand + TanStack Query for state
- React Router v6
- Axios HTTP client
- Lucide React icons

## Quick Start

```bash
npm install
cp .env.example .env
npm run dev
```

Frontend runs at http://localhost:5173

## Environment Variables

```
VITE_API_URL=http://localhost:3000/api/v1
VITE_WS_URL=ws://localhost:3000/ws
VITE_APP_NAME=HexaScan
```

## Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint

## Features

- User authentication with JWT
- Site management dashboard
- Monitor configuration and results
- Agent management
- Telegram notifications
- Dark mode support
- Responsive design
