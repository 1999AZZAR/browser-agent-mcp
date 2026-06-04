---
name: browser-agent
description: "Professional browser automation agent for web navigation, interaction, and data extraction. Use for: (1) interacting with web apps, (2) filling forms, (3) visual verification, (4) complex multi-step web tasks, (5) bypassing simple bot checks."
---

# Browser Agent

The skill is the entry point. The power is in `mcp__browser-agent__*` tools — 30 tools covering the full Playwright API over CDP. Always call MCP tools directly; this skill maps task types to exact calls.

## Dispatch Table

| Task | Primary Call | Fallback |
|------|-------------|---------|
| Navigate to URL | `browser_navigate(url)` | — |
| Sense page state | `browser_get_state()` | `browser_screenshot()` |
| Semantic Click | `browser_click_text(text, type='button')` | `browser_click(selector)` |
| Fill whole form | `browser_fill_form(data={...})` | `browser_type()` |
| Manage Tabs | `browser_new_tab()`, `browser_list_tabs()`, `browser_switch_tab(index)` | — |
| Wait (networkidle) | `browser_wait_until_stable()` | `browser_wait(3000)` |
| Wait (load event) | `browser_wait_for_load(state='load')` | `browser_wait_for_load(state='domcontentloaded')` |
| Extract Tables | `browser_extract_table(selector)` | `browser_get_text()` |
| Save session (cookies only) | `browser_save_session(name)` | — |
| Save session (full auth state) | `browser_save_session(name, includeStorage=true)` | — |
| Load session | `browser_load_session(name)` | — |
| Agent Profile | `browser_set_agent_profile(profile='stealth')` | — |
| Handle CAPTCHA | `browser_handle_captcha(wait=true)` | — |
| Click element | `browser_click(selector)` | `browser_click(x, y)` |
| Type text | `browser_type(selector, text, delay=120)` | — |
| Select dropdown | `browser_select(selector, value)` | `browser_evaluate(script)` |
| Check/uncheck | `browser_check(selector)` / `browser_uncheck(selector)` | — |
| Hover then click | `browser_hover(selector)` → wait → `browser_click(selector)` | — |
| Scroll to element | `browser_scroll_to(selector)` | `browser_scroll(direction, amount)` |
| Lazy-load content | `browser_smart_scroll(steps=5)` | — |
| Extract text | `browser_get_text(selector)` | `browser_get_html(selector)` |
| Save page as PDF | `browser_print_to_pdf()` | — |
| Run JS in page | `browser_evaluate(script)` | `browser_evaluate(script, args={...})` |
| Dismiss modal | `browser_dismiss_popups()` | `browser_evaluate("el.remove()")` |
| Get cookies | `browser_get_cookies()` | — |
| Press key | `browser_press(key)` | — |
| Drag element | `browser_drag(source, target)` | — |
| Navigate history | `browser_back()` / `browser_forward()` / `browser_reload()` | — |

## Wait Strategy Guide

| Situation | Tool |
|-----------|------|
| Standard page load | `browser_wait_for_load()` |
| SPA / AJAX-heavy page | `browser_wait_until_stable()` |
| Page has WebSocket / long-polling | `browser_wait_for_load()` — networkidle will hang |
| Waiting for a specific element | `browser_wait_for_selector(selector)` |
| Waiting for URL change | `browser_wait_for_url(pattern)` |

## browser_evaluate Notes

- Use `return` to return a value: `return document.title`
- Supports `await`: `const r = await fetch('/api'); return r.status`
- Pass data via `args`: `return args.multiplier * 2` with `args={"multiplier": 5}`
- Errors are surfaced as `isError: true` with the JS exception message

## Core Rules

1. **Sense before act** — always call `browser_get_state()` or `browser_screenshot()` before interacting with an unfamiliar page.
2. **Never zero-delay type** — minimum `delay=50`, target `delay=120` for public sites.
3. **Selector priority**: `#id` → `[data-testid]` → `[role]`/text → `.class` → `x,y` coordinates.
4. **After navigation** — call `browser_wait_for_selector` before next interaction.
5. **On blocked elements** — call `browser_dismiss_popups()` first, then coordinate fallback, then `browser_evaluate`.
6. **Sites with WebSocket/SSE** — use `browser_wait_for_load()` not `browser_wait_until_stable()` or you will hang.

## Deep References

Load these only when needed:

- **[patterns.md](references/patterns.md)** — search, form, extraction, and troubleshooting flows.
- **[selectors.md](references/selectors.md)** — AX tree usage, dynamic content, coordinate fallbacks.
- **[stealth.md](references/stealth.md)** — anti-detection, human-like timing, behavioral red flags.
