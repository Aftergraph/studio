#!/usr/bin/env bash
# build-billing.sh — Auto-inject cache-bust version querystrings into billing/index.html
# Usage: ./scripts/build-billing.sh [output_path]
#   output_path defaults to billing/index.html (in-place replacement)
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
INPUT_FILE="$REPO_ROOT/billing/index.html"
OUTPUT_FILE="${1:-$INPUT_FILE}"

if [[ ! -f "$INPUT_FILE" ]]; then
  echo "ERROR: $INPUT_FILE not found" >&2
  exit 1
fi

HASH=$(git -C "$REPO_ROOT" rev-parse --short HEAD)
echo "Cache-bust hash: $HASH"

# Create temp file for atomic write
TMP_FILE=$(mktemp)
trap 'rm -f "$TMP_FILE"' EXIT

# Append ?v=HASH to .css and .mjs references that don't already have a query string
sed -E "s/(href|src)=\"([^\"]+\.(css|mjs))\"/\1=\"\2?v=$HASH\"/g" "$INPUT_FILE" > "$TMP_FILE"

# Verify the sed actually changed something
if grep -q "?v=$HASH" "$TMP_FILE"; then
  mv "$TMP_FILE" "$OUTPUT_FILE"
  echo "Updated: $OUTPUT_FILE"
else
  echo "WARNING: No .css or .mjs references found to update" >&2
  rm -f "$TMP_FILE"
  exit 1
fi
