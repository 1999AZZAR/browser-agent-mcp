const {
    getPage, closeBrowser, listPages, switchPage, newPage,
    addRoute, clearRoutes, listRoutes,
    createNamedPage, switchToNamedPage, removeNamedPage, listNamedPages,
    saveState,
} = require('../core/browser');
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
        description: 'Navigate to a URL. Retries automatically on network failure.',
        inputSchema: {
            type: 'object',
            properties: {
                url: { type: 'string' },
                retries: { type: 'number', default: 2, description: 'Number of retry attempts on failure.' },
                retryDelay: { type: 'number', default: 1000, description: 'Base delay in ms between retries (multiplied by attempt number).' },
            },
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
        name: 'browser_wait_for_load',
        description: 'Wait for the page load event. Use instead of browser_wait_until_stable for pages with persistent WebSocket connections or polling that never reach networkidle.',
        inputSchema: {
            type: 'object',
            properties: {
                state: {
                    type: 'string',
                    enum: ['load', 'domcontentloaded'],
                    default: 'load',
                    description: '"load" waits for full page load including subresources. "domcontentloaded" fires earlier, once HTML is parsed.',
                },
                timeout: { type: 'number', default: 30000 },
            },
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
                delay: { type: 'number', description: 'Delay between mousedown and mouseup (ms)' }
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
        description: 'Print the current page to a PDF file. Returns the saved file path.',
        inputSchema: {
            type: 'object',
            properties: {
                outputPath: { type: 'string', description: 'Absolute path to save the PDF. Defaults to a timestamped file in the pdfs/ directory.' },
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
        description: 'Execute arbitrary JavaScript in the page context and return the result. Supports async/await, multi-statement scripts, and passing serializable data via args.',
        inputSchema: {
            type: 'object',
            properties: {
                script: {
                    type: 'string',
                    description: 'JS expression or statement block. Use `return` to return a value. May use `await`. Receives `args` as the first parameter.',
                },
                args: {
                    description: 'Serializable value passed into the script as `args`.',
                },
            },
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
        description: 'Save the current session with a name. Saves cookies by default; set includeStorage=true to also capture localStorage and sessionStorage (needed for sites that store auth tokens in Web Storage instead of cookies).',
        inputSchema: {
            type: 'object',
            properties: {
                name: { type: 'string' },
                includeStorage: {
                    type: 'boolean',
                    default: false,
                    description: 'Also capture localStorage and sessionStorage.',
                },
            },
            required: ['name'],
        },
    },
    {
        name: 'browser_load_session',
        description: 'Load a previously saved session. Restores cookies and, if the session was saved with includeStorage=true, also restores localStorage and sessionStorage.',
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
    {
        name: 'browser_solve_captcha_grid',
        description: 'Solve a visual CAPTCHA by clicking specific grid indices.',
        inputSchema: {
            type: 'object',
            properties: {
                indices: { type: 'array', items: { type: 'number' }, description: '1-based indices of the grid to click.' },
                gridSize: { type: 'number', enum: [3, 4], default: 3, description: 'Size of the grid (3x3 or 4x4).' },
                action: { type: 'string', enum: ['verify', 'next', 'skip'], default: 'verify', description: 'Action button to click after selecting images.' }
            },
            required: ['indices'],
        },
    },

    // ── Named Pages / Agent Parallelism ──────────────────────────────────────
    {
        name: 'browser_agent_create',
        description: 'Create or switch to a named page/agent. Each named page is independent — use this to run parallel automation flows.',
        inputSchema: {
            type: 'object',
            properties: { name: { type: 'string', description: 'Unique name for the agent page.' } },
            required: ['name'],
        },
    },
    {
        name: 'browser_agent_switch',
        description: 'Switch the active page to an existing named agent.',
        inputSchema: {
            type: 'object',
            properties: { name: { type: 'string', description: 'Name of the agent to switch to.' } },
            required: ['name'],
        },
    },
    {
        name: 'browser_agent_remove',
        description: 'Remove and close a named agent page.',
        inputSchema: {
            type: 'object',
            properties: { name: { type: 'string', description: 'Name of the agent to remove.' } },
            required: ['name'],
        },
    },
    {
        name: 'browser_agent_list',
        description: 'List all named agent pages and their URLs.',
        inputSchema: { type: 'object', properties: {} },
    },

    // ── Request Interception ──────────────────────────────────────────────────
    {
        name: 'browser_intercept',
        description: 'Intercept network requests matching a URL pattern. Use to block ads/trackers, mock API responses, or inject headers. Rules persist for the session until browser_clear_intercepts is called.',
        inputSchema: {
            type: 'object',
            properties: {
                pattern: { type: 'string', description: 'URL glob pattern (e.g. "**/api/users*") or exact URL.' },
                action: {
                    type: 'string',
                    enum: ['block', 'mock', 'modify'],
                    description: '"block" aborts the request. "mock" returns a synthetic response. "modify" passes through with extra headers.',
                },
                status: { type: 'number', default: 200, description: 'HTTP status code for mock responses.' },
                body: { description: 'Response body for mock (string or object — objects are JSON-serialized).' },
                contentType: { type: 'string', default: 'application/json', description: 'Content-Type header for mock responses.' },
                headers: { type: 'object', description: 'Headers to inject (mock: sets response headers; modify: merges into request headers).' },
            },
            required: ['pattern', 'action'],
        },
    },
    {
        name: 'browser_intercept_list',
        description: 'List all active request intercept rules.',
        inputSchema: { type: 'object', properties: {} },
    },
    {
        name: 'browser_clear_intercepts',
        description: 'Remove all active request intercept rules.',
        inputSchema: { type: 'object', properties: {} },
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
        case 'browser_navigate': {
            const retries = args.retries ?? 2;
            const retryDelay = args.retryDelay ?? 1000;
            let lastError;
            for (let attempt = 0; attempt <= retries; attempt++) {
                try {
                    await page.goto(args.url, { waitUntil: 'load', timeout: 30000 });
                    await saveState();
                    const suffix = attempt > 0 ? ` (succeeded on attempt ${attempt + 1})` : '';
                    return { content: [{ type: 'text', text: `Navigated to ${args.url}${suffix}` }] };
                } catch (e) {
                    lastError = e;
                    if (attempt < retries) await page.waitForTimeout(retryDelay * (attempt + 1));
                }
            }
            return { content: [{ type: 'text', text: `Failed to navigate to ${args.url} after ${retries + 1} attempt(s): ${lastError.message}` }], isError: true };
        }
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
        case 'browser_wait_for_load':
            await page.waitForLoadState(args.state || 'load', { timeout: args.timeout || 30000 });
            return { content: [{ type: 'text', text: `Page reached "${args.state || 'load'}" state.` }] };
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
        case 'browser_click': {
            const delay = args.delay || (AGENT_CONFIG.profile === 'stealth' ? Math.floor(Math.random() * 100) + 50 : 0);
            
            if (AGENT_CONFIG.profile === 'stealth') {
                // Random small move before click to simulate human jitter
                const jitterX = (Math.random() - 0.5) * 4;
                const jitterY = (Math.random() - 0.5) * 4;
                
                if (args.selector) {
                    const box = await page.locator(args.selector).boundingBox();
                    if (box) await page.mouse.move(box.x + box.width / 2 + jitterX, box.y + box.height / 2 + jitterY, { steps: 5 });
                } else if (args.x !== undefined && args.y !== undefined) {
                    await page.mouse.move(args.x + jitterX, args.y + jitterY, { steps: 5 });
                }
                await page.waitForTimeout(Math.random() * 200 + 100);
            }

            if (args.selector) await page.click(args.selector, { force: true, delay });
            else await page.mouse.click(args.x, args.y, { delay });
            return { content: [{ type: 'text', text: `Clicked with ${delay}ms delay.` }] };
        }
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
                landscape: args.landscape ?? false,
                printBackground: args.printBackground ?? true,
                format: args.format ?? 'A4',
            });
            const outputPath = args.outputPath || path.join(__dirname, '../../pdfs', `${Date.now()}.pdf`);
            const dir = path.dirname(outputPath);
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
            fs.writeFileSync(outputPath, pdf);
            return { content: [{ type: 'text', text: `PDF saved to ${outputPath} (${(pdf.length / 1024).toFixed(1)} KB)` }] };
        }
        case 'browser_get_cookies': {
            const cookies = await page.context().cookies();
            return { content: [{ type: 'text', text: JSON.stringify({ cookies }, null, 2) }] };
        }
        case 'browser_evaluate': {
            const result = await page.evaluate(async ([script, scriptArgs]) => {
                try {
                    // eslint-disable-next-line no-new-func
                    const fn = new Function('args', `"use strict"; return (async () => { ${script} })()`);
                    const value = await fn(scriptArgs);
                    return { ok: true, value };
                } catch (e) {
                    return { ok: false, error: e.message };
                }
            }, [args.script, args.args ?? null]);

            if (!result.ok) {
                return { content: [{ type: 'text', text: `Script error: ${result.error}` }], isError: true };
            }

            let output;
            try {
                output = result.value === undefined ? '(undefined)' : JSON.stringify(result.value, null, 2);
            } catch (_) {
                output = String(result.value);
            }
            return { content: [{ type: 'text', text: output }] };
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
            const sessionDir = path.join(__dirname, '../../sessions');
            if (!fs.existsSync(sessionDir)) fs.mkdirSync(sessionDir, { recursive: true });

            const cookies = await page.context().cookies();
            const sessionData = { cookies };

            if (args.includeStorage) {
                sessionData.storage = await page.evaluate(() => ({
                    localStorage: { ...localStorage },
                    sessionStorage: { ...sessionStorage },
                    origin: location.origin,
                }));
            }

            fs.writeFileSync(path.join(sessionDir, `${args.name}.json`), JSON.stringify(sessionData, null, 2));
            const extras = args.includeStorage ? ' + localStorage/sessionStorage' : '';
            return { content: [{ type: 'text', text: `Session "${args.name}" saved (cookies${extras}).` }] };
        }
        case 'browser_load_session': {
            const sessionPath = path.join(__dirname, '../../sessions', `${args.name}.json`);
            if (!fs.existsSync(sessionPath)) {
                return { content: [{ type: 'text', text: `Session "${args.name}" not found.` }], isError: true };
            }

            const sessionData = JSON.parse(fs.readFileSync(sessionPath, 'utf8'));

            // Support both old format (array of cookies) and new format ({ cookies, storage })
            const cookies = Array.isArray(sessionData) ? sessionData : sessionData.cookies;
            await page.context().addCookies(cookies);

            if (!Array.isArray(sessionData) && sessionData.storage) {
                const { localStorage: ls, sessionStorage: ss, origin } = sessionData.storage;
                if (page.url().startsWith(origin)) {
                    await page.evaluate(([lsData, ssData]) => {
                        Object.entries(lsData).forEach(([k, v]) => localStorage.setItem(k, v));
                        Object.entries(ssData).forEach(([k, v]) => sessionStorage.setItem(k, v));
                    }, [ls, ss]);
                    return { content: [{ type: 'text', text: `Session "${args.name}" loaded (cookies + localStorage/sessionStorage).` }] };
                }
                return { content: [{ type: 'text', text: `Session "${args.name}" loaded (cookies only — storage skipped: page origin mismatch with saved origin "${origin}").` }] };
            }

            return { content: [{ type: 'text', text: `Session "${args.name}" loaded.` }] };
        }
        case 'browser_solve_captcha_grid': {
            const challengeFrame = await page.waitForSelector('iframe[src*="bframe"]', { timeout: 5000 }).catch(() => null);
            if (!challengeFrame) return { content: [{ type: 'text', text: 'Challenge frame not found.' }], isError: true };
            
            const rect = await challengeFrame.boundingBox();
            if (!rect) return { content: [{ type: 'text', text: 'Could not determine challenge frame position.' }], isError: true };

            const { gridSize, indices, action } = args;
            const margin = 15; // padding inside frame
            const gridWidth = 400 - (margin * 2);
            const gridHeight = 400 - (margin * 2); // Images usually in top 400px
            const cellSize = gridWidth / gridSize;

            const results = [];
            for (const index of indices) {
                const row = Math.floor((index - 1) / gridSize);
                const col = (index - 1) % gridSize;
                
                const centerX = rect.x + margin + (col * cellSize) + (cellSize / 2);
                const centerY = rect.y + margin + (row * cellSize) + (cellSize / 2);
                
                // Add human jitter
                const clickX = centerX + (Math.random() - 0.5) * 10;
                const clickY = centerY + (Math.random() - 0.5) * 10;

                await page.mouse.move(clickX, clickY, { steps: 10 });
                await page.waitForTimeout(Math.random() * 300 + 200);
                await page.mouse.click(clickX, clickY, { delay: Math.random() * 200 + 100 });
                results.push(index);
                await page.waitForTimeout(Math.random() * 500 + 300);
            }

            // Click action button
            const actionX = rect.x + (action === 'verify' ? 330 : 330); // Approximate verify button location
            const actionY = rect.y + 540;
            await page.mouse.move(actionX, actionY, { steps: 10 });
            await page.waitForTimeout(Math.random() * 400 + 200);
            await page.mouse.click(actionX, actionY, { delay: Math.random() * 200 + 150 });

            return { content: [{ type: 'text', text: `Clicked indices ${results.join(', ')} and clicked "${action}".` }] };
        }
        // Named Pages / Agent Parallelism
        case 'browser_agent_create': {
            const created = await createNamedPage(args.name);
            return { content: [{ type: 'text', text: created ? `Created and switched to agent "${args.name}".` : `Switched to existing agent "${args.name}".` }] };
        }
        case 'browser_agent_switch': {
            const ok = await switchToNamedPage(args.name);
            return { content: [{ type: 'text', text: ok ? `Switched to agent "${args.name}".` : `Agent "${args.name}" not found.` }] };
        }
        case 'browser_agent_remove': {
            const removed = await removeNamedPage(args.name);
            return { content: [{ type: 'text', text: removed ? `Removed agent "${args.name}".` : `Agent "${args.name}" not found.` }] };
        }
        case 'browser_agent_list': {
            const agents = listNamedPages();
            if (!agents.length) return { content: [{ type: 'text', text: 'No named agents. Use browser_agent_create to add one.' }] };
            const text = agents.map(a => `${a.hasActivePage ? '*' : ' '} ${a.name} — ${a.url || '(blank)'}`).join('\n');
            return { content: [{ type: 'text', text }] };
        }

        // Request Interception
        case 'browser_intercept': {
            await addRoute(args.pattern, args.action, {
                status: args.status,
                body: args.body,
                contentType: args.contentType,
                headers: args.headers,
            });
            return { content: [{ type: 'text', text: `Intercept rule added: ${args.action} "${args.pattern}"` }] };
        }
        case 'browser_intercept_list': {
            const routes = listRoutes();
            if (!routes.length) return { content: [{ type: 'text', text: 'No active intercept rules.' }] };
            const text = routes.map(r => `[${r.action}] ${r.pattern}`).join('\n');
            return { content: [{ type: 'text', text }] };
        }
        case 'browser_clear_intercepts': {
            await clearRoutes();
            return { content: [{ type: 'text', text: 'All intercept rules cleared.' }] };
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
                console.error('[Browser] CAPTCHA checkbox clicked. Checking for immediate resolution...');
                try {
                    await page.waitForFunction((sel) => !document.querySelector(sel), CAPTCHA_SELECTORS, { timeout: 5000 });
                    return { content: [{ type: 'text', text: 'CAPTCHA solved automatically.' }] };
                } catch (e) {
                    console.error('[Browser] CAPTCHA still present after click. Full challenge likely required.');
                }
            }

            if (args.wait) {
                try {
                    console.error('[Browser] CAPTCHA detected or challenge appeared. Waiting for manual solving...');
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
