#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
echo "Starting the dedicated Pac-Man cabinet on this machine..."
echo "Leave this terminal open. Play from other computers."
if [[ "${1:-}" == "--public" ]]; then
  npm run server:public
else
  npm run server
fi
