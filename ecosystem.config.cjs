/**
 * PM2 config for Laravel Forge (or any host running PM2).
 * Deploy: `pm2 restart zoho-dialer-backend --update-env` or first-time
 * `pm2 start ecosystem.config.cjs --update-env --env production`
 */
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
      env: {
        NODE_ENV: 'development',
      },
      env_production: {
        NODE_ENV: 'production',
      },
    },
  ],
};
