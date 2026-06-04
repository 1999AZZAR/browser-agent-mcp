# General Browser Agent MCP

A modular, production-ready browser automation agent implemented as a Model Context Protocol (MCP) server. Powered by Playwright, it provides a comprehensive toolset for human-like web interaction, state analysis, automated navigation, and network-level control.

## Features

- **Semantic Interaction**: Click elements by text (`browser_click_text`) and fill entire forms (`browser_fill_form`) with single commands.
- **Multi-Tab Management**: Handle multiple sites simultaneously with tab list, switch, and creation tools.
- **Resilient Navigation**: Automatic retry with configurable attempts and backoff on network failures.
- **Request Interception**: Block, mock, or modify requests at the network level — stub APIs, strip ads, inject auth headers.
- **Session & Persistence**: Persistent browser contexts with named session save/load for both cookies and Web Storage (`localStorage`/`sessionStorage`).
- **Crash Recovery**: Browser state is automatically persisted to disk. If the browser process dies, tabs and intercept rules are restored on the next tool call — no data loss.
- **Parallel Agents**: Run independent named pages within a single browser context. Create, switch, and remove agents to handle multi-page workflows without interference.
- **PDF Export**: Save pages to disk as PDF with a custom output path and accurate file size reporting.
- **Smart Wait Strategy**: `browser_wait_for_load` for sites with WebSocket/SSE connections; `browser_wait_until_stable` for AJAX-heavy SPAs.
- **Stealth and Evasion**: Anti-detection behavioral profiles (`stealth` vs `speed`), realistic user-agent spoofing, human-like mouse jitter and typing delay.
- **Robust State Capture**: Extracts semantic page data including Accessibility Trees (AX Tree), interactive elements, and structural headings.
- **Data Extraction**: Table-to-JSON extraction and high-fidelity PDF/HTML capture.
- **CAPTCHA Management**: Automated detection and assisted resolution for reCAPTCHA, hCaptcha, and common challenge pages.

## Demo

See the General Browser Agent in action with Gemini CLI: [Watch on YouTube](https://youtu.be/O6nYKjmlaGk)

## Toolset

### Navigation & Tabs

| Tool | Description |
|------|-------------|
| `browser_navigate` | Navigate to a URL with automatic retry on failure (`retries`, `retryDelay`) — state is saved for crash recovery |
| `browser_new_tab` | Open a new tab, optionally at a URL |
| `browser_list_tabs` | List all open tabs and their active status |
| `browser_switch_tab` | Switch active tab by index |
| `browser_back` / `browser_forward` / `browser_reload` | Standard history control |
| `browser_wait` | Wait for a fixed number of milliseconds |
| `browser_wait_for_selector` | Wait until an element appears in the DOM |
| `browser_wait_for_url` | Wait until the URL matches a pattern (substring or regex) |
| `browser_wait_until_stable` | Wait for networkidle — use for AJAX/SPA pages |
| `browser_wait_for_load` | Wait for the `load` or `domcontentloaded` event — use for WebSocket/SSE pages |

### Named Agents / Parallelism

| Tool | Description |
|------|-------------|
| `browser_agent_create` | Create a new named agent page, or switch to an existing one |
| `browser_agent_switch` | Switch active context to a named agent |
| `browser_agent_remove` | Close and remove a named agent |
| `browser_agent_list` | List all active named agents and their URLs |

Named agents are independent pages within the same browser. Use them to parallelize workflows — each agent keeps its own navigation state, forms, and cookies. Create one, work on it, switch to another, come back later.

**Wait strategy guide:**

| Situation | Tool |
|-----------|------|
| Standard page navigation | `browser_wait_for_load()` |
| SPA / AJAX-heavy content | `browser_wait_until_stable()` |
| Page with WebSocket or long-polling | `browser_wait_for_load()` — networkidle will hang |
| Specific element expected | `browser_wait_for_selector(selector)` |
| URL change after action | `browser_wait_for_url(pattern)` |

### Interaction

| Tool | Description |
|------|-------------|
| `browser_click_text` | Click element by visible text (smart button/link detection) |
| `browser_fill_form` | Populate multiple fields at once from a `{selector: value}` object |
| `browser_click` | Click by selector or `x, y` coordinates |
| `browser_double_click` / `browser_right_click` | Pointer events |
| `browser_hover` | Hover over an element or coordinates |
| `browser_drag` | Drag source element to target |
| `browser_scroll` / `browser_scroll_to` | Scroll by direction or to a target |
| `browser_smart_scroll` | Incremental scroll to trigger lazy-loaded content |

### Forms & Input

| Tool | Description |
|------|-------------|
| `browser_type` | Human-like character insertion with configurable delay |
| `browser_clear` | Clear an input field |
| `browser_press` | Press a keyboard key |
| `browser_select` | Select a dropdown option by value or label |
| `browser_check` / `browser_uncheck` | Checkbox and radio control |

### Observation & Extraction

| Tool | Description |
|------|-------------|
| `browser_get_state` | Unified page snapshot: URL, title, AX tree, interactive elements, screenshot — auto-saves AX tree for later diffing |
| `browser_observe` | **Low-token alternative to `browser_get_state`** — returns only interactable elements with `ref` numbers, no screenshot. Use for pre-action planning. |
| `browser_click_ref` | Click an element by its `ref` number from the last `browser_observe` or `browser_get_state` call |
| `browser_state_diff` | Compare last two AX snapshots: URL/title changes, new/removed headings, element shifts, popups, captcha |
| `browser_screenshot` | Take a screenshot |
| `browser_get_text` | Read text from one or all matching elements |
| `browser_get_html` | Get full page or element HTML |
| `browser_extract_table` | Convert an HTML table to structured JSON |
| `browser_get_cookies` | Get all cookies for the active page |
| `browser_evaluate` | Execute JavaScript in the page context (supports `return`, `await`, and `args` injection) |
| `browser_print_to_pdf` | Save the page as a PDF file to a specified path |
| `browser_console_messages` | Return captured browser console messages and JS errors (last 100). Filter by `type`. Pass `clear: true` to flush. |
| `browser_network_requests` | Return captured network requests with status and timing (last 100). Filter by URL substring or `statusMin`. |

**`browser_evaluate` usage:**
```js
// Return a value
script: "return document.title"

// Use await
script: "const r = await fetch('/api/status'); return r.status"

// Pass data via args (no string interpolation needed)
script: "return args.x * args.y"
args: { "x": 6, "y": 7 }
```

### Request Interception

| Tool | Description |
|------|-------------|
| `browser_intercept` | Add an intercept rule: `block`, `mock`, or `modify` |
| `browser_intercept_list` | List all active intercept rules |
| `browser_clear_intercepts` | Remove all intercept rules |

**Actions:**
- `block` — abort matching requests (ads, trackers, heavy assets)
- `mock` — return a synthetic response with `status`, `body`, `contentType`, `headers`
- `modify` — pass the request through with injected headers (auth tokens, API keys)

**Examples:**
```
# Block all images
pattern: "**/*.{png,jpg,jpeg,gif,webp}", action: "block"

# Mock an API endpoint
pattern: "https://api.example.com/users*", action: "mock"
body: { "users": [] }, status: 200

# Inject Authorization header
pattern: "https://api.example.com/*", action: "modify"
headers: { "Authorization": "Bearer <token>" }
```

Rules persist across page navigations until `browser_clear_intercepts` is called.

### Session & Profile Management

| Tool | Description |
|------|-------------|
| `browser_save_session` | Save cookies (and optionally `localStorage`/`sessionStorage`) to a named file |
| `browser_load_session` | Restore a saved session |
| `browser_set_agent_profile` | Switch between `stealth` and `speed` behavioral profiles |
| `browser_handle_captcha` | Detect and manage CAPTCHA with optional manual hand-off |
| `browser_solve_captcha_grid` | Click specific grid cells in a visual CAPTCHA |
| `browser_close` | Terminate the browser session and clear all state |

**Session storage note:** Pass `includeStorage: true` to `browser_save_session` to also capture `localStorage` and `sessionStorage`. Required for sites that store auth tokens in Web Storage instead of cookies (most modern SPAs). Storage is only restored if the current page origin matches the saved origin.

### Helpers

| Tool | Description |
|------|-------------|
| `browser_dismiss_popups` | Suppress modals, banners, and dialogs |

## Installation

### Prerequisites
- Node.js 18.x or higher
- npm

### Setup
```bash
bash install.sh
```

## Cookie Injection (Firefox Sync)

Place a `cookies.json` file in the project root. The agent will automatically inject these cookies into every new session.

## Configuration

Register in your MCP client config:

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

## Token-Efficient Interaction: Observe → Act

For repetitive or well-understood pages, skip the heavy `browser_get_state` screenshot and use the observe→click loop:

```
1. browser_observe()           # Returns elements with ref numbers, no screenshot
   → { elements: [{ ref: 1, tag: "BUTTON", text: "Sign In" }, ...] }

2. browser_click_ref(ref=1)    # Click by ref — no re-snapshot needed
   → "Clicked ref 1 (BUTTON "Sign In") at (320, 240)."
```

This matches the approach used by browser-use (93% context reduction) and Stagehand's `act` primitive.

For debugging after an interaction:
```
browser_console_messages(type='error')   # Any JS errors?
browser_network_requests(statusMin=400)  # Any failed API calls?
```

## Architecture: Sense-Think-Act

The agent is designed for closed-loop automation with a **hybrid screenshot strategy** — screenshots are used only when the AX tree is insufficient.

```
Unfamiliar page      → browser_get_state()               # AX tree + elements, no image
Planning an action   → browser_observe()                  # interactable elements + refs only
Visual verification  → browser_get_state(screenshot=true) # full state + screenshot
Act by ref           → browser_click_ref(ref)             # stable, no re-snapshot needed
After action         → browser_state_diff()               # diff only, no image
Debug failures       → browser_console_messages()         # JS errors
                       browser_network_requests()         # failed API calls
```

**When to request a screenshot:**
- Canvas-rendered UIs, game elements, charts
- `aria-hidden` elements that are visually significant
- Cross-origin iframes
- Visual layout verification (CAPTCHA, image-heavy pages)

All other cases → AX tree is sufficient and far cheaper in tokens.
