const {
    getPage, closeBrowser, listPages, switchPage, newPage,
    addRoute, clearRoutes, listRoutes,
    createNamedPage, switchToNamedPage, removeNamedPage, listNamedPages,
    saveState,
    rotateSnapshot, saveSnapshot, getCurrSnapshot, getLastSnapshot,
    getConsoleMessages, getNetworkRequests, clearConsoleMessages, clearNetworkRequests,
    healthCheck,
} = require('../core/browser');
const { RecaptchaSolver } = require('../core/recaptcha');
const { captureState, observeInteractable, getElementByRef } = require('../core/state');
const cache = require('../core/cache');
const recorder = require('../core/recorder');
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
        description: 'Fill multiple form fields at once. Set typeAware=true to auto-detect input types (date, number, email, tel, url, select, checkbox, radio, file, contenteditable) and format values with the right Playwright method — much more reliable for structured forms than raw fill.',
        inputSchema: {
            type: 'object',
            properties: {
                data: { type: 'object', description: 'Key-value pairs of selector: value' },
                submit: { type: 'boolean', default: false, description: 'Whether to press Enter after filling' },
                typeAware: { type: 'boolean', default: false, description: 'Detect input type and format values automatically.' },
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
        description: 'Capture the current page state: URL, title, headings, text blocks, interactive elements (with ref numbers), AX tree, popups, and CAPTCHA status. Auto-saves snapshot for browser_state_diff. Pass screenshot=true to also include a visual screenshot — only do this when elements may be hidden from the AX tree (canvas, shadow DOM, iframes, visual-only widgets) or when layout context is needed.',
        annotations: { readOnlyHint: true },
        inputSchema: {
            type: 'object',
            properties: {
                screenshot: {
                    type: 'boolean',
                    default: false,
                    description: 'Include a screenshot. Default false — only pass true when visual context is needed (canvas, iframes, hidden-from-AX elements).',
                },
            },
        },
    },
    {
        name: 'browser_get_text',
        description: 'Read text from element(s). When all=true, returns up to maxLines results (default 100).',
        annotations: { readOnlyHint: true },
        inputSchema: {
            type: 'object',
            properties: {
                selector: { type: 'string' },
                all: { type: 'boolean', default: false },
                maxLines: { type: 'number', description: 'Max number of elements to return when all=true. Default 100.' },
            },
            required: ['selector'],
        },
    },
    {
        name: 'browser_get_html',
        description: 'Get the full HTML content of the page or a specific element.',
        annotations: { readOnlyHint: true },
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
        annotations: { readOnlyHint: true },
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
        annotations: { readOnlyHint: true },
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
        name: 'browser_state_diff',
        description: 'Compare the last two AX tree snapshots (saved automatically by browser_get_state). Returns structured diff: URL/title changes, new/removed headings, element changes, popup and captcha status transitions.',
        annotations: { readOnlyHint: true },
        inputSchema: { type: 'object', properties: {} },
    },
    {
        name: 'browser_extract_table',
        description: 'Extract data from an HTML table into JSON.',
        annotations: { readOnlyHint: true },
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
        description: 'Auto-solve reCAPTCHA v2 via audio transcription (uses ffmpeg + OpenAI Whisper or Google Speech API). Falls back to manual wait on failure. Set OPENAI_API_KEY for best transcription accuracy.',
        inputSchema: {
            type: 'object',
            properties: {
                wait: { type: 'boolean', default: true, description: 'Whether to wait for manual solving if automated attempt fails.' },
                timeout: { type: 'number', default: 120000, description: 'Max time to wait for CAPTCHA resolution (ms).' }
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

    // ── Health & Diagnostics ───────────────────────────────────────────────────
    {
        name: 'browser_health',
        description: 'Check browser health: context alive, page responsive, page count, active URL, and evaluate latency. Read-only. Use to diagnose crashes, zombie contexts, or unresponsive pages.',
        annotations: { readOnlyHint: true },
        inputSchema: { type: 'object', properties: {} },
    },

    // ── State Export & Session Discovery ──────────────────────────────────────
    {
        name: 'browser_export_state',
        description: 'Export the current page state (URL, title, headings, text, interactive elements, cookies, localStorage, sessionStorage, optional AX tree) as a JSON file. Use to create a reproducible snapshot for sharing with other agents, debugging, or replay. Defaults to exports/state-<timestamp>.json.',
        inputSchema: {
            type: 'object',
            properties: {
                outputPath: { type: 'string', description: 'Absolute path for the JSON file. Defaults to exports/state-<timestamp>.json.' },
                includeAxTree: { type: 'boolean', default: false, description: 'Include the full accessibility tree (significantly larger output).' },
                includeStorage: { type: 'boolean', default: true, description: 'Include localStorage and sessionStorage.' },
            },
        },
    },
    {
        name: 'browser_list_sessions',
        description: 'List all saved session files in the sessions/ directory with name, size, cookie count, origin, and modified time. Read-only.',
        annotations: { readOnlyHint: true },
        inputSchema: { type: 'object', properties: {} },
    },

    // ── Helpers ───────────────────────────────────────────────────────────────
    {
        name: 'browser_dismiss_popups',
        description: 'Try to dismiss common popups and banners.',
        inputSchema: { type: 'object', properties: {} },
    },

    // ── Observe / Ref-click ───────────────────────────────────────────────────
    {
        name: 'browser_observe',
        description: 'Return only interactable elements (buttons, inputs, links, selects) without a screenshot. Each element gets a stable `ref` number. Use before planning an action to enumerate available targets with minimal token cost — then act with browser_click_ref or browser_type.',
        annotations: { readOnlyHint: true },
        inputSchema: { type: 'object', properties: {} },
    },
    {
        name: 'browser_click_ref',
        description: 'Click an element by its `ref` number from the last browser_observe or browser_get_state call. More reliable than selectors for dynamic pages — no re-snapshotting needed.',
        inputSchema: {
            type: 'object',
            properties: {
                ref: { type: 'number', description: '1-based ref index from the last observe/state call.' },
            },
            required: ['ref'],
        },
    },

    // ── CDP Diagnostics ───────────────────────────────────────────────────────
    {
        name: 'browser_console_messages',
        description: 'Return captured browser console messages and page errors (last 100). Useful for debugging — check for JS errors after interactions. Read-only.',
        annotations: { readOnlyHint: true },
        inputSchema: {
            type: 'object',
            properties: {
                type: {
                    type: 'string',
                    enum: ['all', 'error', 'warning', 'log'],
                    default: 'all',
                    description: 'Filter by message type.',
                },
                clear: { type: 'boolean', default: false, description: 'Clear the log after reading.' },
                maxLines: { type: 'number', description: 'Maximum messages to return. Defaults to 100 (buffer size).' },
            },
        },
    },
    {
        name: 'browser_network_requests',
        description: 'Return captured network requests and their response status/timing (last 100). Useful for verifying API calls, detecting failed fetches, or inspecting what URLs are being hit. Read-only.',
        annotations: { readOnlyHint: true },
        inputSchema: {
            type: 'object',
            properties: {
                filter: { type: 'string', description: 'Optional URL substring to filter results.' },
                statusMin: { type: 'number', description: 'Only return requests with status >= this value (e.g. 400 for errors).' },
                clear: { type: 'boolean', default: false, description: 'Clear the log after reading.' },
                maxLines: { type: 'number', description: 'Maximum requests to return. Defaults to 100.' },
            },
        },
    },

    // ── Schema Extraction ─────────────────────────────────────────────────────
    {
        name: 'browser_extract_schema',
        description: 'Extract structured data from the page matching a JSON schema. Provide a schema object with property names and descriptions — the tool scrapes the page and returns a typed JSON object. More reliable than text extraction for structured data (prices, tables, forms, product info).',
        inputSchema: {
            type: 'object',
            properties: {
                schema: {
                    type: 'object',
                    description: 'JSON Schema object describing the shape to extract. Each property should have a "description" hint for where to find it on the page.',
                },
                selector: {
                    type: 'string',
                    description: 'Optional CSS selector to scope the extraction to a specific element.',
                },
            },
            required: ['schema'],
        },
    },

    // ── Test Generation ───────────────────────────────────────────────────────
    {
        name: 'browser_generate_playwright_test',
        description: 'Generate a replayable Playwright test script from the recorded actions in this session. Returns a .spec.js file content. Call browser_clear_recording first to start a fresh recording.',
        inputSchema: {
            type: 'object',
            properties: {
                testName: { type: 'string', description: 'Name for the test case.', default: 'recorded_session' },
                outputPath: { type: 'string', description: 'Optional absolute path to save the .spec.js file.' },
            },
        },
    },
    {
        name: 'browser_clear_recording',
        description: 'Clear the current session action recording. Call before a workflow you want to capture as a test.',
        inputSchema: { type: 'object', properties: {} },
    },

    // ── Performance ───────────────────────────────────────────────────────────
    {
        name: 'browser_performance',
        description: 'Return Core Web Vitals and browser performance metrics for the current page using CDP. Includes LCP, CLS, FID estimates, navigation timing, and resource counts. Read-only.',
        annotations: { readOnlyHint: true },
        inputSchema: { type: 'object', properties: {} },
    },

    // ── Planner-Validator ─────────────────────────────────────────────────────
    {
        name: 'browser_assert',
        description: 'Validate a condition on the current page. On failure, returns what is actually present to help re-plan. Use after actions to verify outcomes before continuing.',
        inputSchema: {
            type: 'object',
            properties: {
                condition: {
                    type: 'string',
                    description: 'What to check — either a CSS selector that must exist, a URL pattern to match, or a JS expression returning a boolean.',
                },
                conditionType: {
                    type: 'string',
                    enum: ['selector', 'url', 'js'],
                    default: 'selector',
                },
                expected: {
                    type: 'string',
                    description: 'For selector: optional text the element must contain. For url: pattern to match. For js: ignored (expression must return truthy).',
                },
            },
            required: ['condition'],
        },
    },

    // ── Cache Management ──────────────────────────────────────────────────────
    {
        name: 'browser_cache_stats',
        description: 'Return statistics about the action selector cache (hit count, entries, stale entries). Read-only.',
        annotations: { readOnlyHint: true },
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
                    recorder.record('navigate', { url: args.url });
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
            const hostname = new URL(page.url()).hostname;
            const cacheKey = `click_text::${args.type || 'any'}::${args.text}`;
            const cached = cache.get(hostname, cacheKey);

            if (cached) {
                const ok = await page.click(cached, { force: true }).then(() => true).catch(() => false);
                if (ok) {
                    recorder.record('click_text', { text: args.text, elType: args.type, selector: cached });
                    return { content: [{ type: 'text', text: `Clicked "${args.text}" (cache hit: ${cached}).` }] };
                }
                cache.invalidate(hostname, cacheKey);
            }

            // Cache miss or stale: discover selector
            const baseSelector = args.type === 'button' ? 'button, [role="button"]' : args.type === 'link' ? 'a, [role="link"]' : '*';
            const selector = `${baseSelector}:has-text("${args.text}")`;
            await page.click(selector, { force: true });
            cache.set(hostname, cacheKey, selector);
            recorder.record('click_text', { text: args.text, elType: args.type, selector });
            return { content: [{ type: 'text', text: `Clicked element with text "${args.text}".` }] };
        }
        case 'browser_fill_form': {
            const actions = [];
            for (const [sel, rawVal] of Object.entries(args.data)) {
                const value = String(rawVal);
                if (!args.typeAware) {
                    await page.fill(sel, value);
                    actions.push('fill');
                    continue;
                }

                const meta = await page.evaluate((s) => {
                    const el = document.querySelector(s);
                    if (!el) return null;
                    return {
                        tag: el.tagName,
                        type: (el.getAttribute('type') || '').toLowerCase(),
                        isContentEditable: el.getAttribute('contenteditable') === 'true' || el.isContentEditable,
                    };
                }, sel);

                if (!meta) {
                    await page.fill(sel, value);
                    actions.push('fill (no element)');
                    continue;
                }

                if (meta.isContentEditable) {
                    await page.locator(sel).click();
                    await page.keyboard.type(value, { delay: 30 });
                    actions.push('type (contenteditable)');
                } else if (meta.tag === 'SELECT') {
                    const opts = await page.evaluate((s) => {
                        const el = document.querySelector(s);
                        return Array.from(el?.options || []).map(o => ({ value: o.value, label: o.text }));
                    }, sel);
                    const match = opts.find(o => o.value === value || o.label === value);
                    await page.selectOption(sel, match?.value ?? value);
                    actions.push(`select (${match ? 'matched' : 'fallback'})`);
                } else if (meta.type === 'checkbox' || meta.type === 'radio') {
                    const truthy = value === true || value === 'true' || value === '1' || value === 'on' || value === 'yes';
                    if (truthy) await page.check(sel); else await page.uncheck(sel);
                    actions.push(truthy ? 'check' : 'uncheck');
                } else if (meta.type === 'file') {
                    const files = value.split(',').map(s => s.trim()).filter(Boolean);
                    await page.setInputFiles(sel, files);
                    actions.push(`setInputFiles (${files.length})`);
                } else if (meta.type === 'number' || meta.type === 'range') {
                    const num = parseFloat(String(value).replace(/[^0-9.\-eE]/g, ''));
                    await page.fill(sel, isNaN(num) ? value : String(num));
                    actions.push('fill (number)');
                } else if (meta.type === 'date' || meta.type === 'datetime-local') {
                    const d = new Date(value);
                    const iso = isNaN(d) ? value : d.toISOString().slice(0, meta.type === 'date' ? 10 : 16);
                    await page.fill(sel, iso);
                    actions.push('fill (date)');
                } else if (meta.type === 'email') {
                    const email = String(value).trim();
                    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
                        throw new Error(`Invalid email value for ${sel}: ${email}`);
                    }
                    await page.fill(sel, email);
                    actions.push('fill (email)');
                } else if (meta.type === 'tel') {
                    await page.fill(sel, String(value).replace(/[^\d+\-\s()]/g, ''));
                    actions.push('fill (tel)');
                } else if (meta.type === 'url') {
                    const url = /^https?:\/\//i.test(value) ? value : `https://${value}`;
                    await page.fill(sel, url);
                    actions.push('fill (url)');
                } else {
                    await page.fill(sel, value);
                    actions.push('fill');
                }
            }
            if (args.submit) await page.keyboard.press('Enter');
            const tag = args.typeAware ? ' (type-aware)' : '';
            return { content: [{ type: 'text', text: `Filled ${actions.length} field(s)${tag}: ${actions.join(', ')}${args.submit ? ' + submitted' : ''}.` }] };
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

        case 'browser_type': {
            const delay = args.delay || (AGENT_CONFIG.profile === 'stealth' ? 120 : 10);
            await page.type(args.selector, args.text, { delay });
            recorder.record('type', { selector: args.selector, text: args.text });
            return { content: [{ type: 'text', text: `Typed "${args.text}" with ${delay}ms delay.` }] };
        }
        case 'browser_clear':
            await page.fill(args.selector, '');
            return { content: [{ type: 'text', text: 'Cleared.' }] };
        case 'browser_press':
            await page.keyboard.press(args.key);
            recorder.record('press', { key: args.key });
            return { content: [{ type: 'text', text: `Pressed ${args.key}.` }] };
        case 'browser_select':
            await page.selectOption(args.selector, args.value);
            recorder.record('select', { selector: args.selector, value: args.value });
            return { content: [{ type: 'text', text: `Selected ${args.value}.` }] };
        case 'browser_check':
            await page.check(args.selector);
            recorder.record('check', { selector: args.selector });
            return { content: [{ type: 'text', text: 'Checked.' }] };
        case 'browser_uncheck':
            await page.uncheck(args.selector);
            recorder.record('uncheck', { selector: args.selector });
            return { content: [{ type: 'text', text: 'Unchecked.' }] };

        // Observation
        case 'browser_get_state': {
            await rotateSnapshot();
            const state = await captureState(page);
            await saveSnapshot(state);
            const content = [{ type: 'text', text: JSON.stringify(state, null, 2) }];
            if (args.screenshot) {
                const ss = await page.screenshot({ type: 'png' });
                content.push({ type: 'image', data: ss.toString('base64'), mimeType: 'image/png' });
            }
            return { content };
        }
        case 'browser_get_text': {
            if (args.all) {
                const texts = await page.evaluate((sel) => Array.from(document.querySelectorAll(sel)).map(el => el.innerText.trim()).filter(Boolean), args.selector);
                const maxLines = args.maxLines ?? 100;
                const truncated = texts.length > maxLines;
                const limited = texts.slice(0, maxLines);
                const suffix = truncated ? `\n... (${texts.length - maxLines} more, increase maxLines to see all)` : '';
                return { content: [{ type: 'text', text: limited.join('\n---\n') + suffix }] };
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
        case 'browser_state_diff': {
            const last = getLastSnapshot();
            const curr = getCurrSnapshot();
            if (!curr) return { content: [{ type: 'text', text: 'No current snapshot. Call browser_get_state first.' }] };
            if (!last) return { content: [{ type: 'text', text: 'Only one snapshot exists. Call browser_get_state again to create a baseline for comparison.' }] };

            const changes = {};

            // URL / title
            if (last.url !== curr.url) changes.url = { from: last.url, to: curr.url };
            if (last.title !== curr.title) changes.title = { from: last.title, to: curr.title };

            // Headings
            const lastH = new Set((last.headings || []).map(h => `${h.level}:${h.text}`));
            const currH = new Set((curr.headings || []).map(h => `${h.level}:${h.text}`));
            const newH = (curr.headings || []).filter(h => !lastH.has(`${h.level}:${h.text}`));
            const goneH = (last.headings || []).filter(h => !currH.has(`${h.level}:${h.text}`));
            if (newH.length) changes.newHeadings = newH;
            if (goneH.length) changes.removedHeadings = goneH;

            // Interactive elements — summary by tag
            const lastTags = {};
            for (const el of last.elements || []) {
                const t = el.tag || '?';
                lastTags[t] = (lastTags[t] || 0) + 1;
            }
            const currTags = {};
            for (const el of curr.elements || []) {
                const t = el.tag || '?';
                currTags[t] = (currTags[t] || 0) + 1;
            }
            const tagDiffs = [];
            for (const tag of new Set([...Object.keys(lastTags), ...Object.keys(currTags)]).values()) {
                const before = lastTags[tag] || 0;
                const after = currTags[tag] || 0;
                if (before !== after) tagDiffs.push({ tag, before, after });
            }
            if (tagDiffs.length) changes.elements = tagDiffs;

            // Popups
            const hadPopups = (last.popups || []).length > 0;
            const hasPopups = (curr.popups || []).length > 0;
            if (!hadPopups && hasPopups) changes.popup = { status: 'appeared', text: curr.popups[0]?.text?.substring(0, 200) };
            if (hadPopups && !hasPopups) changes.popup = { status: 'dismissed' };

            // CAPTCHA
            if (!last.captchaDetected && curr.captchaDetected) changes.captcha = 'appeared';
            if (last.captchaDetected && !curr.captchaDetected) changes.captcha = 'resolved';

            const summary = Object.keys(changes).length
                ? JSON.stringify({ changes }, null, 2)
                : 'No meaningful changes detected between last two snapshots.';

            return { content: [{ type: 'text', text: summary }] };
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
        case 'browser_list_sessions': {
            const sessionDir = path.join(__dirname, '../../sessions');
            if (!fs.existsSync(sessionDir)) return { content: [{ type: 'text', text: 'No sessions saved yet.' }] };

            const files = fs.readdirSync(sessionDir).filter(f => f.endsWith('.json'));
            if (!files.length) return { content: [{ type: 'text', text: 'No sessions saved yet.' }] };

            const lines = files.map(f => {
                const full = path.join(sessionDir, f);
                const stat = fs.statSync(full);
                const data = JSON.parse(fs.readFileSync(full, 'utf8'));
                const cookieCount = Array.isArray(data) ? data.length : (data.cookies?.length || 0);
                const hasStorage = !Array.isArray(data) && data.storage;
                const origin = hasStorage ? data.storage.origin : '—';
                return `${f.replace('.json', '')} | ${(stat.size / 1024).toFixed(1)} KB | ${cookieCount} cookies | origin: ${origin} | ${stat.mtime.toISOString()}`;
            });
            return { content: [{ type: 'text', text: lines.join('\n') }] };
        }
        case 'browser_export_state': {
            const exportDir = path.join(__dirname, '../../exports');
            if (!fs.existsSync(exportDir)) fs.mkdirSync(exportDir, { recursive: true });

            const outputPath = args.outputPath || path.join(exportDir, `state-${Date.now()}.json`);
            const dir = path.dirname(outputPath);
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

            const baseState = await captureState(page);
            const state = { ...baseState, capturedAt: new Date().toISOString() };

            if (args.includeStorage !== false) {
                state.storage = await page.evaluate(() => {
                    try {
                        return {
                            localStorage: { ...localStorage },
                            sessionStorage: { ...sessionStorage },
                            origin: location.origin,
                        };
                    } catch (_) {
                        return { localStorage: {}, sessionStorage: {}, origin: location.origin, error: 'storage access denied' };
                    }
                });
            }

            state.cookies = await page.context().cookies();

            if (!args.includeAxTree) delete state.axTree;

            fs.writeFileSync(outputPath, JSON.stringify(state, null, 2));
            const sizeKb = (fs.statSync(outputPath).size / 1024).toFixed(1);
            return { content: [{ type: 'text', text: `State exported to ${outputPath} (${sizeKb} KB).` }] };
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

            const timeout = args.timeout || 120000;
            const start = Date.now();

            // Use auto solver first
            try {
                const solver = new RecaptchaSolver(page);
                const result = await solver.solve();
                return { content: [{ type: 'text', text: `CAPTCHA solved via ${result.method}: ${result.solved}` }] };
            } catch (e) {
                console.error(`[Browser] Auto CAPTCHA solve failed: ${e.message}`);
            }

            // Fallback: wait for manual solving
            if (args.wait !== false) {
                const remaining = timeout - (Date.now() - start);
                if (remaining > 0) {
                    try {
                        await page.waitForFunction((sel) => !document.querySelector(sel), CAPTCHA_SELECTORS, { timeout: remaining });
                        return { content: [{ type: 'text', text: 'CAPTCHA resolved (manual intervention).' }] };
                    } catch {
                        return { content: [{ type: 'text', text: 'Timeout waiting for CAPTCHA resolution.' }], isError: true };
                    }
                }
            }

            return { content: [{ type: 'text', text: 'CAPTCHA detected. Auto-solve failed and manual fallback not requested.' }], isError: true };
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

        // Schema-typed extraction
        case 'browser_observe': {
            const observed = await observeInteractable(page);
            return { content: [{ type: 'text', text: JSON.stringify(observed, null, 2) }] };
        }
        case 'browser_click_ref': {
            const el = getElementByRef(args.ref);
            if (!el) {
                return { content: [{ type: 'text', text: `Ref ${args.ref} not found. Call browser_observe or browser_get_state first.` }], isError: true };
            }
            const cx = el.x + Math.floor(el.w / 2);
            const cy = el.y + Math.floor(el.h / 2);
            const label = el.text ? ` "${el.text.substring(0, 50)}"` : '';
            if (AGENT_CONFIG.profile === 'stealth') {
                await page.mouse.move(cx + (Math.random() - 0.5) * 4, cy + (Math.random() - 0.5) * 4, { steps: 5 });
                await page.waitForTimeout(Math.random() * 150 + 80);
            }
            await page.mouse.click(cx, cy);
            recorder.record('click_ref', { ref: args.ref, label: el.text, x: cx, y: cy, selector: el.id ? `#${el.id}` : null });
            return { content: [{ type: 'text', text: `Clicked ref ${args.ref} (${el.tag}${label}) at (${cx}, ${cy}).` }] };
        }

        // CDP Diagnostics
        case 'browser_console_messages': {
            let messages = getConsoleMessages(page);
            const filterType = args.type || 'all';
            if (filterType !== 'all') messages = messages.filter(m => m.type === filterType);
            if (args.clear) clearConsoleMessages(page);
            if (!messages.length) return { content: [{ type: 'text', text: 'No console messages captured.' }] };
            const maxLines = args.maxLines ?? 100;
            const truncated = messages.length > maxLines;
            const limited = messages.slice(0, maxLines);
            const lines = limited.map(m => `[${m.type}] ${m.text}${m.url ? ` (${m.url})` : ''}`);
            const suffix = truncated ? `\n... (${messages.length - maxLines} more, increase maxLines to see all)` : '';
            return { content: [{ type: 'text', text: lines.join('\n') + suffix }] };
        }
        case 'browser_network_requests': {
            let requests = getNetworkRequests(page);
            if (args.filter) requests = requests.filter(r => r.url.includes(args.filter));
            if (args.statusMin) requests = requests.filter(r => r.status >= args.statusMin);
            if (args.clear) clearNetworkRequests(page);
            if (!requests.length) return { content: [{ type: 'text', text: 'No network requests captured.' }] };
            const maxLines = args.maxLines ?? 100;
            const truncated = requests.length > maxLines;
            const limited = requests.slice(0, maxLines);
            const lines = limited.map(r => `[${r.status}] ${r.method} ${r.url} — ${r.duration}ms ${r.contentType ? '(' + r.contentType + ')' : ''}`);
            const suffix = truncated ? `\n... (${requests.length - maxLines} more, increase maxLines to see all)` : '';
            return { content: [{ type: 'text', text: lines.join('\n') + suffix }] };
        }

        case 'browser_extract_schema': {
            const schema = args.schema;
            const scope = args.selector || 'body';
            const data = await page.evaluate(({ scopeSelector, schemaProps }) => {
                const root = document.querySelector(scopeSelector) || document.body;
                const result = {};
                for (const [key, def] of Object.entries(schemaProps)) {
                    const hint = (def.description || '').toLowerCase();
                    const type = def.type || 'string';

                    // Strategy: try aria/semantic selectors guided by description hints
                    const candidates = [];
                    if (hint.includes('price') || hint.includes('cost')) candidates.push('[class*="price"]', '[itemprop="price"]', '[data-price]');
                    if (hint.includes('title') || hint.includes('name')) candidates.push('h1', 'h2', '[itemprop="name"]', '[class*="title"]');
                    if (hint.includes('description')) candidates.push('[itemprop="description"]', '[class*="description"]', '[class*="summary"]', 'p');
                    if (hint.includes('image') || hint.includes('img')) candidates.push('img[src]', '[itemprop="image"]');
                    if (hint.includes('url') || hint.includes('link')) candidates.push('a[href]', 'link[rel="canonical"]');
                    if (hint.includes('rating') || hint.includes('score')) candidates.push('[itemprop="ratingValue"]', '[class*="rating"]', '[class*="score"]');
                    if (hint.includes('author')) candidates.push('[itemprop="author"]', '[class*="author"]', '[rel="author"]');
                    if (hint.includes('date')) candidates.push('time[datetime]', '[itemprop="datePublished"]', '[class*="date"]');
                    // Fallback: try to find element by key name as class/id/itemprop
                    candidates.push(`[itemprop="${key}"]`, `[class*="${key}"]`, `[id*="${key}"]`, `[data-${key}]`);

                    let found = null;
                    for (const sel of candidates) {
                        const el = root.querySelector(sel);
                        if (el) { found = el; break; }
                    }

                    if (!found) { result[key] = null; continue; }

                    if (type === 'string' || type === 'number') {
                        let val = found.getAttribute('content') || found.getAttribute('datetime')
                            || found.getAttribute('data-price') || found.innerText?.trim() || found.getAttribute('src') || found.getAttribute('href') || null;
                        if (type === 'number' && val) val = parseFloat(val.replace(/[^0-9.-]/g, '')) || null;
                        result[key] = val;
                    } else if (type === 'boolean') {
                        result[key] = found !== null;
                    } else if (type === 'array') {
                        result[key] = Array.from(root.querySelectorAll(candidates[candidates.length - 1] || sel))
                            .map(e => e.innerText?.trim()).filter(Boolean).slice(0, 20);
                    } else {
                        result[key] = found.innerText?.trim() || null;
                    }
                }
                return result;
            }, { scopeSelector: scope, schemaProps: schema.properties || schema });

            return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
        }

        // Test generation
        case 'browser_generate_playwright_test': {
            const script = recorder.generate(args.testName || 'recorded_session');
            if (!script) return { content: [{ type: 'text', text: 'No actions recorded. Interact with the browser first.' }] };
            if (args.outputPath) {
                const dir = path.dirname(args.outputPath);
                if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
                fs.writeFileSync(args.outputPath, script);
                return { content: [{ type: 'text', text: `Playwright test saved to ${args.outputPath}\n\n${script}` }] };
            }
            return { content: [{ type: 'text', text: script }] };
        }
        case 'browser_clear_recording': {
            recorder.clear();
            return { content: [{ type: 'text', text: 'Recording cleared. Subsequent actions will be recorded fresh.' }] };
        }

        // Performance / Core Web Vitals
        case 'browser_performance': {
            const [metrics, cwv] = await Promise.all([
                page.evaluate(() => {
                    const nav = performance.getEntriesByType('navigation')[0] || {};
                    const paint = Object.fromEntries(
                        performance.getEntriesByType('paint').map(e => [e.name.replace('first-', ''), Math.round(e.startTime)])
                    );
                    const resources = performance.getEntriesByType('resource');
                    return {
                        domContentLoaded: Math.round(nav.domContentLoadedEventEnd - nav.fetchStart) || null,
                        load: Math.round(nav.loadEventEnd - nav.fetchStart) || null,
                        ttfb: Math.round(nav.responseStart - nav.fetchStart) || null,
                        paint,
                        resourceCount: resources.length,
                        transferSize: Math.round(resources.reduce((s, r) => s + (r.transferSize || 0), 0) / 1024),
                    };
                }),
                page.evaluate(() => new Promise(resolve => {
                    const result = {};
                    try {
                        new PerformanceObserver(list => {
                            for (const entry of list.getEntries()) {
                                if (entry.entryType === 'largest-contentful-paint') result.lcp = Math.round(entry.startTime);
                                if (entry.entryType === 'layout-shift') result.cls = (result.cls || 0) + entry.value;
                            }
                        }).observe({ type: 'largest-contentful-paint', buffered: true });
                        new PerformanceObserver(list => {
                            for (const entry of list.getEntries()) {
                                if (entry.entryType === 'layout-shift') result.cls = ((result.cls || 0) + entry.value);
                            }
                        }).observe({ type: 'layout-shift', buffered: true });
                    } catch (_) {}
                    setTimeout(() => resolve(result), 500);
                })),
            ]);

            const out = { ...metrics, coreWebVitals: cwv };
            const lcpRating = cwv.lcp ? (cwv.lcp < 2500 ? 'good' : cwv.lcp < 4000 ? 'needs-improvement' : 'poor') : 'unknown';
            const clsRating = cwv.cls !== undefined ? (cwv.cls < 0.1 ? 'good' : cwv.cls < 0.25 ? 'needs-improvement' : 'poor') : 'unknown';
            out.ratings = { lcp: lcpRating, cls: clsRating };
            return { content: [{ type: 'text', text: JSON.stringify(out, null, 2) }] };
        }

        // Planner-validator
        case 'browser_assert': {
            const type = args.conditionType || 'selector';
            let passed = false;
            let actual = null;

            if (type === 'selector') {
                const el = await page.$(args.condition);
                if (el) {
                    const text = await el.innerText().catch(() => '');
                    if (args.expected) {
                        passed = text.includes(args.expected);
                        actual = text.trim().substring(0, 300);
                    } else {
                        passed = true;
                    }
                } else {
                    passed = false;
                    // Report what is near the selector's tag on the page to help re-plan
                    const tag = args.condition.split(/[\s.#\[]/)[0] || 'div';
                    const nearby = await page.evaluate(t => {
                        const els = Array.from(document.querySelectorAll(t)).slice(0, 5);
                        return els.map(e => e.outerHTML.substring(0, 200)).join('\n');
                    }, tag).catch(() => '');
                    actual = nearby || '(element not found, page may have changed)';
                }
            } else if (type === 'url') {
                const url = page.url();
                passed = url.includes(args.condition);
                actual = url;
            } else if (type === 'js') {
                const res = await page.evaluate(expr => {
                    // eslint-disable-next-line no-new-func
                    return new Function(`return (${expr})`)();
                }, args.condition).catch(e => ({ error: e.message }));
                passed = !!res && !res.error;
                actual = JSON.stringify(res);
            }

            if (passed) {
                return { content: [{ type: 'text', text: `✓ Assert passed.` }] };
            }
            return {
                content: [{ type: 'text', text: `✗ Assert failed.\nCondition: ${args.condition}\nActual: ${actual}` }],
                isError: true,
            };
        }

        // Cache management
        case 'browser_cache_stats': {
            const s = cache.stats();
            return { content: [{ type: 'text', text: JSON.stringify(s, null, 2) }] };
        }

        // Health
        case 'browser_health': {
            const health = await healthCheck();
            return { content: [{ type: 'text', text: JSON.stringify(health, null, 2) }] };
        }

        default:
            throw new Error(`Unknown tool: ${name}`);
    }
}

module.exports = {
    TOOLS,
    handleToolCall
};
