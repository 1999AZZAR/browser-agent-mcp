# CAPTCHA Handling — Agent Rules

## MANDATORY Agent Flow

```
1. ALWAYS check state first:
   browser_handle_captcha(verify=true)
   → If "CAPTCHA solved" → STOP, done.

2. If not solved, start challenge:
   browser_handle_captcha()
   → Returns: challenge type + screenshot (if image)

3. Image challenge:
   - Analyze screenshot visually
   - Call browser_solve_captcha_grid(indices=[tile numbers])
   - Then verify: browser_handle_captcha(verify=true)
   - If not solved → try AGAIN (max 2 attempts)

4. If image fails 2x → SWITCH TO AUDIO:
   browser_handle_captcha(audio=true, timeout=25000)

5. If audio fails → try image again with fresh challenge

6. NEVER loop same approach more than 2 times without switching.
```

## Strategy Switching Rules

| Situation | Action |
|-----------|--------|
| Image fails 2x | Switch to audio |
| Audio fails | Switch to image |
| Both fail 2x each | Take screenshot, report to user |
| "Verification expired" | Re-click checkbox via `browser_handle_captcha()` |
| "Challenge iframe not found" | Page may have changed — screenshot first |
| User says they solved it | `browser_handle_captcha(verify=true)` to confirm |

## Tools

### `browser_handle_captcha`
Three modes:
- **Default**: clicks checkbox, detects type, returns immediately
- **Verify** (`verify=true`): checks if solved
- **Audio** (`audio=true`, `timeout=25000`): whisper solve with timeout

### `browser_solve_captcha_grid`
- `indices=[1,3,5]` — 1-based tile numbers
- Analyze the screenshot yourself — don't guess
- Click verify after: `browser_handle_captcha(verify=true)`

## Key Rules

1. **NEVER** call same tool >2 times without switching strategy
2. **ALWAYS** verify after grid click
3. **ALWAYS** check verify before starting new challenge
4. **SCREENSHOT** when stuck — don't loop blindly
5. Audio timeout default 25s — set shorter if impatient
