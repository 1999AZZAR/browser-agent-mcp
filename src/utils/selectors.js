/**
 * Common selectors for interactive and important elements.
 */
const INTERACTIVE_SELECTOR = [
    'button', 'a[href]', 'input', 'textarea', 'select',
    'label', '[role="button"]', '[role="link"]', '[role="checkbox"]',
    '[role="radio"]', '[role="combobox"]', '[role="menuitem"]',
    '[role="tab"]', '[role="option"]', '[contenteditable="true"]',
    // Modals & Popups
    '.modal', '.dialog', '.popup', '.swal2-popup',
    '[role="dialog"]', '[role="alertdialog"]', '[aria-modal="true"]',
    // Close buttons
    '.btn-close', '.close', '[data-dismiss]', '[data-bs-dismiss]',
    '[aria-label="Close"]', '[aria-label="close"]', '[aria-label="Dismiss"]',
].join(', ');

const MAIN_CONTENT_SELECTORS = [
    'main', 'article', '#content', '.content', '.main-content',
    'body' // Fallback
];

const CAPTCHA_SELECTORS = [
    '.g-recaptcha', 'iframe[src*="recaptcha"]',
    '.h-captcha', 'iframe[src*="hcaptcha"]',
    '#captcha-form', '#captcha', '.captcha',
    'iframe[title*="reCAPTCHA"]', 'iframe[title*="hCaptcha"]',
    'div[id*="captcha"]', 'img[src*="captcha"]'
].join(', ');

module.exports = {
    INTERACTIVE_SELECTOR,
    MAIN_CONTENT_SELECTORS,
    CAPTCHA_SELECTORS
};
