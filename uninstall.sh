#!/bin/bash
# uninstall.sh - Remove Browser Agent MCP artifacts
set -e

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_ROOT"

echo "=== Browser Agent MCP Uninstall ==="

# 1. Remove npm dependencies
if [ -d "node_modules" ]; then
    echo "Removing node_modules..."
    rm -rf node_modules
fi

# 2. Remove user data (sessions, cookies, cache)
if [ -d "user_data" ]; then
    echo "Removing user_data (sessions, cookies, cache)..."
    rm -rf user_data
fi

# 3. Remove Playwright browsers installed by this project
echo "Removing Playwright Chromium..."
npx playwright uninstall chromium 2>/dev/null || true

# 4. Clean up npm lock/package cache
rm -rf package-lock.json

echo ""
echo "=== Uninstall Complete ==="
echo "To re-install, run: bash install.sh"
