# General Browser Agent MCP

A modular, high-performance browser automation agent implemented as a Model Context Protocol (MCP) server. Powered by Playwright, it provides a comprehensive toolset for human-like web interaction, state analysis, and automated navigation.

## Features

- **Modular Architecture**: Decoupled core modules for browser management, state extraction, and tool execution.
- **Robust State Capture**: Extracts semantic page data including Accessibility Trees (AX Tree), interactive elements, structural headings, and visible text blocks.
- **Stealth and Evasion**: Implements advanced anti-detection measures by neutralizing `navigator.webdriver` flags and employing realistic user-agent spoofing.
- **Human-Like Interaction**: Tools support randomized delays and behavioral simulation to bypass standard bot-detection heuristics.
- **Persistence**: Supports persistent browser contexts for session maintenance across multiple interactions.
- **High-Fidelity Observation**: Beyond screenshots, the agent can extract full HTML, generate PDF reports, and manage session cookies.

## Toolset

The agent exposes 29 specialized tools categorized for the full automation lifecycle:

### Navigation
- `browser_navigate`: Navigate to specified URLs with configurable wait conditions.
- `browser_back`, `browser_forward`, `browser_reload`: Standard history and session control.
- `browser_wait`, `browser_wait_for_selector`, `browser_wait_for_url`: Precise synchronization primitives.

### Interaction
- `browser_click`, `browser_double_click`, `browser_right_click`: Precision pointer events via coordinates or selectors.
- `browser_hover`, `browser_drag`: Complex pointer behaviors.
- `browser_scroll`, `browser_scroll_to`, `browser_smart_scroll`: Advanced viewport management and lazy-loading triggers.

### Forms and Input
- `browser_type`: Delayed, human-like character insertion.
- `browser_clear`, `browser_press`: Field management and low-level keyboard events.
- `browser_select`, `browser_check`, `browser_uncheck`: Specialized form control interactions.

### Observation and Analysis
- `browser_get_state`: Unified page analysis (URL, title, elements, AX Tree) with integrated screenshot.
- `browser_screenshot`: Full or viewport visual capture.
- `browser_get_text`: Target text extraction.
- `browser_get_html`: Full or partial structural source extraction.
- `browser_print_to_pdf`: High-fidelity document capture.
- `browser_get_cookies`: Session and authentication state inspection.
- `browser_evaluate`: Execution of arbitrary JavaScript within the page context.

### Automation Helpers
- `browser_dismiss_popups`: Automated heuristic-based modal and banner suppression.

## Installation

The project includes an automated setup script for Linux/macOS environments.

### Prerequisites
- Node.js 18.x or higher
- npm

### Setup
Run the following command in the project root:
```bash
bash install.sh
```
This script validates the environment, installs dependencies, and configures the Playwright Chromium engine.

## Configuration

Register the server in your MCP client configuration (e.g., `settings.json` for Gemini CLI or Claude Desktop):

```json
{
  "mcpServers": {
    "browser-agent": {
      "command": "node",
      "args": ["/absolute/path/to/browser-agent/src/server.js"],
      "env": {}
    }
  }
}
```

## Architecture: Sense-Think-Act

The agent is designed to support a closed-loop automation pattern:
1. **Sense**: Use `browser_get_state` to obtain the current page's semantic and structural data.
2. **Think**: The AI model analyzes the state to determine the optimal next action based on the objective.
3. **Act**: Execute interactions using the interaction and form tools.
4. **Repeat**: Verify the outcome and iterate until the task is complete.
