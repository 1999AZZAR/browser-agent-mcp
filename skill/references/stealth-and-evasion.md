# Stealth and Evasion

Technical standards for avoiding automation detection and behavioral heuristics.

## Anti-Detection Mechanisms

### 1. Navigator Spoofing
The agent automatically neutralizes the `navigator.webdriver` flag and other Blink-specific automation indicators. This is handled at the core browser management layer (`src/core/browser.js`).

### 2. User-Agent Consistency
A realistic Windows/Chrome User-Agent is employed to match common browser profiles:
`Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36`

### 3. Native Event Simulation
The agent uses native CDP (Chrome DevTools Protocol) events for clicks and typing, which are more difficult to detect than synthetic JavaScript events.

## Human-Like Interaction SOP

### Typing Cadence
**Mandate**: Never use zero-delay insertion for visible inputs.
- **Minimum Delay**: 50ms (for internal forms).
- **Target Delay**: 100ms - 180ms (for sensitive public sites).
- **Tool**: `browser_type(selector, text, delay=120)`.

### Pointer Dynamics
**Mandate**: Avoid immediate "warping" to coordinates.
- **Simulation**: When clicking or moving, the agent should simulate mouse paths.
- **Pattern**:
    1. Hover over the target (`browser_hover`).
    2. Wait 200ms - 500ms.
    3. Execute click (`browser_click`).

### Task Intervals
**Mandate**: Randomize pauses between high-level actions.
- Avoid perfectly rhythmic patterns (e.g., Exactly 1 second between clicks).
- Use `browser_wait(Math.random() * 1000 + 500)` between distinct navigation phases.

## Behavioral Red Flags to Avoid
1. **Hidden Field Interaction**: Never type into or click elements with `display: none` or `visibility: hidden`.
2. **Hyper-Fast Navigation**: Rapidly cycling through URLs without allowing for resource loads or scripts to execute.
3. **Pure DOM Modification**: Relying solely on `browser_evaluate` to change values without triggering the associated UI events.
