#!/usr/bin/env bash
set -e

echo "=== QA Inspector — Local Setup ==="

# ── 1. Check Node.js ──────────────────────────────────────────────────────────
if ! command -v node &>/dev/null; then
  echo "ERROR: Node.js is not installed. Download it from https://nodejs.org (v20+)"
  exit 1
fi

NODE_VER=$(node -e "process.stdout.write(process.versions.node.split('.')[0])")
if [ "$NODE_VER" -lt 20 ]; then
  echo "ERROR: Node.js v20+ is required (you have v$NODE_VER). Update at https://nodejs.org"
  exit 1
fi
echo "Node.js v$(node --version) — OK"

# ── 2. Install pnpm if missing ────────────────────────────────────────────────
if ! command -v pnpm &>/dev/null; then
  echo "Installing pnpm..."
  npm install -g pnpm
fi
echo "pnpm v$(pnpm --version) — OK"

# ── 3. Install all workspace dependencies ────────────────────────────────────
echo ""
echo "Installing dependencies..."
pnpm install

# ── 4. Copy env files (skip if already present) ──────────────────────────────
echo ""
echo "Setting up environment files..."
if [ ! -f artifacts/api-server/.env ]; then
  cp artifacts/api-server/.env.example artifacts/api-server/.env
  echo "  Created artifacts/api-server/.env"
else
  echo "  artifacts/api-server/.env already exists — skipping"
fi

if [ ! -f artifacts/qa-inspector/.env ]; then
  cp artifacts/qa-inspector/.env.example artifacts/qa-inspector/.env
  echo "  Created artifacts/qa-inspector/.env"
else
  echo "  artifacts/qa-inspector/.env already exists — skipping"
fi

# ── 5. Install Playwright's Chromium browser ──────────────────────────────────
echo ""
echo "Installing Chromium (used for scanning and PDF export)..."
pnpm --filter @workspace/api-server exec playwright install chromium

# On Linux, also install system dependencies
if [ "$(uname)" = "Linux" ]; then
  echo "Linux detected — installing Playwright system dependencies..."
  pnpm --filter @workspace/api-server exec playwright install-deps chromium || true
fi

# ── 6. Done — print start instructions ───────────────────────────────────────
echo ""
echo "============================================================"
echo " Setup complete!"
echo ""
echo " Start the app by running in two separate terminals:"
echo ""
echo "   Terminal 1 (API server):"
echo "   pnpm --filter @workspace/api-server run dev:local"
echo ""
echo "   Terminal 2 (Frontend):"
echo "   pnpm --filter @workspace/qa-inspector run dev"
echo ""
echo "   Then open: http://localhost:5173"
echo "============================================================"
