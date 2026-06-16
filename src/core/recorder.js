/*
 * Copyright (c) 2026 Azzar Budiyanto / LilyOpenCMS.
 * Licensed under the MIT License.
 * Contact: azzar.mr.zs@gmail.com for inquiries.
 */
const path = require('path');
const fs = require('fs');

// In-memory action buffer — stores all recorded actions during a macro session.
// Actions are simple objects: { type, args, ts } where type is the tool name.
const _actions = [];

// Record a browser action. Called by the tool handler when macro recording is active.
// Each action captures the tool name, its arguments, and a timestamp for replay timing.
function record(type, args) {
    _actions.push({ type, args, ts: Date.now() });
}

// Clear the recording buffer — called at the start of a new recording session.
function clear() { _actions.length = 0; }

// Generate a Playwright test script from recorded actions.
// This produces a runnable .spec.js file that can be executed with `npx playwright test`.
// The script preserves action order, selectors, and timing for faithful replay.
function generate(testName = 'recorded_session') {
    if (!_actions.length) return null;

    const lines = [
        `const { test, expect } = require('@playwright/test');`,
        ``,
        `test('${testName}', async ({ page }) => {`,
    ];

    for (const action of _actions) {
        switch (action.type) {
            case 'navigate':
                lines.push(`  await page.goto('${esc(action.args.url)}');`);
                break;
            case 'click_selector':
                lines.push(`  await page.click('${esc(action.args.selector)}');`);
                break;
            case 'click_text': {
                // Generate a robust selector that works across page variants
                const baseSelector = action.args.elType === 'button'
                    ? 'button, [role="button"]'
                    : action.args.elType === 'link' ? 'a' : '*';
                lines.push(`  await page.locator('${esc(baseSelector)}').filter({ hasText: '${esc(action.args.text)}' }).first().click();`);
                break;
            }
            case 'click_coords':
                lines.push(`  await page.mouse.click(${action.args.x}, ${action.args.y});`);
                break;
            case 'click_ref':
                // Ref-based clicks include a comment for debugging
                lines.push(`  // ref ${action.args.ref}: ${esc(action.args.label || '')}`);
                if (action.args.selector) {
                    lines.push(`  await page.click('${esc(action.args.selector)}');`);
                } else {
                    lines.push(`  await page.mouse.click(${action.args.x}, ${action.args.y});`);
                }
                break;
            case 'type':
                lines.push(`  await page.type('${esc(action.args.selector)}', '${esc(action.args.text)}');`);
                break;
            case 'fill':
                lines.push(`  await page.fill('${esc(action.args.selector)}', '${esc(action.args.value)}');`);
                break;
            case 'press':
                lines.push(`  await page.keyboard.press('${esc(action.args.key)}');`);
                break;
            case 'select':
                lines.push(`  await page.selectOption('${esc(action.args.selector)}', '${esc(action.args.value)}');`);
                break;
            case 'check':
                lines.push(`  await page.check('${esc(action.args.selector)}');`);
                break;
            case 'uncheck':
                lines.push(`  await page.uncheck('${esc(action.args.selector)}');`);
                break;
            case 'wait_for_selector':
                lines.push(`  await page.waitForSelector('${esc(action.args.selector)}');`);
                break;
            case 'wait_for_url':
                lines.push(`  await page.waitForURL('${esc(action.args.pattern)}');`);
                break;
            case 'assert_url':
                lines.push(`  await expect(page).toHaveURL('${esc(action.args.pattern)}');`);
                break;
            case 'assert_text':
                lines.push(`  await expect(page.locator('${esc(action.args.selector)}')).toContainText('${esc(action.args.expected)}');`);
                break;
        }
    }

    lines.push(`});`);
    return lines.join('\n');
}

// Escape single quotes and backslashes for safe embedding in generated scripts.
function esc(s) {
    return String(s || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

// Get a copy of all recorded actions — used for JSON export and replay.
function getActions() { return _actions.slice(); }

module.exports = { record, clear, generate, getActions };
