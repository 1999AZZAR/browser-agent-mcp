# CAPTCHA Handling

The browser-agent has a multi-layered CAPTCHA handling strategy:

## Tools

### `browser_handle_captcha`
Auto-solves reCAPTCHA v2 via audio transcription. Uses `ffmpeg` + either OpenAI Whisper or Google Speech API. Falls back to manual wait on failure.

**Flow:**
1. Detect reCAPTCHA iframe on page
2. Click the "I'm not a robot" checkbox (often solves for low-risk traffic)
3. If image challenge appears, switch to audio challenge
4. Download MP3, convert to WAV via `ffmpeg`, transcribe
5. Submit answer, verify

**Backends (tried in order):**
- `OPENAI_API_KEY` set → OpenAI Whisper API (recommended, best accuracy)
- Otherwise → Google free Speech API (same as Python `speech_recognition` library)

**Limitations:**
- Google's server-side bot detection may block the audio challenge switch on aggressive deployments
- The demo page (`google.com/recaptcha/api2/demo`) is known to be blocked
- May work better on real websites with standard reCAPTCHA configuration
- Always falls back to manual waiting if auto-solve fails

### `browser_solve_captcha_grid`
Manually specify grid click positions for visual CAPTCHAs. Not automated — requires the AI agent to determine which grid cells to click.

## Environment Variables

| Variable | Purpose |
|----------|---------|
| `OPENAI_API_KEY` | Enable OpenAI Whisper for audio transcription (highest accuracy) |
| `GOOGLE_SPEECH_API_KEY` | Custom Google Speech API key (default uses built-in key) |
| `BROWSER_HEADLESS` | Set to `true` for headless mode (may increase bot detection) |

## Testing

```bash
# Test with Google's demo page
node -e "
const { chromium } = require('playwright');
const { RecaptchaSolver } = require('./src/core/recaptcha');
(async () => {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  await page.goto('https://www.google.com/recaptcha/api2/demo');
  const solver = new RecaptchaSolver(page);
  const result = await solver.solve().catch(e => e.message);
  console.log('Result:', result);
  await browser.close();
})();
"
```
