const { INTERACTIVE_SELECTOR, MAIN_CONTENT_SELECTORS, CAPTCHA_SELECTORS } = require('../utils/selectors');

async function captureState(page) {
    const state = await page.evaluate(({ interactiveSelector, mainSelectors, captchaSelectors }) => {
        // Find main content root
        const root = mainSelectors.reduce((found, sel) => found || document.querySelector(sel), null) || document.body;

        // Headings for structure
        const headings = Array.from(root.querySelectorAll('h1,h2,h3,h4,h5'))
            .map(el => {
                const r = el.getBoundingClientRect();
                return (r.width > 0) ? { level: parseInt(el.tagName[1]), text: el.innerText.trim().substring(0, 200) } : null;
            }).filter(Boolean).slice(0, 15);

        // Text blocks for context
        const blocks = Array.from(root.querySelectorAll('p, li, td, blockquote, pre code'))
            .map(el => {
                const r = el.getBoundingClientRect();
                const cs = window.getComputedStyle(el);
                if (r.width === 0 || cs.display === 'none' || cs.visibility === 'hidden') return null;
                return el.innerText.trim().substring(0, 500);
            }).filter(t => t && t.length > 10).slice(0, 40);

        // Interactive elements
        const elements = Array.from(document.querySelectorAll(interactiveSelector)).map(el => {
            const rect = el.getBoundingClientRect();
            const style = window.getComputedStyle(el);
            const visible = rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
            if (!visible) return null;

            const entry = {
                tag: el.tagName,
                x: Math.round(rect.left), y: Math.round(rect.top),
                w: Math.round(rect.width), h: Math.round(rect.height),
            };
            if (el.id) entry.id = el.id;
            if (el.className) entry.class = el.className.toString().trim().substring(0, 120);
            if (el.getAttribute('role')) entry.role = el.getAttribute('role');
            if (el.innerText) entry.text = el.innerText.trim().substring(0, 150);
            if (el.tagName === 'A' && el.href) entry.href = el.href;
            if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') entry.value = el.value.substring(0, 100);
            
            return entry;
        }).filter(Boolean);

        // Popups/Modals
        const popups = Array.from(document.querySelectorAll('.modal, [role="dialog"], .swal2-popup'))
            .map(el => {
                const rect = el.getBoundingClientRect();
                if (rect.width === 0) return null;
                return {
                    text: el.innerText.trim().substring(0, 300),
                    visible: true
                };
            }).filter(Boolean);

        // CAPTCHA Detection
        const captchaDetected = !!document.querySelector(captchaSelectors);

        return {
            url: location.href,
            title: document.title,
            headings,
            text: blocks.join('\n').substring(0, 5000),
            elements,
            popups: popups.length ? popups : undefined,
            captchaDetected
        };
    }, { 
        interactiveSelector: INTERACTIVE_SELECTOR, 
        mainSelectors: MAIN_CONTENT_SELECTORS,
        captchaSelectors: CAPTCHA_SELECTORS 
    });

    let axTree = null;
    try { axTree = await page.accessibility.snapshot({ interestingOnly: true }); } catch (_) {}
    state.axTree = axTree || undefined;

    return state;
}

module.exports = {
    captureState
};
