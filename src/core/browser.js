const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const CONFIG = {
    userDataDir: path.join(__dirname, '../../user_data'),
    viewport: { width: 1280, height: 720 },
};

let browserContext = null;
let activePage = null;
const activeRoutes = new Map(); // pattern → { action, options }

async function getBrowserContext() {
    // If context exists, verify it's still connected
    if (browserContext) {
        try {
            await browserContext.pages();
        } catch (e) {
            console.error('[Browser] Existing context is closed. Relaunching...');
            browserContext = null;
            activePage = null;
        }
    }

    if (!browserContext) {
        if (!fs.existsSync(CONFIG.userDataDir)) fs.mkdirSync(CONFIG.userDataDir, { recursive: true });
        
        // Clean stale lockfiles
        ['SingletonLock', 'SingletonSocket', 'SingletonCookie'].forEach(f => {
            try { fs.unlinkSync(path.join(CONFIG.userDataDir, f)); } catch (_) {}
        });

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

        // Inject cookies if they exist
        const cookiesPath = path.join(__dirname, '../../cookies.json');
        if (fs.existsSync(cookiesPath)) {
            try {
                const cookies = JSON.parse(fs.readFileSync(cookiesPath, 'utf8'));
                await browserContext.addCookies(cookies);
                console.error(`[Browser] Injected ${cookies.length} cookies from cookies.json`);
            } catch (e) {
                console.error(`[Browser] Failed to inject cookies: ${e.message}`);
            }
        }

        // Handle context close
        browserContext.on('close', () => {
            browserContext = null;
            activePage = null;
        });
    }
    return browserContext;
}

async function getPage() {
    const ctx = await getBrowserContext();
    if (!activePage || activePage.isClosed()) {
        const pages = ctx.pages();
        activePage = pages.length > 0 ? pages[0] : await ctx.newPage();
        setupPage(activePage);
    }
    return activePage;
}

function setupPage(page) {
    // Auto-accept native browser dialogs
    page.on('dialog', async (dialog) => {
        console.error(`[Browser] Native dialog [${dialog.type()}]: "${dialog.message()}" — auto-accepting`);
        try { await dialog.accept(); } catch (_) {}
    });
}

async function listPages() {
    const ctx = await getBrowserContext();
    const pages = ctx.pages();
    const result = [];
    for (let i = 0; i < pages.length; i++) {
        const p = pages[i];
        result.push({
            index: i,
            title: await p.title().catch(() => 'Error'),
            url: p.url(),
            active: p === activePage
        });
    }
    return result;
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

async function closeBrowser() {
    if (browserContext) {
        await browserContext.close();
        browserContext = null;
        activePage = null;
        activeRoutes.clear();
    }
}

async function addRoute(pattern, action, options = {}) {
    const ctx = await getBrowserContext();
    if (activeRoutes.has(pattern)) {
        await ctx.unroute(pattern).catch(() => {});
    }
    await ctx.route(pattern, (route) => {
        if (action === 'block') {
            return route.abort();
        }
        if (action === 'mock') {
            return route.fulfill({
                status: options.status ?? 200,
                contentType: options.contentType ?? 'application/json',
                body: typeof options.body === 'object' ? JSON.stringify(options.body) : (options.body ?? ''),
                headers: options.headers ?? {},
            });
        }
        // 'modify' — pass through with extra headers
        return route.continue({
            headers: { ...route.request().headers(), ...(options.headers ?? {}) },
        });
    });
    activeRoutes.set(pattern, { action, options });
}

async function clearRoutes() {
    const ctx = await getBrowserContext();
    for (const pattern of activeRoutes.keys()) {
        await ctx.unroute(pattern).catch(() => {});
    }
    activeRoutes.clear();
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
    addRoute,
    clearRoutes,
    listRoutes,
};
