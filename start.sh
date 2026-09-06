#!/usr/bin/env sh
set -eu
cd "$(dirname "$0")"
echo "Aftergraph Workspace v4 · Living Interface"
echo "Open http://127.0.0.1:8000"
exec node server.mjs
