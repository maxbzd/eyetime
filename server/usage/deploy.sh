#!/usr/bin/env bash
# SPDX-License-Identifier: FSL-1.1-ALv2
# Copyright 2026 maxbzd
# One command that finishes setting up the collector (the databases and their tables already exist, see README.md):
#   bash server/usage/deploy.sh
# It logs in to Cloudflare (a browser tab opens once), sets the dashboard key, deploys the Worker, and writes the Worker's address into src/shared/usage-config.js.
# Run it again any time: the key is kept unless you pass --new-key, the deploy is idempotent.
set -euo pipefail
cd "$(dirname "$0")"
ROOT="$(cd ../.. && pwd)"
W="npx --yes wrangler@4"

$W whoami >/dev/null 2>&1 || $W login

OUT="$($W deploy 2>&1 | tee /dev/stderr)"
URL="$(printf '%s' "$OUT" | grep -oE 'https://eyetime-usage\.[A-Za-z0-9.-]+\.workers\.dev' | head -1)"
[ -n "$URL" ] || { echo "Could not find the Worker address in the deploy output; put it in src/shared/usage-config.js by hand." >&2; exit 1; }

# the key is set after the first deploy: before it the Worker does not exist and wrangler would ask a question
if [ "${1:-}" = "--new-key" ] || ! $W secret list 2>/dev/null | grep -q DASH_TOKEN; then
  KEY="$(openssl rand -base64 24 | tr -d '/+=' | cut -c1-32)"
  printf '%s' "$KEY" | $W secret put DASH_TOKEN >/dev/null
  NEWKEY=1
fi

sed -i "s#^export const USAGE_ENDPOINT = .*#export const USAGE_ENDPOINT = '$URL/v1/usage';#" "$ROOT/src/shared/usage-config.js"

echo
echo "Collector:  $URL"
echo "Endpoint written to src/shared/usage-config.js"
if [ "${NEWKEY:-}" = 1 ]; then
  echo "Dashboard:  $URL/#t=$KEY"
  echo "Key (shown once, keep it in a password manager): $KEY"
fi
echo "Next: commit src/shared/usage-config.js and release."
