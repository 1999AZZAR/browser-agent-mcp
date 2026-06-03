---
name: browser-agent
description: "Professional browser automation agent for web navigation, interaction, and data extraction. Use for: (1) interacting with web apps, (2) filling forms, (3) visual verification, (4) complex multi-step web tasks, (5) bypassing simple bot checks."
---

# Browser Agent

Expert web automation using Playwright. 29 tools covering the full spectrum of human-like browser interaction.

## Core Mandates

1. **Sense Before Act**: Always use `browser_get_state` or `browser_screenshot` to understand the page before interacting.
2. **Human-Like Stealth**: Use `delay` in `browser_type` and simulate mouse movements when possible.
3. **Wait for State**: Always wait for loads or selectors after navigation or interaction.
4. **Popup Management**: Use `browser_dismiss_popups` if an unexpected modal blocks the workflow.
5. **Deep Analysis**: Use `browser_get_html` if `browser_get_state` does not provide enough detail for complex components.

## Standard Operating Procedure (SOP)

### 1. Navigation & Initial Sense
```javascript
browser_navigate(url)
browser_wait_for_selector(main_selector)
browser_get_state() // Analyze layout and elements
```

### 2. Interaction Loop (Sense-Think-Act)
- **Sense**: Capture state/screenshot.
- **Think**: Identify target element (id, class, or text).
- **Act**: 
    - For inputs: `browser_type(selector, text, delay=100)`
    - For buttons: `browser_click(selector)` or `browser_click(x, y)`
    - For menus: `browser_hover(selector)` followed by `browser_click`

### 3. Verification & Extraction
- **Visual**: `browser_screenshot()`
- **Textual**: `browser_get_text(selector)`
- **Structural**: `browser_get_html(selector)`
- **Document**: `browser_print_to_pdf()`

## Expert References

- [Browsing Patterns](references/browsing-patterns.md): Common navigation and data gathering flows.
- [Stealth and Evasion](references/stealth-and-evasion.md): Standards for human-like behavior and bot bypass.
- [Element Interaction](references/element-interaction.md): Selector strategies and AX Tree utilization.

## Tool Categories

| Category | Primary Tools |
|----------|---------------|
| **Navigation** | `navigate`, `wait_for_selector`, `wait_for_url` |
| **Interaction** | `click`, `type`, `hover`, `drag`, `scroll` |
| **Observation** | `get_state`, `screenshot`, `get_text`, `get_html`, `get_cookies` |
| **Automation** | `dismiss_popups`, `smart_scroll`, `evaluate`, `print_to_pdf` |
