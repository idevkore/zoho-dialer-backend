# zoho-dialer-backend

Multi-tenant Node.js backend for the Zoho CRM web dialer: Twilio Voice (tokens, TwiML, webhooks) and Zoho CRM call logging.

**GitHub:** `https://github.com/idevkore/zoho-dialer-backend` (default branch: **dev** — target for feature PRs)

## Branches

- **dev** — integration branch. Feature PRs merge here first; this is what you deploy to production for verification.
- **main** — after production testing passes, **main** is updated so it matches the functional production deployment (same commits that are live).

### Workflow

1. Open feature branches from **dev**, implement and test locally, then open PRs **into `dev`**.
2. Merge approved PRs to **dev** and deploy **dev** to production (Forge) for final verification.
3. Once production looks good, merge **`dev` → `main`**. **main** is then the canonical copy of what is running in production.
4. Merge **`main` → `dev`** so **dev** picks up that merge commit and stays aligned with production history.
5. Branch new features from **dev** again and repeat.

This keeps **main** trustworthy as “what shipped,” while **dev** stays the day-to-day integration line you branch from and PR into.

## Requirements

- Node.js 20+
- Twilio: Account SID, Auth Token, **API Key + Secret** (for Voice SDK access tokens), TwiML App SID, caller ID, optional inbound number and voicemail audio URL.
- Zoho CRM: OAuth client id/secret, refresh token, org id (per tenant, namespaced env vars).

Copy `.env.example` to `.env` and fill values. `JWT_SECRET` is required (used to sign short-lived TwiML URLs for voicemail drop).

## Twilio console URLs

Mount paths are under **`/api/v1`** (Forge/Nginx should forward to this app):

| Use | URL pattern |
| --- | --- |
| Health (use this if Nginx only proxies `/api`) | `https://<your-domain>/api/v1/health` |
| Health (root; needs Nginx to proxy `/` to Node) | `https://<your-domain>/health` |
| Voice (TwiML App) | `https://<your-domain>/api/v1/voice?tenantId=<slug>` |
| Status / recording callback | `https://<your-domain>/api/v1/events?tenantId=<slug>` |
| Inbound (number webhook) | `https://<your-domain>/api/v1/inbound` (tenant resolved via `TWILIO_*_INBOUND_NUMBER` match on `To`, or add `?tenantId=`). |

In **production**, set `PUBLIC_BASE_URL` to the same origin Twilio uses (required for `X-Twilio-Signature` validation).

## Scripts

- `npm run dev` — nodemon
- `npm start` — production-style start
- `npm test` — Jest (ESM)

## Laravel Forge

Create the site from `idevkore/zoho-dialer-backend`, configure the **deploy branch** (e.g. `dev`), set environment variables in Forge (including `PORT`, `NODE_ENV`, `PUBLIC_BASE_URL`, `JWT_SECRET`, and tenant-prefixed secrets), and point Nginx at the Node process listening on `PORT`.

New Forge sites often use **zero-downtime deployments**. In that case the deploy script must use Forge’s release macros; a plain `git pull` in the site root will fail because there is no `.git` there. Example deploy script that works with this repo and **PM2** (`ecosystem.config.cjs` in the project root):

```bash
$CREATE_RELEASE()

cd $FORGE_RELEASE_DIRECTORY

npm ci --omit=dev

$ACTIVATE_RELEASE()

cd $FORGE_SITE_PATH

pm2 restart zoho-dialer-backend --update-env 2>/dev/null || pm2 start ecosystem.config.cjs --update-env --env production
```

Run **PM2 only after** `$ACTIVATE_RELEASE()` so the process serves the new `current` release. If you use **standard** (non–zero-downtime) deployments instead, use `git pull` / `git reset --hard` from `$FORGE_SITE_ROOT` and the same `npm ci` + PM2 lines from that directory.
