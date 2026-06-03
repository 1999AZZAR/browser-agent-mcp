# Common Automation Patterns

## Search Flow
```
browser_navigate(url)
browser_get_state()                          // locate input: role="combobox" or INPUT
browser_click(input_selector)
browser_type(input_selector, query, delay=100)
browser_press("Enter")
browser_wait_for_selector(results_container) // or browser_wait_for_url(pattern)
browser_get_state()                          // verify result relevance
```

## Form Fill Flow
```
browser_get_state()                          // map all fields: name, id, placeholder
// For each field:
browser_scroll_to(field_selector)
browser_type(field_selector, value, delay=120)
// For dropdowns:
browser_select(selector, value)
// For checkboxes:
browser_check(selector) / browser_uncheck(selector)
// Submit:
browser_click(submit_selector)              // role="button" or text match
browser_dismiss_popups()                    // catch error/success toasts
```

## Deep Content Extraction
```
browser_get_state()                          // identify semantic headings and blocks
browser_smart_scroll(steps=7)               // trigger lazy-loaded media/sections
browser_get_text(selector)                  // targeted text extraction
browser_get_html(selector)                  // preserve tables/lists structure
browser_print_to_pdf()                      // permanent high-fidelity record
```

## Blocked Element Recovery
```
// Step 1: dismiss any overlay
browser_dismiss_popups()
// Step 2: coordinate fallback — get x,y from browser_get_state() elements array
browser_click(x=target_x, y=target_y)
// Step 3: JS override — when pointer events are suppressed
browser_evaluate("document.querySelector(selector).click()")
```
