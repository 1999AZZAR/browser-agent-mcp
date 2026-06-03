# Stealth and Human-Like Behavior

## What the MCP Handles Automatically
- `navigator.webdriver` flag neutralized at browser init
- Native CDP events for clicks/typing (harder to fingerprint than synthetic JS)
- Realistic Windows/Chrome UA: `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36`

## Typing Cadence (You Control This)
| Context | Delay |
|---------|-------|
| Internal/dev forms | `delay=50` |
| Public sites | `delay=100` |
| Sensitive/monitored sites | `delay=120–180` |

Never omit `delay` on visible inputs. Zero-delay insertion is a bot fingerprint.

## Pointer Behavior
Avoid "warping" directly to a target:
```
browser_hover(selector)
browser_wait(ms=300)    // 200–500ms randomized feels human
browser_click(selector)
```

## Timing Between Actions
Avoid rhythmic patterns between high-level navigation phases:
```
browser_wait(ms=700)    // vary: 500–1500ms between distinct phases
```
Never use a fixed interval (e.g., exactly 1000ms every time).

## Hard Behavioral Rules
- Never interact with `display:none` or `visibility:hidden` elements
- Never rapidly cycle URLs without allowing resource loads
- Never rely solely on `browser_evaluate` to set values — always trigger the associated UI event afterward
