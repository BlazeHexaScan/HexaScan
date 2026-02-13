module.exports = {
  apps: [
    {
      name: 'hexascan-backend',
      cwd: '/home/sysadmin/HexaScan/backend',
      script: 'dist/index.js',
      instances: 1,  // Changed to 1 instance for simpler debugging
      exec_mode: 'fork',  // Changed to fork mode
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
        HOST: '0.0.0.0',
      },
      error_file: '/home/sysadmin/HexaScan/logs/backend-error.log',
      out_file: '/home/sysadmin/HexaScan/logs/backend-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      max_memory_restart: '1G',
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s',
      watch: false,
    },
    {
      name: 'hexascan-frontend',
      cwd: '/home/sysadmin/HexaScan/frontend',
      script: 'npx',
      args: 'serve -s dist -l 5173 -n',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
      },
      error_file: '/home/sysadmin/HexaScan/logs/frontend-error.log',
      out_file: '/home/sysadmin/HexaScan/logs/frontend-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      autorestart: true,
      watch: false,
    },
  ],
};
