# General Browser Agent MCP

A modular, general-purpose browser automation agent using Playwright and the Model Context Protocol (MCP).

## Features

- **Modular Architecture**: Separated core logic, tools, and utilities.
- **State Capture**: Comprehensive page state extraction (AX Tree, interactive elements, headings, text).
- **Toolbox**:
  - `browser_navigate`: Visit any website.
  - `browser_get_state`: Sense current page context.
  - `browser_click`: Interact with elements.
  - `browser_type`: Fill forms.
  - `browser_screenshot`: Visual verification.
  - `browser_scroll`: Navigate long pages.

## Setup

```bash
npm install
npx playwright install chromium
```

## Usage

Start the MCP server:
```bash
npm run mcp
```

## Architecture (Sense-Think-Act)

1. **Sense**: `browser_get_state` + `browser_screenshot`.
2. **Think**: AI analyzes the state and visual data.
3. **Act**: AI calls `browser_click`, `browser_type`, etc.
