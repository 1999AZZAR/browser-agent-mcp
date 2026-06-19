# Network Mocking

Mock API responses for frontend testing without touching the backend.

## browser_mock_network

Intercept network requests matching a URL pattern and return synthetic data.

### Usage
```
browser_mock_network(pattern="**/api/users*", body={ users: [] })
browser_mock_network(pattern="**/api/data*", body={ error: "Server Error" }, status=500)
browser_mock_network(pattern="**/api/slow*", body={ result: "ok" }, status=200)
```

### Parameters
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| pattern | string | required | URL glob pattern (`**` = any path, `*` = any chars) |
| body | string/object | required | Response body (objects auto-serialized to JSON) |
| status | number | 200 | HTTP status code |
| contentType | string | "application/json" | Content-Type header |

### Glob Pattern Examples
```
**/api/users*       → matches /api/users, /api/users/123, /api/users?page=1
**/*.json           → matches any .json file
**/api/*            → matches /api/anything
https://example.com → exact match
```

## browser_clear_mocks

Remove ALL active network mock routes and restore normal behavior.

### Usage
```
browser_clear_mocks()
```

## Common Workflows

### Test Error Handling
```
browser_mock_network(pattern="**/api/save*", body={ error: "Internal Server Error" }, status=500)
browser_click("#save-button")
browser_assert_visible(".error-toast")
browser_clear_mocks()
```

### Test Empty States
```
browser_mock_network(pattern="**/api/search*", body={ results: [], total: 0 })
browser_type("#search-input", "nonexistent")
browser_wait_for_change("#results")
browser_get_text("#results")  // shows "No results found"
browser_clear_mocks()
```

### Test Loading States
```
browser_mock_network(pattern="**/api/data*", body={ data: "loaded" })
browser_click("#load-data")
browser_assert_visible(".spinner")  // loading state visible
browser_wait_for_change("#content")
browser_clear_mocks()
```

### Isolate Frontend from Backend
```
// Mock ALL API endpoints before testing
browser_mock_network(pattern="**/api/**", body={ mock: true })
browser_navigate("http://localhost:3000")
// Frontend runs entirely against mocked data
... test interactions ...
browser_clear_mocks()
```

## Notes

- Mocks persist until `browser_clear_mocks()` is called
- Mocks take priority over real network requests
- Use `browser_intercept()` for more advanced scenarios (modify headers, block requests)
- For capturing real responses (read-only), use `browser_intercept_api()` instead
