# Browsing Patterns

Standardized interaction flows for common web automation scenarios.

## 1. Unified Search Pattern
Applicable to search engines, internal documentation, and storefronts.

1. **Entry**: Navigate to the base domain.
2. **Identification**: Call `browser_get_state` to locate the input field (usually `INPUT` or `TEXTAREA` with `role="combobox"`).
3. **Execution**:
    - Focus field via `browser_click`.
    - Insert query via `browser_type` with human-like delay (100ms+).
    - Trigger search via `browser_press("Enter")`.
4. **Synchronization**: `browser_wait_for_url` or `browser_wait_for_selector` for result container.
5. **Validation**: Capture state to verify result set relevance.

## 2. Deep Content Extraction
Used for research and data gathering.

1. **Discovery**: `browser_get_state` to find headings and semantic text blocks.
2. **Expansion**: Use `browser_smart_scroll` to trigger lazy-loading of media or dynamic blocks.
3. **Extraction**:
    - `browser_get_text` for specific metadata.
    - `browser_get_html` for structural preservation of complex tables/lists.
    - `browser_print_to_pdf` for a permanent high-fidelity record.

## 3. Form-to-Workflow Pattern
Handling registration, checkout, or configuration panels.

1. **Mapping**: Capture state to identify all required fields (`name`, `id`, `placeholder`).
2. **Fulfillment**:
    - Iteratively fill text inputs using `browser_type`.
    - Handle dropdowns via `browser_select`.
    - Toggle states via `browser_check`/`browser_uncheck`.
3. **Submission**: Click the primary CTA identified by `role="button"` or text content (e.g., "Submit", "Save", "Continue").
4. **Handling Feedback**: Check for `popups` in state (errors or success toasts) and use `browser_dismiss_popups` if necessary.

## 4. Troubleshooting Intercepted Interactions
What to do when an element is blocked.

1. **Heuristic Dismissal**: Call `browser_dismiss_popups`.
2. **Coordinate Fallback**: If a selector fails, use the `x`, `y` coordinates provided in the `elements` array of `browser_get_state`.
3. **Scripted Override**: Use `browser_evaluate` to force a click or state change via the DOM API if standard pointer events are suppressed.
