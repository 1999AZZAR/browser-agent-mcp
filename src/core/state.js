const { INTERACTIVE_SELECTOR, MAIN_CONTENT_SELECTORS, CAPTCHA_SELECTORS } = require('../utils/selectors');

// AX roles that carry actionable or structural meaning — everything else is noise
const KEEP_ROLES = new Set([
    'button', 'link', 'textbox', 'searchbox', 'checkbox', 'radio', 'combobox',
    'listbox', 'option', 'menuitem', 'menuitemcheckbox', 'menuitemradio',
    'tab', 'tabpanel', 'treeitem', 'switch', 'slider', 'spinbutton',
    'heading', 'banner', 'main', 'navigation', 'contentinfo', 'complementary',
    'alert', 'alertdialog', 'dialog', 'status', 'log', 'progressbar',
    'grid', 'row', 'columnheader', 'rowheader', 'cell', 'gridcell',
    'img', 'figure', 'form',
]);

function pruneAxTree(node, depth = 0) {
    if (!node || depth > 12) return null;
    const keep = KEEP_ROLES.has(node.role) || depth === 0;
    const children = (node.children || [])
        .map(c => pruneAxTree(c, depth + 1))
        .filter(Boolean);

    if (!keep && !children.length) return null;

    const out = {};
    if (node.role) out.role = node.role;
    if (node.name) out.name = node.name.substring(0, 200);
    if (node.value !== undefined && node.value !== '') out.value = String(node.value).substring(0, 200);
    if (node.description) out.description = node.description.substring(0, 200);
    if (node.checked !== undefined) out.checked = node.checked;
    if (node.disabled) out.disabled = true;
    if (node.expanded !== undefined) out.expanded = node.expanded;
    if (node.level) out.level = node.level;
    if (children.length) out.children = children;
    return out;
}

let _elementRefs = [];

function storeElementRefs(elements) { _elementRefs = elements; }
function getElementByRef(ref) { return _elementRefs.find(el => el.ref === ref) || null; }

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
        // Assign 1-based ref indices in-browser before returning
        elements.forEach((el, i) => { el.ref = i + 1; });

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
    try {
        const raw = await page.accessibility.snapshot({ interestingOnly: true });
        axTree = raw ? pruneAxTree(raw) : null;
    } catch (_) {}
    state.axTree = axTree || undefined;

    storeElementRefs(state.elements);
    return state;
}

async function observeInteractable(page) {
    const elements = await page.evaluate(({ interactiveSelector }) => {
        return Array.from(document.querySelectorAll(interactiveSelector)).map((el, i) => {
            const rect = el.getBoundingClientRect();
            const style = window.getComputedStyle(el);
            const visible = rect.width > 0 && rect.height > 0
                && style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
            if (!visible) return null;

            const entry = {
                ref: i + 1,
                tag: el.tagName,
                x: Math.round(rect.left), y: Math.round(rect.top),
                w: Math.round(rect.width), h: Math.round(rect.height),
            };
            if (el.id) entry.id = el.id;
            if (el.getAttribute('role')) entry.role = el.getAttribute('role');
            if (el.innerText) entry.text = el.innerText.trim().substring(0, 150);
            if (el.tagName === 'A' && el.href) entry.href = el.href;
            if (el.tagName === 'INPUT' || el.tagName === 'SELECT' || el.tagName === 'TEXTAREA') {
                entry.inputType = el.type || el.tagName.toLowerCase();
                if (el.value) entry.value = el.value.substring(0, 100);
                if (el.placeholder) entry.placeholder = el.placeholder;
                if (el.name) entry.name = el.name;
            }
            return entry;
        }).filter(Boolean);
    }, { interactiveSelector: INTERACTIVE_SELECTOR });

    storeElementRefs(elements);
    return { url: page.url(), title: await page.title(), elementCount: elements.length, elements };
}

module.exports = {
    captureState,
    observeInteractable,
    getElementByRef,
};
