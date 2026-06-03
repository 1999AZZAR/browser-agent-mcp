const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const CONFIG = {
    userDataDir: path.join(__dirname, '../../user_data'),
    viewport: { width: 1280, height: 720 },
};

let browserContext = null;
let page = null;

async function getBrowserContext() {
    // If context exists, verify it's still connected
    if (browserContext) {
        try {
            await browserContext.pages();
        } catch (e) {
            console.error('[Browser] Existing context is closed. Relaunching...');
            browserContext = null;
            page = null;
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
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
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

        // Handle context close
        browserContext.on('close', () => {
            browserContext = null;
            page = null;
        });
    }
    return browserContext;
}

async function getPage() {
    const ctx = await getBrowserContext();
    if (!page || page.isClosed()) {
        const pages = ctx.pages();
        page = pages.length > 0 ? pages[0] : await ctx.newPage();
        
        // Auto-accept native browser dialogs
        page.on('dialog', async (dialog) => {
            console.error(`[Browser] Native dialog [${dialog.type()}]: "${dialog.message()}" — auto-accepting`);
            try { await dialog.accept(); } catch (_) {}
        });
    }
    return page;
}

async function closeBrowser() {
    if (browserContext) {
        await browserContext.close();
        browserContext = null;
        page = null;
    }
}

module.exports = {
    getPage,
    getBrowserContext,
    closeBrowser
};
