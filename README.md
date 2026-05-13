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

pm2 delete zoho-dialer-backend 2>/dev/null || true
pm2 start ecosystem.config.cjs --update-env --env production
pm2 save
```

Always **`pm2 delete`** then **`pm2 start ecosystem.config.cjs`** here (not only `pm2 restart`). If the app was first started with a raw `node …/src/server.js` path, **`restart` keeps that stale config** and ignores `cwd`, `error_file`, and other ecosystem fields — which matches “502 + nothing on :3000”.

Forge defines **`$FORGE_SITE_PATH`** as the **deployment root**, which is already the `current` symlink (e.g. `/home/forge/example.com/current`). Do **not** append `/current` again or `cd` will fail with `.../current/current`. Use **`$FORGE_SITE_ROOT`** for the parent directory (e.g. `/home/forge/example.com`) when you need the site home without `current`.

Run **PM2 only after** `$ACTIVATE_RELEASE()` from **`$FORGE_SITE_PATH`** so `ecosystem.config.cjs` and shared files resolve against the activated release.

### 502 and nothing on port 3000

**Note:** `$FORGE_SITE_PATH` and `$FORGE_SITE_ROOT` exist **only while Forge runs the deploy script**. In normal SSH they are usually **empty** — do not use them in `tail`/`grep` by hand unless you `export` them yourself.

1. Confirm **Nginx** `proxy_pass` uses the same port as **`PORT`** in the site `.env`. From the server (site root is the parent of `current`):

   ```bash
   grep ^PORT= ~/haulos-zoho-dialer-backend.atiny.cloud/.env
   ss -tlnp | grep node
   ```

   (Adjust the `.env` path to your site directory if different.)

2. **PM2 logs** live under the **activated release** (`current`). After `cd` there, use **relative** paths:

   ```bash
   cd ~/haulos-zoho-dialer-backend.atiny.cloud/current
   tail -n 100 storage/logs/pm2-error.log
   tail -n 100 storage/logs/pm2-out.log
   ```

   If those files do not exist yet, PM2 has not successfully started with this repo’s `ecosystem.config.cjs` (or logs are still under `~/.pm2/logs/`). Use **`pm2 describe zoho-dialer-backend`** for the paths PM2 is using.

3. In Forge **Daemons**, ensure you are **not** also running a second Node command for the same app that conflicts with PM2.

This repo pins PM2 output to **`storage/logs/`** next to the deployed code (see `ecosystem.config.cjs`):

```bash
cd ~/YOUR_SITE/current
tail -n 200 storage/logs/pm2-error.log
tail -n 200 storage/logs/pm2-out.log
```

After changing `error_file` / `out_file` in the ecosystem, recreate the process once so PM2 picks up paths:

```bash
cd ~/YOUR_SITE/current
pm2 delete zoho-dialer-backend 2>/dev/null
pm2 start ecosystem.config.cjs --update-env --env production && pm2 save
```

PM2’s default files (`~/.pm2/logs/<name>-error-0.log`) only apply if the process was **never** started with this ecosystem’s `error_file` — or use **`pm2 describe zoho-dialer-backend`** and copy the **exact** `error log path` / `out log path` lines. To stream both streams without guessing filenames:

```bash
pm2 logs zoho-dialer-backend --lines 200 --nostream
```

If you use **standard** (non–zero-downtime) deployments instead, use `git pull` / `git reset --hard` from `$FORGE_SITE_ROOT` and the same `npm ci` + PM2 lines from the directory that contains your app code and `ecosystem.config.cjs`.

### Nginx: proxy to Node

If the site Nginx config only has `try_files` under `location /`, **no traffic reaches Express**. Add a `location` that forwards **`/api/`** to the same **`PORT`** as in the site `.env` / Forge environment (replace `3000` below if different). Put this **above** the generic `location /` block so `/api/...` is handled first:

```nginx
location /api/ {
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_read_timeout 120s;
    proxy_pass http://127.0.0.1:3000;
}
```

Use `proxy_pass http://127.0.0.1:3000` **without** a URI path so the upstream receives the full path (e.g. `/api/v1/health`). If you also need **`GET /health`** at the site root, add a second block:

```nginx
location = /health {
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_pass http://127.0.0.1:3000;
}
```

After editing, reload Nginx on the server (`sudo nginx -t && sudo service nginx reload`) or use Forge’s **Reload Nginx** if available.
