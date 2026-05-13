/**
 * Attach early so stderr reaches PM2 `error_file` (import this module first in `server.js`).
 */
process.on('uncaughtException', (err) => {
  console.error('[zoho-dialer-backend] uncaughtException', err);
});
process.on('unhandledRejection', (reason) => {
  console.error('[zoho-dialer-backend] unhandledRejection', reason);
});
