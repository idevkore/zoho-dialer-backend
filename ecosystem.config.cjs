const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

/**
 * PM2 config for Laravel Forge (or any host running PM2).
 * Deploy (Forge): from `$FORGE_SITE_PATH`, run `pm2 delete …` then
 * `pm2 start ecosystem.config.cjs --update-env --env production` so this file is always applied.
 *
 * Logs go under `~/.pm2/logs/` (always present for the `forge` user). Writing only under
 * `current/storage/logs/` fails silently from the operator’s perspective if PM2 never
 * successfully loads this ecosystem (stale process, wrong cwd, or start never ran).
 */
const logDir = path.join(os.homedir(), '.pm2', 'logs');
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
      error_file: path.join(logDir, 'zoho-dialer-backend.stderr.log'),
      out_file: path.join(logDir, 'zoho-dialer-backend.stdout.log'),
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
