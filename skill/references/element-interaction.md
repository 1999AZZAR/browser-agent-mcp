# Element Interaction and Selector Strategy

Guidelines for robust element identification and interaction within dynamic web environments.

## Selector Hierarchy
When choosing a selector, prioritize robustness in the following order:

1. **ID**: `#main-cta` (Fastest, least prone to structural changes).
2. **Data Attributes**: `[data-testid="submit-button"]` (Standard for modern React/Vue apps).
3. **Role & Text**: `button:has-text("Login")` or `[role="button"]` (Semantic and resilient to class name changes).
4. **CSS Classes**: `.btn-primary` (Use with caution; often used for styling and subject to change).
5. **XPath**: `/html/body/div[1]/...` (Last resort; brittle and difficult to maintain).

## Utilizing the AX Tree (Accessibility Tree)
The `browser_get_state` tool provides an `axTree` property. This is the most "human-like" way to view the page.

- **Semantic Meaning**: Focus on elements with clear `name` and `role` properties in the tree.
- **Focusability**: Elements marked as `focusable` in the AX Tree are the primary targets for `browser_click` and `browser_type`.
- **Relationship Mapping**: Use the tree to understand parent-child relationships that might be obscured in a flat CSS structure.

## Handling Dynamic Content
Web apps often load elements asynchronously or change states based on interaction.

### 1. Verification of Existence
Before acting, ensure the element is in the DOM:
`browser_wait_for_selector(selector, timeout=5000)`

### 2. State-Based Action
If an action triggers a load:
1. `browser_click(selector)`
2. `browser_wait_for_load_state("networkidle")`
3. `browser_get_state()` // Re-sense the new reality.

### 3. Coordinate-Based Fallbacks
In rare cases where selectors are obfuscated or duplicated:
1. Use `browser_get_state` to get the `x`, `y`, `w`, `h` of the target.
2. Calculate the center point: `target_x = x + w/2`, `target_y = y + h/2`.
3. Call `browser_click(x=target_x, y=target_y)`.

## Form Interaction Checklist
- [ ] Element is visible in viewport (`browser_scroll_to` if needed).
- [ ] Element is enabled (check `axTree` state).
- [ ] Interaction triggers expected event (wait for change).
