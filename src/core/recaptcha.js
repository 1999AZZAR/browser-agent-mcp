/*
 * Copyright (c) 2026 Azzar Budiyanto / LilyOpenCMS.
 * Licensed under the MIT License.
 * Contact: azzar.mr.zs@gmail.com for inquiries.
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const crypto = require('crypto');

const TEMP_DIR = '/tmp';

// reCAPTCHA solver — handles checkbox, image, and audio challenges.
// Strategy:
// 1. Click checkbox — sometimes this alone solves it (low-friction sessions)
// 2. If image challenge appears — extract tile info for agent to solve visually
// 3. If audio challenge — transcribe via local Whisper model (no API key needed)
//
// The solver works within Playwright's cross-origin frame access.
// reCAPTCHA uses nested iframes: anchor (checkbox) → bframe (challenge).
class RecaptchaSolver {
  constructor(page) {
    this.page = page;
  }

  /**
   * Try to solve the reCAPTCHA. Returns:
   * - { method: 'click', solved: true } if checkbox solved it
   * - { method: 'image', solved: false, challenge: {...} } if image challenge (agent handles this)
   * - Throws on doscaptcha or unsupported challenge types
   */
  async solve() {
    const anchorFrame = await this._getFrame('iframe[title="reCAPTCHA"]');
    if (!anchorFrame) throw new Error('reCAPTCHA iframe not found');

    // Click checkbox with human-like behavior to avoid bot detection
    await anchorFrame.waitForSelector('.rc-anchor-content', { timeout: 7000 });
    await this._humanClick(anchorFrame, '.rc-anchor-content');
    await this.page.waitForTimeout(1500 + Math.random() * 1000);

    // Check if checkbox click solved it — happens in low-risk sessions
    if (await this._isSolved()) return { method: 'click', solved: true };

    // Challenge appeared — detect type and return immediately
    // Agent will handle image challenges via screenshot + visual analysis
    const bframe = await this._getFrame('iframe[src*="bframe"]');
    if (!bframe) throw new Error('Challenge iframe not found');

    const challengeType = await this._detectChallengeType(bframe);

    if (challengeType === 'doscaptcha') throw new Error('Bot detected by reCAPTCHA');
    if (challengeType !== 'image' && challengeType !== 'audio') throw new Error(`Unsupported challenge type: ${challengeType}`);

    if (challengeType === 'image') {
      const info = await this._getImageChallengeInfo(bframe);
      return { method: 'image', solved: false, challenge: info };
    }

    // Audio challenge detected
    return { method: 'audio', solved: false, challenge: { type: 'audio' } };
  }

  /**
   * Verify if the reCAPTCHA is now solved (after agent clicks tiles).
   */
  async verifySolved() {
    return this._isSolved();
  }

  /**
   * Attempt audio challenge solving via local whisper (no API key).
   * Only works if whisper CLI is available on the system.
   * Returns transcription or throws.
   */
  async solveAudio() {
    const bframe = await this._getFrame('iframe[src*="bframe"]');
    if (!bframe) throw new Error('Challenge iframe not found');
    console.log('[CAPTCHA] bframe found');

    const challengeType = await this._detectChallengeType(bframe);
    console.log('[CAPTCHA] detected type:', challengeType);
    if (challengeType === 'doscaptcha') throw new Error('Bot detected by reCAPTCHA');

    // Switch from image to audio if needed — audio is easier to solve programmatically
    if (challengeType === 'image') {
      console.log('[CAPTCHA] switching to audio...');
      await this._switchToAudio(bframe);
      if (await this._isDetected()) throw new Error('Bot detected after audio switch');
      console.log('[CAPTCHA] switched to audio');
    }

    // Click PLAY to load the audio source — required before transcription
    const playBtn = await bframe.waitForSelector('#recaptcha-audio-play-button', { timeout: 5000 }).catch(() => null);
    if (playBtn) {
      console.log('[CAPTCHA] clicking PLAY...');
      await this._humanClick(bframe, '#recaptcha-audio-play-button');
      await this.page.waitForTimeout(3000);
      console.log('[CAPTCHA] PLAY clicked, waiting for audio...');
    } else {
      console.log('[CAPTCHA] no PLAY button found');
    }

    const audioUrl = await this._getAudioUrl();
    console.log('[CAPTCHA] audio URL:', audioUrl ? audioUrl.substring(0, 80) : 'null');
    if (!audioUrl) throw new Error('Could not find audio source URL');

    console.log('[CAPTCHA] transcribing...');
    const text = await this._transcribeAudio(audioUrl);
    console.log('[CAPTCHA] transcription:', text);
    await this._submitAnswer(text);
    await this.page.waitForTimeout(1500);

    if (!(await this._isSolved())) throw new Error('reCAPTCHA submission failed');
    return { method: 'audio', solved: true, transcription: text };
  }

  // ── Internal ─────────────────────────────────────────────────────────────

  // Detect challenge type by inspecting DOM elements in the bframe.
  // reCAPTCHA signals its state through specific CSS classes and input presence.
  async _detectChallengeType(bframe) {
    const hasDoscaptcha = await bframe.evaluate(() =>
      document.body.innerText.includes('Try again later')
    ).catch(() => false);
    if (hasDoscaptcha) return 'doscaptcha';

    // Check actual visible state — most reliable for cross-origin frames
    const type = await bframe.evaluate(() => {
      // Audio challenge indicators
      const audioInput = document.querySelector('#audio-response');
      const playBtn = document.querySelector('#recaptcha-audio-play-button');
      const pressPlayText = document.body.innerText.includes('Press PLAY to listen');
      if (audioInput || playBtn || pressPlayText) return 'audio';

      // Image challenge indicators
      const imgTiles = document.querySelector('.rc-image-tile-wrapper');
      const imgChallenge = document.querySelector('.rc-imageselect-challenge');
      if (imgTiles || imgChallenge) return 'image';

      return 'unknown';
    }).catch(() => 'unknown');

    return type;
  }

  // Extract image challenge metadata for agent visual solving
  async _getImageChallengeInfo(bframe) {
    const prompt = await bframe.evaluate(() => {
      const el = document.querySelector('.rc-imageselect-desc-no-canonical, .rc-imageselect-desc, .rc-imageselect-instructions');
      return el ? el.innerText.replace(/\s+/g, ' ').trim() : '';
    }).catch(() => '');

    const tileData = await bframe.evaluate(() => {
      const tiles = document.querySelectorAll('.rc-imageselect-tile');
      return Array.from(tiles).map((t, i) => ({
        index: i,
        id: t.id || String(i),
      }));
    }).catch(() => []);

    return {
      type: 'image',
      prompt,
      gridSize: Math.round(Math.sqrt(tileData.length)),
      tiles: tileData,
      tileCount: tileData.length,
    };
  }

  // Simulate human-like click: move to element center with jitter, pause, then click.
  // Why: reCAPTCHA monitors mouse trajectory for bot detection.
  async _humanClick(frame, selector) {
    const el = await frame.$(selector);
    if (!el) { await frame.click(selector, { delay: 80 + Math.random() * 120 }); return; }
    const box = await el.boundingBox();
    if (!box) { await frame.click(selector, { delay: 80 + Math.random() * 120 }); return; }
    const cx = box.x + box.width / 2 + (Math.random() - 0.5) * 4;
    const cy = box.y + box.height / 2 + (Math.random() - 0.5) * 4;
    await this.page.mouse.move(cx, cy, { steps: 6 + Math.floor(Math.random() * 6) });
    await this.page.waitForTimeout(100 + Math.random() * 300);
    await this.page.mouse.click(cx, cy, { delay: 60 + Math.random() * 100 });
  }

  // Get a cross-origin frame by selector — reCAPTCHA uses nested iframes
  async _getFrame(selector) {
    const el = await this.page.waitForSelector(selector, { timeout: 7000 }).catch(() => null);
    if (!el) return null;
    return await el.contentFrame();
  }

  // Check if reCAPTCHA checkbox is checked — aria-checked="true" means solved
  async _isSolved() {
    const el = await this.page.$('iframe[title="reCAPTCHA"]');
    if (!el) return false;
    const frame = await el.contentFrame();
    if (!frame) return false;
    try {
      return await frame.evaluate(() => {
        const cb = document.querySelector('.recaptcha-checkbox');
        if (!cb) return false;
        return cb.getAttribute('aria-checked') === 'true';
      });
    } catch { return false; }
  }

  // Detect if reCAPTCHA has blocked us — "Try again later" means bot detected
  async _isDetected() {
    try {
      const bframe = await this._getFrame('iframe[src*="bframe"]');
      if (!bframe) return false;
      return await bframe.evaluate(() => document.body.innerText.includes('Try again later'));
    } catch { return false; }
  }

  // Switch from image to audio challenge — audio is easier to solve programmatically
  async _switchToAudio(bframe) {
    const btn = await bframe.waitForSelector('#recaptcha-audio-button', { timeout: 5000 }).catch(() => null);
    if (!btn) throw new Error('Audio challenge button not found');
    await this._humanClick(bframe, '#recaptcha-audio-button');
    await this.page.waitForTimeout(2000);
  }

  // Extract audio source URL from the challenge iframe
  async _getAudioUrl() {
    const bframe = await this._getFrame('iframe[src*="bframe"]');
    if (!bframe) { console.log('[CAPTCHA] _getAudioUrl: no bframe'); return null; }
    const blocked = await bframe.evaluate(() =>
      document.body.innerText.includes('Try again later')
    ).catch(() => false);
    if (blocked) throw new Error('Bot detected after audio switch');

    // Try multiple selectors — reCAPTCHA DOM structure varies across versions
    const src = await bframe.waitForSelector('#audio-source', { timeout: 7000 }).catch(() => null);
    if (src) {
      const url = await src.getAttribute('src');
      console.log('[CAPTCHA] _getAudioUrl: found #audio-source, url:', url ? url.substring(0, 80) : 'empty');
      return url;
    }

    // Fallback: check for source element inside audio
    const sourceEl = await bframe.$('audio source, #audio-source source').catch(() => null);
    if (sourceEl) {
      const url = await sourceEl.getAttribute('src');
      console.log('[CAPTCHA] _getAudioUrl: found source element, url:', url ? url.substring(0, 80) : 'empty');
      return url;
    }

    console.log('[CAPTCHA] _getAudioUrl: no audio element found');
    return null;
  }

  /**
   * Transcribe audio using local whisper via @xenova/transformers (no API key).
   * Downloads the model on first use (~100MB for tiny model).
   * Converts MP3→WAV (16kHz mono) for whisper compatibility.
   */
  async _transcribeAudio(audioUrl) {
    const tmpId = crypto.randomInt(10000, 99999);
    const mp3 = path.join(TEMP_DIR, `recaptcha_${tmpId}.mp3`);
    const wav = path.join(TEMP_DIR, `recaptcha_${tmpId}.wav`);

    try {
      const resp = await fetch(audioUrl);
      if (!resp.ok) throw new Error(`Audio download failed: ${resp.status}`);
      fs.writeFileSync(mp3, Buffer.from(await resp.arrayBuffer()));
      // Convert to 16kHz mono WAV — whisper requires this format
      execSync(`ffmpeg -y -i "${mp3}" -ar 16000 -ac 1 "${wav}" 2>/dev/null`, { stdio: 'pipe' });

      const { pipeline } = require('@xenova/transformers');
      const transcriber = await pipeline('automatic-speech-recognition', 'Xenova/whisper-tiny');
      const audioBuffer = fs.readFileSync(wav);
      // Convert int16 PCM to float32 normalized [-1, 1] — whisper input format
      const int16 = new Int16Array(audioBuffer.buffer, audioBuffer.byteOffset, audioBuffer.byteLength / 2);
      const float32 = Float32Array.from(int16, s => s / 32768);
      const result = await transcriber(float32, { sampling_rate: 16000 });
      return result.text.trim();
    } finally {
      // Clean up temp files — always, even on error
      for (const p of [mp3, wav]) {
        try { if (fs.existsSync(p)) fs.unlinkSync(p); } catch {}
      }
    }
  }

  // Submit the transcribed text and click verify
  async _submitAnswer(text) {
    const bframe = await this._getFrame('iframe[src*="bframe"]');
    if (!bframe) throw new Error('Challenge iframe lost');
    const input = await bframe.waitForSelector('#audio-response', { timeout: 5000 }).catch(() => null);
    if (input) await input.fill(text.toLowerCase());
    const verify = await bframe.waitForSelector('#recaptcha-verify-button', { timeout: 5000 }).catch(() => null);
    if (verify) await this._humanClick(bframe, '#recaptcha-verify-button');
    await this.page.waitForTimeout(1500);
  }
}

module.exports = { RecaptchaSolver };
