/*
 * Copyright (c) 2026 Azzar Budiyanto / LilyOpenCMS.
 * Licensed under the MIT License.
 * Contact: azzar.mr.zs@gmail.com for inquiries.
 */
/**
 * CSS selectors for interactive elements, main content, and CAPTCHA detection.
 * These are shared across captureState, observeInteractable, and CAPTCHA tools.
 *
 * INTERACTIVE_SELECTOR: covers buttons, links, inputs, ARIA roles, modals, and close buttons.
 * Used to find all clickable/tappable elements for the observe→act pattern.
 */
const INTERACTIVE_SELECTOR = [
    // Core interactive elements
    'button', 'a[href]', 'input', 'textarea', 'select',
    'label',
    // ARIA role equivalents — for custom components that don't use native HTML
    '[role="button"]', '[role="link"]', '[role="checkbox"]',
    '[role="radio"]', '[role="combobox"]', '[role="menuitem"]',
    '[role="tab"]', '[role="option"]', '[contenteditable="true"]',
    // Modals & Popups — need to be detected for auto-dismissal
    '.modal', '.dialog', '.popup', '.swal2-popup',
    '[role="dialog"]', '[role="alertdialog"]', '[aria-modal="true"]',
    // Close buttons — common patterns across UI frameworks
    '.btn-close', '.close', '[data-dismiss]', '[data-bs-dismiss]',
    '[aria-label="Close"]', '[aria-label="close"]', '[aria-label="Dismiss"]',
].join(', ');

// Content root selectors — used to scope text extraction to main content.
// Skips nav, header, footer for cleaner page understanding.
const MAIN_CONTENT_SELECTORS = [
    'main', 'article', '#content', '.content', '.main-content',
    'body' // Fallback if no semantic HTML5 elements found
];

// CAPTCHA detection selectors — covers reCAPTCHA, hCaptcha, and generic CAPTCHAs.
// Used by captureState to trigger auto-handling or DuckDuckGo fallback.
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
