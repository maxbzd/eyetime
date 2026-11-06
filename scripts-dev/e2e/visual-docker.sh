#!/usr/bin/env bash
# The visual suite against the baseline, in the same kind of machine as CI (Ubuntu 24.04 with the fonts Playwright installs for Chromium), so that a developer on a Mac or on another
# Linux sees the same pixels as CI instead of "39 screens changed" that are only fonts.
#   scripts-dev/e2e/visual-docker.sh                 compare with scripts-dev/e2e/visual-baseline/
#   scripts-dev/e2e/visual-docker.sh --update        rewrite the baseline after a change you meant to make (then look at git diff, and commit)
# Needs Docker or Podman. The image is the one Playwright publishes for the version CI uses (1.56.1); nothing is installed on your machine.
set -euo pipefail
cd "$(dirname "$0")/../.."
RUNTIME="$(command -v docker || command -v podman || true)"
[ -n "$RUNTIME" ] || { echo "Docker or Podman is needed (the point is a machine like CI's)." >&2; exit 2; }
IMAGE="mcr.microsoft.com/playwright:v1.56.1-noble"
ARGS=""
[ "${1:-}" = "--update" ] && ARGS="--update"
exec "$RUNTIME" run --rm --ipc=host -v "$PWD":/work -w /work -e CI=1 "$IMAGE" bash -c "npm i --no-save --ignore-scripts=false playwright@1.56.1 axe-core@4.14.0 >/dev/null 2>&1 && node scripts-dev/e2e/visual.cjs $ARGS"
