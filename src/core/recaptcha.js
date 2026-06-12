const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const crypto = require('crypto');

const TEMP_DIR = '/tmp';

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

    // Click the checkbox with human-like behavior
    await anchorFrame.waitForSelector('.rc-anchor-content', { timeout: 7000 });
    await this._humanClick(anchorFrame, '.rc-anchor-content');
    await this.page.waitForTimeout(1500 + Math.random() * 1000);

    // Check if checkbox click solved it
    if (await this._isSolved()) return { method: 'click', solved: true };

    // Image challenge appeared
    const bframe = await this._getFrame('iframe[src*="bframe"]');
    if (!bframe) throw new Error('Challenge iframe not found');

    const challengeType = await this._detectChallengeType(bframe);

    if (challengeType === 'doscaptcha') throw new Error('Bot detected by reCAPTCHA');
    if (challengeType !== 'image') throw new Error(`Unsupported challenge type: ${challengeType}`);

    const info = await this._getImageChallengeInfo(bframe);
    return { method: 'image', solved: false, challenge: info };
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

    const challengeType = await this._detectChallengeType(bframe);
    if (challengeType === 'doscaptcha') throw new Error('Bot detected by reCAPTCHA');

    // Switch from image to audio if needed
    if (challengeType === 'image') {
      await this._switchToAudio(bframe);
      if (await this._isDetected()) throw new Error('Bot detected after audio switch');
    }

    const audioUrl = await this._getAudioUrl();
    if (!audioUrl) throw new Error('Could not find audio source URL');

    const text = await this._transcribeAudio(audioUrl);
    await this._submitAnswer(text);
    await this.page.waitForTimeout(1500);

    if (!(await this._isSolved())) throw new Error('reCAPTCHA submission failed');
    return { method: 'audio', solved: true, transcription: text };
  }

  // ── Internal ─────────────────────────────────────────────────────────────

  async _detectChallengeType(bframe) {
    const hasDoscaptcha = await bframe.evaluate(() =>
      document.body.innerText.includes('Try again later')
    ).catch(() => false);
    if (hasDoscaptcha) return 'doscaptcha';

    const hasImage = await bframe.$('.rc-image-tile-wrapper, .rc-imageselect-challenge').catch(() => null);
    if (hasImage) return 'image';

    const hasAudio = await bframe.$('#audio-source').catch(() => null);
    if (hasAudio) return 'audio';

    return 'unknown';
  }

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

  async _getFrame(selector) {
    const el = await this.page.waitForSelector(selector, { timeout: 7000 }).catch(() => null);
    if (!el) return null;
    return await el.contentFrame();
  }

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

  async _isDetected() {
    try {
      const bframe = await this._getFrame('iframe[src*="bframe"]');
      if (!bframe) return false;
      return await bframe.evaluate(() => document.body.innerText.includes('Try again later'));
    } catch { return false; }
  }

  async _switchToAudio(bframe) {
    const btn = await bframe.waitForSelector('#recaptcha-audio-button', { timeout: 5000 }).catch(() => null);
    if (!btn) throw new Error('Audio challenge button not found');
    await this._humanClick(bframe, '#recaptcha-audio-button');
    await this.page.waitForTimeout(2000);
  }

  async _getAudioUrl() {
    const bframe = await this._getFrame('iframe[src*="bframe"]');
    if (!bframe) return null;
    const blocked = await bframe.evaluate(() =>
      document.body.innerText.includes('Try again later')
    ).catch(() => false);
    if (blocked) throw new Error('Bot detected after audio switch');
    const src = await bframe.waitForSelector('#audio-source', { timeout: 7000 }).catch(() => null);
    if (!src) return null;
    return await src.getAttribute('src');
  }

  /**
   * Transcribe audio using local whisper via @xenova/transformers (no API key).
   * Downloads the model on first use (~100MB for tiny model).
   */
  async _transcribeAudio(audioUrl) {
    const tmpId = crypto.randomInt(10000, 99999);
    const mp3 = path.join(TEMP_DIR, `recaptcha_${tmpId}.mp3`);
    const wav = path.join(TEMP_DIR, `recaptcha_${tmpId}.wav`);

    try {
      const resp = await fetch(audioUrl);
      if (!resp.ok) throw new Error(`Audio download failed: ${resp.status}`);
      fs.writeFileSync(mp3, Buffer.from(await resp.arrayBuffer()));
      execSync(`ffmpeg -y -i "${mp3}" -ar 16000 -ac 1 "${wav}" 2>/dev/null`, { stdio: 'pipe' });

      const { pipeline } = require('@xenova/transformers');
      const transcriber = await pipeline('automatic-speech-recognition', 'Xenova/whisper-tiny');
      const result = await transcriber(wav);
      return result.text.trim();
    } finally {
      for (const p of [mp3, wav]) {
        try { if (fs.existsSync(p)) fs.unlinkSync(p); } catch {}
      }
    }
  }

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
