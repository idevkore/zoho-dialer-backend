#!/usr/bin/env bash
# Run from the deployed app root (Forge: cd $FORGE_SITE_PATH first).
# PM2 "restart" does NOT re-read ecosystem.config.cjs; this script deletes and starts fresh
# so script path / cwd / log paths always match the active release (current → releases/<id>).
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
echo "[pm2-forge-resync] pwd=$(pwd) resolved=$(readlink -f .)"
pm2 delete zoho-dialer-backend 2>/dev/null || true
pm2 start ecosystem.config.cjs --update-env --env production
pm2 save
echo "[pm2-forge-resync] verify script path + exec cwd match resolved release above:"
pm2 describe zoho-dialer-backend | grep -E 'script path|exec cwd|error log path|out log path' || true
