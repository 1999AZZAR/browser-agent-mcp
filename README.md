# General Browser Agent MCP

A modular, high-performance browser automation agent implemented as a Model Context Protocol (MCP) server. Powered by Playwright, it provides a comprehensive toolset for human-like web interaction, state analysis, and automated navigation.

## Features

- **Semantic Interaction**: Click elements by text (`browser_click_text`) and fill entire forms (`browser_fill_form`) with single commands.
- **Multi-Tab Management**: Handle multiple sites simultaneously with tab list, switch, and creation tools.
- **Session & Persistence**: Support for persistent browser contexts and explicit session saving/loading (`cookies.json` and named sessions).
- **Stealth and Evasion**: Advanced anti-detection, custom behavioral profiles (`stealth` vs `speed`), and realistic user-agent spoofing.
- **Robust State Capture**: Extracts semantic page data including Accessibility Trees (AX Tree), interactive elements, and structural headings.
- **Data Extraction**: Automated table-to-JSON extraction and high-fidelity PDF/HTML capture.

## Toolset

The agent exposes 40+ specialized tools categorized for the full automation lifecycle:

### Navigation & Tabs
- `browser_navigate`: Navigate to a URL.
- `browser_new_tab`: Open a new browser tab (optionally at a URL).
- `browser_list_tabs`: View all currently open tabs and their status.
- `browser_switch_tab`: Switch the active view to a specific tab index.
- `browser_wait_until_stable`: Wait for network traffic to settle (networkidle).
- `browser_back`, `browser_forward`, `browser_reload`: Standard history control.
- `browser_wait`, `browser_wait_for_selector`, `browser_wait_for_url`: Precise synchronization.

### Semantic & Standard Interaction
- `browser_click_text`: Click elements by their visible text (intelligent button/link detection).
- `browser_fill_form`: Populate multiple fields at once from a data object.
- `browser_click`, `browser_double_click`, `browser_right_click`: Precision pointer events.
- `browser_hover`, `browser_drag`: Complex pointer behaviors.
- `browser_scroll`, `browser_scroll_to`, `browser_smart_scroll`: Advanced viewport management.

### Forms and Input
- `browser_type`: Delayed, human-like character insertion (respects behavioral profile).
- `browser_clear`, `browser_press`: Field management and keyboard events.
- `browser_select`, `browser_check`, `browser_uncheck`: Specialized form controls.

### Observation and Analysis
- `browser_get_state`: Unified page analysis (URL, title, elements, AX Tree) with integrated screenshot.
- `browser_extract_table`: Automatically convert HTML tables into structured JSON.
- `browser_screenshot`, `browser_get_text`, `browser_get_html`: Visual and structural extraction.
- `browser_print_to_pdf`: High-fidelity document capture.
- `browser_evaluate`: Execution of arbitrary JavaScript.

### Session & Profile Management
- `browser_save_session`: Save current cookies to a named file.
- `browser_load_session`: Load cookies from a named file.
- `browser_set_agent_profile`: Toggle between `stealth` (high-delay, human-like) and `speed` (low-delay) behavior.
- `browser_close`: Terminate the browser session and clear state.

### Helpers
- `browser_dismiss_popups`: Automated modal and banner suppression.

## Installation

### Prerequisites
- Node.js 18.x or higher
- npm

### Setup
```bash
bash install.sh
```

## Cookie Injection (Firefox Sync)
You can sync your local Firefox session by placing a `cookies.json` file in the project root. The agent will automatically inject these cookies into every new session, keeping you logged into your accounts.

## Configuration

Register the server in your MCP client configuration:

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
1. **Sense**: Use `browser_get_state` or `browser_extract_table` to obtain semantic data.
2. **Think**: Analyze state to determine optimal next action.
3. **Act**: Use Semantic tools (`browser_click_text`, `browser_fill_form`) or standard interaction tools.
4. **Repeat**: Verify outcome and iterate.
