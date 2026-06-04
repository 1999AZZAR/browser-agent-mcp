const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { SourceMapConsumer } = require('source-map');

// Cache of url → SourceMapConsumer (loaded on demand)
const _sourceMapCache = new Map();

const CONFIG = {
    userDataDir: path.join(__dirname, '../../user_data'),
    viewport: { width: 1280, height: 720 },
};

const STATE_FILE = path.join(CONFIG.userDataDir, 'session_state.json');

let browserContext = null;
let activePage = null;
const activeRoutes = new Map(); // pattern → { action, options }
const namedPages = new Map();   // name → Page

const pageConsoleLog = new WeakMap(); // page → Message[]
const pageNetworkLog = new WeakMap(); // page → Request[]
const MAX_LOG_ENTRIES = 100;

async function getBrowserContext() {
    if (browserContext) {
        try {
            await browserContext.pages();
        } catch (e) {
            console.error('[Browser] Existing context is closed. Relaunching...');
            browserContext = null;
            activePage = null;
            namedPages.clear();
        }
    }

    if (!browserContext) {
        await ensureUserDataDir();

        browserContext = await chromium.launchPersistentContext(CONFIG.userDataDir, {
            headless: false,
            viewport: CONFIG.viewport,
            userAgent: 'Mozilla/5.0 (X11; Linux x86_64; rv:140.0) Gecko/20100101 Firefox/140.0',
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-gpu',
                '--no-first-run',
                '--no-default-browser-check',
                '--disable-blink-features=AutomationControlled',
                '--excludeSwitches=enable-automation',
                '--use-fake-ui-for-media-stream',
            ],
            ignoreDefaultArgs: ['--enable-automation'],
        });

        injectCookiesIfExist();

        browserContext.on('close', () => {
            browserContext = null;
            activePage = null;
            namedPages.clear();
        });

        // Attempt to restore previous session state (tabs + routes)
        await restoreState().catch(e => console.error('[Browser] State restore failed:', e.message));
    }
    return browserContext;
}

async function ensureUserDataDir() {
    if (!fs.existsSync(CONFIG.userDataDir)) fs.mkdirSync(CONFIG.userDataDir, { recursive: true });
    // Clean stale lockfiles
    ['SingletonLock', 'SingletonSocket', 'SingletonCookie'].forEach(f => {
        try { fs.unlinkSync(path.join(CONFIG.userDataDir, f)); } catch (_) {}
    });
}

function injectCookiesIfExist() {
    const cookiesPath = path.join(__dirname, '../../cookies.json');
    if (fs.existsSync(cookiesPath)) {
        try {
            const cookies = JSON.parse(fs.readFileSync(cookiesPath, 'utf8'));
            browserContext.addCookies(cookies).catch(() => {});
            console.error(`[Browser] Injected ${cookies.length} cookies from cookies.json`);
        } catch (e) {
            console.error(`[Browser] Failed to inject cookies: ${e.message}`);
        }
    }
}

// ── Session State Persistence ──────────────────────────────────────────────────

const SNAP_DIR = path.join(CONFIG.userDataDir, 'snapshots');
const CURR_SNAP = path.join(SNAP_DIR, 'currentstate.json');
const LAST_SNAP = path.join(SNAP_DIR, 'laststate.json');

async function saveState() {
    if (!browserContext) return;
    const pages = [];
    const seen = new Set();
    for (const [name, pg] of namedPages) {
        try {
            if (pg.isClosed()) continue;
            const url = pg.url();
            if (url && url !== 'about:blank') {
                pages.push({ name, url });
                seen.add(pg);
            }
        } catch (_) {}
    }
    // Include unnamed context pages
    try {
        const ctxPages = browserContext.pages();
        for (const pg of ctxPages) {
            if (seen.has(pg) || pg.isClosed()) continue;
            const url = pg.url();
            if (url && url !== 'about:blank') {
                pages.push({ name: `_tab${pg.index || pages.length}`, url });
            }
        }
    } catch (_) {}

    const routes = listRoutes();
    const activeName = getActiveName();
    const state = { pages, routes, activeName, timestamp: Date.now() };
    try {
        fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
    } catch (_) {}
}

async function restoreState() {
    if (!fs.existsSync(STATE_FILE)) return;
    const raw = fs.readFileSync(STATE_FILE, 'utf8').trim();
    if (!raw) return;
    const state = JSON.parse(raw);
    if (!state.pages || !state.pages.length) return;

    const ctx = browserContext;
    if (!ctx) return;

    // Close the blank auto-created page
    for (const p of ctx.pages()) {
        try { if (p.url() === 'about:blank' || !p.url()) await p.close(); } catch (_) {}
    }

    // Reopen saved pages
    for (const { name, url } of state.pages) {
        const pg = await ctx.newPage();
        setupPage(pg);
        namedPages.set(name, pg);
        pg.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {});
    }

    // Set active page
    if (state.activeName && namedPages.has(state.activeName)) {
        activePage = namedPages.get(state.activeName);
    } else {
        activePage = namedPages.values().next().value;
    }
    if (activePage) activePage.bringToFront().catch(() => {});

    // Reapply intercept routes
    for (const entry of state.routes || []) {
        const { pattern, action, options } = entry;
        await addRoute(pattern, action, (options && typeof options === 'object') ? options : {}).catch(() => {});
    }

    console.error(`[Browser] Restored ${state.pages.length} tab(s) and ${(state.routes || []).length} intercept rule(s) from session state`);
}

// ── AX Tree Snapshot Management ────────────────────────────────────────────────

async function rotateSnapshot() {
    try {
        if (fs.existsSync(CURR_SNAP)) {
            fs.mkdirSync(SNAP_DIR, { recursive: true });
            fs.copyFileSync(CURR_SNAP, LAST_SNAP);
        }
    } catch (_) {}
}

async function saveSnapshot(data) {
    try {
        fs.mkdirSync(SNAP_DIR, { recursive: true });
        fs.writeFileSync(CURR_SNAP, JSON.stringify(data, null, 2));
    } catch (_) {}
}

function loadSnapshot(snapPath) {
    try {
        if (!fs.existsSync(snapPath)) return null;
        return JSON.parse(fs.readFileSync(snapPath, 'utf8'));
    } catch (_) { return null; }
}

function getCurrSnapshot() { return loadSnapshot(CURR_SNAP); }
function getLastSnapshot() { return loadSnapshot(LAST_SNAP); }

// ── Page Management ────────────────────────────────────────────────────────────

async function getPage() {
    const ctx = await getBrowserContext();
    if (!activePage || activePage.isClosed()) {
        // Recover from named pages first
        if (namedPages.size > 0) {
            for (const [, pg] of namedPages) {
                if (!pg.isClosed()) {
                    activePage = pg;
                    return activePage;
                }
            }
            namedPages.clear();
        }
        const pages = ctx.pages();
        activePage = pages.length > 0 ? pages[0] : await ctx.newPage();
        setupPage(activePage);
    }
    return activePage;
}

async function resolveSourceLocation(url, line, col) {
    if (!url || !url.endsWith('.js')) return null;
    try {
        let consumer = _sourceMapCache.get(url);
        if (!consumer) {
            // Try fetching the source map
            const mapUrl = url + '.map';
            const resp = await fetch(mapUrl).catch(() => null);
            if (!resp || !resp.ok) return null;
            const rawMap = await resp.json().catch(() => null);
            if (!rawMap) return null;
            consumer = await new SourceMapConsumer(rawMap);
            _sourceMapCache.set(url, consumer);
        }
        const pos = consumer.originalPositionFor({ line: line || 1, column: col || 0 });
        if (pos.source) return `${pos.source}:${pos.line}:${pos.column}`;
    } catch (_) {}
    return null;
}

function setupPage(page) {
    page.on('dialog', async (dialog) => {
        console.error(`[Browser] Native dialog [${dialog.type()}]: "${dialog.message()}" — auto-accepting`);
        try { await dialog.accept(); } catch (_) {}
    });

    // Console capture with source-map resolution
    const consoleLog = [];
    pageConsoleLog.set(page, consoleLog);
    page.on('console', async msg => {
        const loc = msg.location();
        let resolvedLoc = loc?.url ? `${loc.url}:${loc.lineNumber || 0}` : undefined;
        if (loc?.url && loc?.lineNumber) {
            const mapped = await resolveSourceLocation(loc.url, loc.lineNumber, loc.columnNumber).catch(() => null);
            if (mapped) resolvedLoc = mapped;
        }
        consoleLog.push({ type: msg.type(), text: msg.text(), url: resolvedLoc });
        if (consoleLog.length > MAX_LOG_ENTRIES) consoleLog.shift();
    });
    page.on('pageerror', err => {
        consoleLog.push({ type: 'error', text: err.message });
        if (consoleLog.length > MAX_LOG_ENTRIES) consoleLog.shift();
    });

    // Network capture
    const netLog = [];
    pageNetworkLog.set(page, netLog);
    const reqStartTimes = new Map();
    page.on('request', req => { reqStartTimes.set(req, Date.now()); });
    page.on('response', resp => {
        const req = resp.request();
        const start = reqStartTimes.get(req) || Date.now();
        reqStartTimes.delete(req);
        netLog.push({
            method: req.method(),
            url: req.url(),
            status: resp.status(),
            contentType: (resp.headers()['content-type'] || '').split(';')[0].trim(),
            duration: Date.now() - start,
        });
        if (netLog.length > MAX_LOG_ENTRIES) netLog.shift();
    });
}

function getConsoleMessages(page) { return pageConsoleLog.get(page) || []; }
function getNetworkRequests(page) { return pageNetworkLog.get(page) || []; }
function clearConsoleMessages(page) { const log = pageConsoleLog.get(page); if (log) log.length = 0; }
function clearNetworkRequests(page) { const log = pageNetworkLog.get(page); if (log) log.length = 0; }

async function listPages() {
    const ctx = await getBrowserContext();
    const pages = ctx.pages();
    return pages.map((p, i) => ({
        index: i,
        title: p.title().catch(() => 'Error'),
        url: p.url(),
        active: p === activePage,
    }));
}

async function switchPage(index) {
    const ctx = await getBrowserContext();
    const pages = ctx.pages();
    if (index >= 0 && index < pages.length) {
        activePage = pages[index];
        await activePage.bringToFront();
        return true;
    }
    return false;
}

async function newPage() {
    const ctx = await getBrowserContext();
    activePage = await ctx.newPage();
    setupPage(activePage);
    return activePage;
}

// ── Named Pages (Agent Parallelism) ────────────────────────────────────────────

async function createNamedPage(name) {
    const ctx = await getBrowserContext();
    // If name already exists, just switch to it
    if (namedPages.has(name)) {
        activePage = namedPages.get(name);
        await activePage.bringToFront();
        return false;
    }
    const pg = await ctx.newPage();
    setupPage(pg);
    namedPages.set(name, pg);
    activePage = pg;
    return true;
}

async function switchToNamedPage(name) {
    if (!namedPages.has(name)) return false;
    activePage = namedPages.get(name);
    await activePage.bringToFront();
    return true;
}

async function removeNamedPage(name) {
    if (!namedPages.has(name)) return false;
    const pg = namedPages.get(name);
    namedPages.delete(name);
    try { await pg.close(); } catch (_) {}

    // Recover to another page
    if (activePage === pg || activePage?.isClosed()) {
        const remaining = Array.from(namedPages.values());
        const ctx = browserContext;
        if (remaining.length > 0) {
            activePage = remaining[0];
        } else if (ctx) {
            const ctxPages = ctx.pages().filter(p => !p.isClosed());
            activePage = ctxPages.length > 0 ? ctxPages[0] : await ctx.newPage();
            setupPage(activePage);
        }
    }
    return true;
}

function listNamedPages() {
    return Array.from(namedPages.entries()).map(([name, pg]) => ({
        name,
        url: pg.url(),
        hasActivePage: pg === activePage,
    }));
}

function getActiveName() {
    for (const [name, pg] of namedPages) {
        if (pg === activePage) return name;
    }
    return 'default';
}

// ── Lifecycle ──────────────────────────────────────────────────────────────────

async function closeBrowser() {
    if (browserContext) {
        await browserContext.close();
        browserContext = null;
        activePage = null;
        activeRoutes.clear();
        namedPages.clear();
    }
    // Clear saved state so we start fresh next time
    try { fs.unlinkSync(STATE_FILE); } catch (_) {}
}

// ── Request Interception ───────────────────────────────────────────────────────

async function addRoute(pattern, action, options = {}) {
    const ctx = await getBrowserContext();
    if (activeRoutes.has(pattern)) {
        await ctx.unroute(pattern).catch(() => {});
    }
    await ctx.route(pattern, (route) => {
        if (action === 'block') return route.abort();
        if (action === 'mock') {
            return route.fulfill({
                status: options.status ?? 200,
                contentType: options.contentType ?? 'application/json',
                body: typeof options.body === 'object' ? JSON.stringify(options.body) : (options.body ?? ''),
                headers: options.headers ?? {},
            });
        }
        return route.continue({
            headers: { ...route.request().headers(), ...(options.headers ?? {}) },
        });
    });
    activeRoutes.set(pattern, { action, options });
    await saveState();
}

async function clearRoutes() {
    const ctx = await getBrowserContext();
    for (const pattern of activeRoutes.keys()) {
        await ctx.unroute(pattern).catch(() => {});
    }
    activeRoutes.clear();
    await saveState();
}

function listRoutes() {
    return Array.from(activeRoutes.entries()).map(([pattern, config]) => ({ pattern, ...config }));
}

module.exports = {
    getPage,
    getBrowserContext,
    closeBrowser,
    listPages,
    switchPage,
    newPage,
    createNamedPage,
    switchToNamedPage,
    removeNamedPage,
    listNamedPages,
    addRoute,
    clearRoutes,
    listRoutes,
    saveState,
    rotateSnapshot,
    saveSnapshot,
    getCurrSnapshot,
    getLastSnapshot,
    getConsoleMessages,
    getNetworkRequests,
    clearConsoleMessages,
    clearNetworkRequests,
};
