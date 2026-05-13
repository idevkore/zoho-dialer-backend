const fs = require('node:fs');
const path = require('node:path');

/**
 * PM2 config for Laravel Forge (or any host running PM2).
 * Deploy: `pm2 restart zoho-dialer-backend --update-env` or first-time
 * `pm2 start ecosystem.config.cjs --update-env --env production`
 *
 * Fixed log paths under `storage/logs/` so you can always:
 *   tail -f storage/logs/pm2-error.log
 * from the app root (`current/` on Forge), instead of hunting `~/.pm2/logs/*-error-0.log`.
 */
const logDir = path.join(__dirname, 'storage', 'logs');
fs.mkdirSync(logDir, { recursive: true });

module.exports = {
  apps: [
    {
      name: 'zoho-dialer-backend',
      cwd: __dirname,
      script: 'src/server.js',
      interpreter: 'node',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      max_memory_restart: '300M',
      error_file: path.join(logDir, 'pm2-error.log'),
      out_file: path.join(logDir, 'pm2-out.log'),
      merge_logs: false,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      env: {
        NODE_ENV: 'development',
      },
      env_production: {
        NODE_ENV: 'production',
      },
    },
  ],
};
