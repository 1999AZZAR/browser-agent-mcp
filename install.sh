#!/bin/bash
# install.sh - Automated setup for General Browser Agent MCP
set -e

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_ROOT"

echo "=== Browser Agent MCP Setup ==="

# 1. Environment Validation
if ! command -v node &> /dev/null; then
    echo "Error: Node.js not found. Please install Node.js 18+."
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "Error: Node.js 18+ is required (detected v$(node -v))."
    exit 1
fi

# 2. Dependency Installation
echo "Installing npm dependencies..."
npm install --production

# 3. Playwright Setup
echo "Installing Playwright Chromium engine..."
npx playwright install chromium

# 4. Workspace Preparation
mkdir -p user_data
# Clean stale chromium lockfiles
rm -f user_data/SingletonLock user_data/SingletonSocket user_data/SingletonCookie

# 5. MCP Configuration Output
SERVER_PATH="$PROJECT_ROOT/src/server.js"
echo ""
echo "=== Setup Complete ==="
echo "The MCP server is ready to use."
echo ""
echo "Register this server in your MCP client configuration:"
echo "{"
echo "  \"mcpServers\": {"
echo "    \"browser-agent\": {"
echo "      \"command\": \"node\","
echo "      \"args\": [\"$SERVER_PATH\"],"
echo "      \"env\": {}"
echo "    }"
echo "  }"
echo "}"
echo ""
echo "Note: Ensure the path to server.js is absolute."
