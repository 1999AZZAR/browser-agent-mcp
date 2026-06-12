# CAPTCHA Handling

## Flow

```
browser_handle_captcha()
  ├─ Click reCAPTCHA checkbox
  ├─ If solved → done
  ├─ If image challenge → return { prompt, grid, screenshot }
  │    Agent analyzes screenshot, calls:
  │    browser_solve_captcha_grid(indices=[1-based tile numbers])
  │    Then verifies:
  │    browser_handle_captcha(verify=true)
  └─ If audio (optional, needs local whisper):
       browser_handle_captcha(audio=true)
```

## Tools

### `browser_handle_captcha`
Three modes:
- **Solve mode** (default): detect reCAPTCHA, click checkbox, return result
- **Verify mode** (`verify=true`): check if already solved after grid click
- **Audio mode** (`audio=true`): try to solve via local whisper CLI

For image challenge: returns prompt text, grid info, and screenshot.

### `browser_solve_captcha_grid`
Click image grid tiles by index. Uses 1-based indices (1-9 for 3x3 grid).
Click tiles that match the challenge prompt, then `browser_handle_captcha(verify=true)`.

## Audio (Optional)
Requires local whisper CLI (no API key needed):
```bash
pip install openai-whisper
# or
brew install whisper-cpp
```

## Env
| Variable | Purpose |
|----------|---------|
| None | All features work without API keys |
