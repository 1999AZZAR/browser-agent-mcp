const { getPage, closeBrowser, listPages, switchPage, newPage } = require('../core/browser');
const { captureState } = require('../core/state');
const fs = require('fs');
const path = require('path');

const AGENT_CONFIG = {
    profile: 'stealth', // 'stealth' or 'speed'
};

const TOOLS = [
    // ── Navigation & Tabs ─────────────────────────────────────────────────────
    {
        name: 'browser_navigate',
        description: 'Navigate to a URL.',
        inputSchema: {
            type: 'object',
            properties: { url: { type: 'string' } },
            required: ['url'],
        },
    },
    {
        name: 'browser_new_tab',
        description: 'Open a new browser tab.',
        inputSchema: {
            type: 'object',
            properties: { url: { type: 'string' } },
        },
    },
    {
        name: 'browser_list_tabs',
        description: 'List all open browser tabs.',
        inputSchema: { type: 'object', properties: {} },
    },
    {
        name: 'browser_switch_tab',
        description: 'Switch to a specific tab by index.',
        inputSchema: {
            type: 'object',
            properties: { index: { type: 'number' } },
            required: ['index'],
        },
    },
    {
        name: 'browser_wait_until_stable',
        description: 'Wait for the page to reach a stable state (networkidle).',
        inputSchema: {
            type: 'object',
            properties: { timeout: { type: 'number', default: 30000 } },
        },
    },
    {
        name: 'browser_back',
        description: 'Navigate back in history.',
        inputSchema: { type: 'object', properties: {} },
    },
    {
        name: 'browser_forward',
        description: 'Navigate forward in history.',
        inputSchema: { type: 'object', properties: {} },
    },
    {
        name: 'browser_reload',
        description: 'Reload the current page.',
        inputSchema: { type: 'object', properties: {} },
    },
    {
        name: 'browser_wait',
        description: 'Wait for a specified number of milliseconds.',
        inputSchema: {
            type: 'object',
            properties: { ms: { type: 'number' } },
            required: ['ms'],
        },
    },
    {
        name: 'browser_wait_for_selector',
        description: 'Wait for an element to appear.',
        inputSchema: {
            type: 'object',
            properties: {
                selector: { type: 'string' },
                timeout: { type: 'number', default: 10000 },
            },
            required: ['selector'],
        },
    },
    {
        name: 'browser_wait_for_url',
        description: 'Wait for the URL to match a pattern.',
        inputSchema: {
            type: 'object',
            properties: {
                pattern: { type: 'string', description: 'Substring or regex (prefixed with regex:)' },
                timeout: { type: 'number', default: 15000 },
            },
            required: ['pattern'],
        },
    },

    // ── Interaction ───────────────────────────────────────────────────────────
    {
        name: 'browser_click',
        description: 'Click an element.',
        inputSchema: {
            type: 'object',
            properties: {
                selector: { type: 'string' },
                x: { type: 'number' },
                y: { type: 'number' },
            },
        },
    },
    {
        name: 'browser_click_text',
        description: 'Click an element containing specific text.',
        inputSchema: {
            type: 'object',
            properties: {
                text: { type: 'string' },
                type: { type: 'string', enum: ['button', 'link', 'any'], default: 'any' },
            },
            required: ['text'],
        },
    },
    {
        name: 'browser_fill_form',
        description: 'Fill multiple form fields at once.',
        inputSchema: {
            type: 'object',
            properties: {
                data: { type: 'object', description: 'Key-value pairs of selector: value' },
                submit: { type: 'boolean', default: false, description: 'Whether to press Enter after filling' },
            },
            required: ['data'],
        },
    },
    {
        name: 'browser_double_click',
        description: 'Double-click an element.',
        inputSchema: {
            type: 'object',
            properties: {
                selector: { type: 'string' },
                x: { type: 'number' },
                y: { type: 'number' },
            },
        },
    },
    {
        name: 'browser_right_click',
        description: 'Right-click an element.',
        inputSchema: {
            type: 'object',
            properties: {
                selector: { type: 'string' },
                x: { type: 'number' },
                y: { type: 'number' },
            },
        },
    },
    {
        name: 'browser_hover',
        description: 'Hover over an element.',
        inputSchema: {
            type: 'object',
            properties: {
                selector: { type: 'string' },
                x: { type: 'number' },
                y: { type: 'number' },
            },
        },
    },
    {
        name: 'browser_drag',
        description: 'Drag from source to target.',
        inputSchema: {
            type: 'object',
            properties: {
                source: { type: 'string', description: 'Source selector' },
                target: { type: 'string', description: 'Target selector' },
            },
            required: ['source', 'target'],
        },
    },
    {
        name: 'browser_scroll',
        description: 'Scroll the page.',
        inputSchema: {
            type: 'object',
            properties: {
                direction: { type: 'string', enum: ['up', 'down'], default: 'down' },
                amount: { type: 'number' },
            },
        },
    },
    {
        name: 'browser_scroll_to',
        description: 'Scroll to an element or coordinates.',
        inputSchema: {
            type: 'object',
            properties: {
                selector: { type: 'string' },
                x: { type: 'number' },
                y: { type: 'number' },
            },
        },
    },
    {
        name: 'browser_smart_scroll',
        description: 'Incremental scroll to trigger lazy loading.',
        inputSchema: {
            type: 'object',
            properties: {
                steps: { type: 'number', default: 5 },
                delayMs: { type: 'number', default: 800 },
            },
        },
    },

    // ── Forms & Input ─────────────────────────────────────────────────────────
    {
        name: 'browser_type',
        description: 'Type text into a field with optional human-like delay.',
        inputSchema: {
            type: 'object',
            properties: {
                selector: { type: 'string' },
                text: { type: 'string' },
                delay: { type: 'number', description: 'Delay between keypresses in ms.', default: 50 },
            },
            required: ['selector', 'text'],
        },
    },
    {
        name: 'browser_clear',
        description: 'Clear an input field.',
        inputSchema: {
            type: 'object',
            properties: { selector: { type: 'string' } },
            required: ['selector'],
        },
    },
    {
        name: 'browser_press',
        description: 'Press a keyboard key.',
        inputSchema: {
            type: 'object',
            properties: { key: { type: 'string' } },
            required: ['key'],
        },
    },
    {
        name: 'browser_select',
        description: 'Select an option in a dropdown.',
        inputSchema: {
            type: 'object',
            properties: {
                selector: { type: 'string' },
                value: { type: 'string', description: 'Value or label text' },
            },
            required: ['selector', 'value'],
        },
    },
    {
        name: 'browser_check',
        description: 'Check a checkbox or radio.',
        inputSchema: {
            type: 'object',
            properties: { selector: { type: 'string' } },
            required: ['selector'],
        },
    },
    {
        name: 'browser_uncheck',
        description: 'Uncheck a checkbox.',
        inputSchema: {
            type: 'object',
            properties: { selector: { type: 'string' } },
            required: ['selector'],
        },
    },

    // ── Observation ───────────────────────────────────────────────────────────
    {
        name: 'browser_get_state',
        description: 'Capture the current page state.',
        inputSchema: { type: 'object', properties: {} },
    },
    {
        name: 'browser_get_text',
        description: 'Read text from element(s).',
        inputSchema: {
            type: 'object',
            properties: {
                selector: { type: 'string' },
                all: { type: 'boolean', default: false },
            },
            required: ['selector'],
        },
    },
    {
        name: 'browser_get_html',
        description: 'Get the full HTML content of the page or a specific element.',
        inputSchema: {
            type: 'object',
            properties: {
                selector: { type: 'string', description: 'Optional selector to get innerHTML of.' },
            },
        },
    },
    {
        name: 'browser_screenshot',
        description: 'Take a screenshot.',
        inputSchema: { type: 'object', properties: {} },
    },
    {
        name: 'browser_print_to_pdf',
        description: 'Print the current page to a PDF file.',
        inputSchema: {
            type: 'object',
            properties: {
                landscape: { type: 'boolean', default: false },
                printBackground: { type: 'boolean', default: true },
                format: { type: 'string', default: 'A4' },
            },
        },
    },
    {
        name: 'browser_get_cookies',
        description: 'Get current browser cookies for the active page.',
        inputSchema: { type: 'object', properties: {} },
    },
    {
        name: 'browser_evaluate',
        description: 'Run JavaScript in the browser.',
        inputSchema: {
            type: 'object',
            properties: { script: { type: 'string' } },
            required: ['script'],
        },
    },
    {
        name: 'browser_extract_table',
        description: 'Extract data from an HTML table into JSON.',
        inputSchema: {
            type: 'object',
            properties: {
                selector: { type: 'string', description: 'CSS selector for the table' },
                header: { type: 'boolean', default: true, description: 'Whether the first row is a header' },
            },
            required: ['selector'],
        },
    },
    {
        name: 'browser_save_session',
        description: 'Save the current session (cookies) with a name.',
        inputSchema: {
            type: 'object',
            properties: { name: { type: 'string' } },
            required: ['name'],
        },
    },
    {
        name: 'browser_load_session',
        description: 'Load a previously saved session (cookies).',
        inputSchema: {
            type: 'object',
            properties: { name: { type: 'string' } },
            required: ['name'],
        },
    },
    {
        name: 'browser_close',
        description: 'Close the browser session and clear state.',
        inputSchema: { type: 'object', properties: {} },
    },
    {
        name: 'browser_set_agent_profile',
        description: 'Set the agent behavior profile.',
        inputSchema: {
            type: 'object',
            properties: {
                profile: { type: 'string', enum: ['stealth', 'speed'], default: 'stealth' },
            },
            required: ['profile'],
        },
    },
    {
        name: 'browser_handle_captcha',
        description: 'Attempt to detect and handle CAPTCHA challenges.',
        inputSchema: {
            type: 'object',
            properties: {
                wait: { type: 'boolean', default: true, description: 'Whether to wait for manual solving if automated attempt fails.' },
                timeout: { type: 'number', default: 60000, description: 'Max time to wait for manual solving (ms).' }
            }
        },
    },

    // ── Helpers ───────────────────────────────────────────────────────────────
    {
        name: 'browser_dismiss_popups',
        description: 'Try to dismiss common popups and banners.',
        inputSchema: { type: 'object', properties: {} },
    },
];

async function handleToolCall(name, args) {
    const page = await getPage();

    switch (name) {
        // Navigation
        case 'browser_navigate':
            await page.goto(args.url, { waitUntil: 'load' });
            return { content: [{ type: 'text', text: `Navigated to ${args.url}` }] };
        case 'browser_new_tab': {
            const newPg = await newPage();
            if (args.url) await newPg.goto(args.url, { waitUntil: 'load' });
            return { content: [{ type: 'text', text: `Opened new tab${args.url ? ' at ' + args.url : ''}.` }] };
        }
        case 'browser_list_tabs': {
            const pages = await listPages();
            const text = pages.map(p => `[${p.index}] ${p.active ? '*' : ' '} ${p.title} (${p.url})`).join('\n');
            return { content: [{ type: 'text', text }] };
        }
        case 'browser_switch_tab': {
            const success = await switchPage(args.index);
            return { content: [{ type: 'text', text: success ? `Switched to tab ${args.index}.` : `Failed to switch to tab ${args.index}.` }] };
        }
        case 'browser_wait_until_stable':
            await page.waitForLoadState('networkidle', { timeout: args.timeout || 30000 });
            return { content: [{ type: 'text', text: 'Page state is stable.' }] };
        case 'browser_back':
            await page.goBack({ waitUntil: 'load' });
            return { content: [{ type: 'text', text: 'Navigated back.' }] };
        case 'browser_forward':
            await page.goForward({ waitUntil: 'load' });
            return { content: [{ type: 'text', text: 'Navigated forward.' }] };
        case 'browser_reload':
            await page.reload({ waitUntil: 'load' });
            return { content: [{ type: 'text', text: 'Reloaded.' }] };
        case 'browser_wait':
            await page.waitForTimeout(args.ms);
            return { content: [{ type: 'text', text: `Waited ${args.ms}ms.` }] };
        case 'browser_wait_for_selector':
            await page.waitForSelector(args.selector, { timeout: args.timeout || 10000 });
            return { content: [{ type: 'text', text: `Selector ${args.selector} is visible.` }] };
        case 'browser_wait_for_url': {
            const isRegex = args.pattern.startsWith('regex:');
            const pattern = isRegex ? args.pattern.slice(6) : args.pattern;
            await page.waitForFunction(([pat, rx]) => {
                const u = location.href;
                return rx ? new RegExp(pat).test(u) : u.includes(pat);
            }, [pattern, isRegex], { timeout: args.timeout || 15000 });
            return { content: [{ type: 'text', text: `URL matches pattern.` }] };
        }

        // Interaction
        case 'browser_click':
            if (args.selector) await page.click(args.selector, { force: true });
            else await page.mouse.click(args.x, args.y);
            return { content: [{ type: 'text', text: 'Clicked.' }] };
        case 'browser_click_text': {
            const baseSelector = args.type === 'button' ? 'button, [role="button"]' : args.type === 'link' ? 'a, [role="link"]' : '*';
            const selector = `${baseSelector}:has-text("${args.text}")`;
            await page.click(selector, { force: true });
            return { content: [{ type: 'text', text: `Clicked element with text "${args.text}".` }] };
        }
        case 'browser_fill_form': {
            for (const [sel, val] of Object.entries(args.data)) {
                await page.fill(sel, val);
            }
            if (args.submit) await page.keyboard.press('Enter');
            return { content: [{ type: 'text', text: `Filled ${Object.keys(args.data).length} fields${args.submit ? ' and submitted' : ''}.` }] };
        }
        case 'browser_double_click':
            if (args.selector) await page.dblclick(args.selector);
            else await page.mouse.dblclick(args.x, args.y);
            return { content: [{ type: 'text', text: 'Double-clicked.' }] };
        case 'browser_right_click':
            if (args.selector) await page.click(args.selector, { button: 'right' });
            else await page.mouse.click(args.x, args.y, { button: 'right' });
            return { content: [{ type: 'text', text: 'Right-clicked.' }] };
        case 'browser_hover':
            if (args.selector) await page.hover(args.selector);
            else await page.mouse.move(args.x, args.y);
            return { content: [{ type: 'text', text: 'Hovered.' }] };
        case 'browser_drag':
            await page.dragAndDrop(args.source, args.target);
            return { content: [{ type: 'text', text: 'Drag-and-drop executed.' }] };
        case 'browser_scroll': {
            const amount = args.amount || 500;
            const delta = args.direction === 'up' ? -amount : amount;
            await page.mouse.wheel(0, delta);
            return { content: [{ type: 'text', text: 'Scrolled.' }] };
        }
        case 'browser_scroll_to':
            if (args.selector) await page.locator(args.selector).scrollIntoViewIfNeeded();
            else await page.evaluate(({ x, y }) => window.scrollTo(x, y), { x: args.x || 0, y: args.y || 0 });
            return { content: [{ type: 'text', text: 'Scrolled to target.' }] };
        case 'browser_smart_scroll': {
            const steps = args.steps ?? 5;
            const delay = args.delayMs ?? 800;
            for (let i = 0; i < steps; i++) {
                await page.evaluate(() => window.scrollBy(0, 600));
                await page.waitForTimeout(delay);
            }
            return { content: [{ type: 'text', text: `Smart scroll completed (${steps} steps).` }] };
        }

        // Forms
        case 'browser_type': {
            const delay = args.delay || (AGENT_CONFIG.profile === 'stealth' ? 120 : 10);
            await page.type(args.selector, args.text, { delay });
            return { content: [{ type: 'text', text: `Typed "${args.text}" with ${delay}ms delay.` }] };
        }
        case 'browser_clear':
            await page.fill(args.selector, '');
            return { content: [{ type: 'text', text: 'Cleared.' }] };
        case 'browser_press':
            await page.keyboard.press(args.key);
            return { content: [{ type: 'text', text: `Pressed ${args.key}.` }] };
        case 'browser_select':
            await page.selectOption(args.selector, args.value);
            return { content: [{ type: 'text', text: `Selected ${args.value}.` }] };
        case 'browser_check':
            await page.check(args.selector);
            return { content: [{ type: 'text', text: 'Checked.' }] };
        case 'browser_uncheck':
            await page.uncheck(args.selector);
            return { content: [{ type: 'text', text: 'Unchecked.' }] };

        // Observation
        case 'browser_get_state': {
            const state = await captureState(page);
            const ss = await page.screenshot({ type: 'png' });
            return {
                content: [
                    { type: 'text', text: JSON.stringify(state, null, 2) },
                    { type: 'image', data: ss.toString('base64'), mimeType: 'image/png' },
                ],
            };
        }
        case 'browser_get_text': {
            if (args.all) {
                const texts = await page.evaluate((sel) => Array.from(document.querySelectorAll(sel)).map(el => el.innerText.trim()).filter(Boolean), args.selector);
                return { content: [{ type: 'text', text: texts.join('\n---\n') }] };
            }
            const text = await page.evaluate((sel) => document.querySelector(sel)?.innerText?.trim() ?? null, args.selector);
            return { content: [{ type: 'text', text: text || '(not found)' }] };
        }
        case 'browser_get_html': {
            const html = args.selector 
                ? await page.evaluate((sel) => document.querySelector(sel)?.innerHTML ?? null, args.selector)
                : await page.content();
            return { content: [{ type: 'text', text: html || '(not found)' }] };
        }
        case 'browser_screenshot': {
            const ss = await page.screenshot({ type: 'png' });
            return { content: [{ type: 'image', data: ss.toString('base64'), mimeType: 'image/png' }] };
        }
        case 'browser_print_to_pdf': {
            const pdf = await page.pdf({
                landscape: args.landscape,
                printBackground: args.printBackground,
                format: args.format,
            });
            return { content: [{ type: 'text', text: `PDF generated (${pdf.length} bytes). Use a resource tool if available to read binary data, or I can provide base64 if requested.` }, { type: 'text', text: `Base64: ${pdf.toString('base64').substring(0, 1000)}... (truncated)` }] };
        }
        case 'browser_get_cookies': {
            const cookies = await page.context().cookies();
            return { content: [{ type: 'text', text: JSON.stringify({ cookies }, null, 2) }] };
        }
        case 'browser_evaluate': {
            const result = await page.evaluate(args.script);
            return { content: [{ type: 'text', text: JSON.stringify(result) }] };
        }
        case 'browser_extract_table': {
            const data = await page.evaluate(({ sel, hasHeader }) => {
                const table = document.querySelector(sel);
                if (!table) return null;
                const rows = Array.from(table.querySelectorAll('tr'));
                return rows.map(row => Array.from(row.querySelectorAll('td, th')).map(cell => cell.innerText.trim()));
            }, { sel: args.selector, hasHeader: args.header });
            
            if (!data) return { content: [{ type: 'text', text: 'Table not found.' }] };
            
            if (args.header && data.length > 0) {
                const headers = data[0];
                const body = data.slice(1);
                const structured = body.map(row => {
                    const obj = {};
                    headers.forEach((h, i) => { obj[h || `col${i}`] = row[i]; });
                    return obj;
                });
                return { content: [{ type: 'text', text: JSON.stringify({ table: structured }, null, 2) }] };
            }
            return { content: [{ type: 'text', text: JSON.stringify({ table: data }, null, 2) }] };
        }
        case 'browser_save_session': {
            const cookies = await page.context().cookies();
            const sessionDir = path.join(__dirname, '../../sessions');
            if (!fs.existsSync(sessionDir)) fs.mkdirSync(sessionDir, { recursive: true });
            fs.writeFileSync(path.join(sessionDir, `${args.name}.json`), JSON.stringify(cookies, null, 2));
            return { content: [{ type: 'text', text: `Session "${args.name}" saved.` }] };
        }
        case 'browser_load_session': {
            const sessionPath = path.join(__dirname, '../../sessions', `${args.name}.json`);
            if (!fs.existsSync(sessionPath)) return { content: [{ type: 'text', text: `Session "${args.name}" not found.` }] };
            const cookies = JSON.parse(fs.readFileSync(sessionPath, 'utf8'));
            await page.context().addCookies(cookies);
            return { content: [{ type: 'text', text: `Session "${args.name}" loaded.` }] };
        }
        case 'browser_close': {
            await closeBrowser();
            return { content: [{ type: 'text', text: 'Browser session closed.' }] };
        }
        case 'browser_set_agent_profile': {
            AGENT_CONFIG.profile = args.profile;
            return { content: [{ type: 'text', text: `Agent profile set to ${args.profile}.` }] };
        }
        case 'browser_handle_captcha': {
            const { CAPTCHA_SELECTORS } = require('../utils/selectors');
            const detected = await page.evaluate((sel) => !!document.querySelector(sel), CAPTCHA_SELECTORS);
            
            if (!detected) return { content: [{ type: 'text', text: 'No CAPTCHA detected.' }] };

            // Try to find and click reCAPTCHA checkbox
            const solved = await page.evaluate(async () => {
                const checkbox = document.querySelector('iframe[src*="recaptcha"]')?.contentWindow?.document?.querySelector('.recaptcha-checkbox-border');
                if (checkbox) {
                    checkbox.click();
                    return true;
                }
                return false;
            }).catch(() => false);

            if (solved) {
                return { content: [{ type: 'text', text: 'CAPTCHA checkbox clicked. Checking if solved...' }] };
            }

            if (args.wait) {
                try {
                    console.error('[Browser] CAPTCHA detected. Waiting for manual solving...');
                    await page.waitForFunction((sel) => !document.querySelector(sel), CAPTCHA_SELECTORS, { timeout: args.timeout || 60000 });
                    return { content: [{ type: 'text', text: 'CAPTCHA resolved (manual intervention detected).' }] };
                } catch (e) {
                    return { content: [{ type: 'text', text: 'Timeout waiting for CAPTCHA to be solved manually.' }], isError: true };
                }
            }

            return { content: [{ type: 'text', text: 'CAPTCHA detected. Manual intervention required.' }], isError: true };
        }

        // Helpers
        case 'browser_dismiss_popups': {
            const dismissed = await page.evaluate(() => {
                const actions = [];
                const swal = document.querySelector('.swal2-popup');
                if (swal && swal.getBoundingClientRect().width > 0) {
                    const btn = swal.querySelector('.swal2-confirm, .swal2-close, .swal2-cancel');
                    if (btn) { btn.click(); actions.push('swal2'); }
                }
                document.querySelectorAll('.modal.show, [role="dialog"], [aria-modal="true"]').forEach(m => {
                    if (m.getBoundingClientRect().width === 0) return;
                    const close = m.querySelector('[data-dismiss="modal"], [data-bs-dismiss="modal"], button.close, .btn-close, [aria-label="Close"]');
                    if (close) { close.click(); actions.push('modal'); }
                });
                return actions;
            });
            return { content: [{ type: 'text', text: dismissed.length ? `Dismissed: ${dismissed.join(', ')}` : 'No popups found.' }] };
        }

        default:
            throw new Error(`Unknown tool: ${name}`);
    }
}

module.exports = {
    TOOLS,
    handleToolCall
};
