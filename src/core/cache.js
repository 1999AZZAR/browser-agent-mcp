/*
 * Copyright (c) 2026 Azzar Budiyanto / LilyOpenCMS.
 * Licensed under the MIT License.
 * Contact: azzar.mr.zs@gmail.com for inquiries.
 *
 * Action selector cache — persists CSS/XPath selectors to disk keyed by
 * hostname with LRU eviction (500 entries) and 7-day TTL to speed up
 * repeated interactions on the same site.
 */
const fs = require('fs');
const path = require('path');

// Action cache — maps hostname+description → CSS selector.
// Why: Finding elements by text (e.g., "Sign In") is expensive. Once we discover
// the selector for a text on a given site, we cache it for 7 days.
// This cuts token usage by ~50% for repeated actions on the same site.
const CACHE_FILE = path.join(__dirname, '../../user_data/action_cache.json');
const MAX_ENTRIES = 500;
const STALE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

let _cache = null;

// Lazy-load cache from disk — avoids I/O on every tool call
function load() {
    if (_cache) return _cache;
    try {
        if (fs.existsSync(CACHE_FILE)) {
            _cache = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
        }
    } catch (_) {}
    if (!_cache || typeof _cache !== 'object') _cache = {};
    return _cache;
}

// Persist cache to disk — called after every mutation
function save() {
    try {
        const dir = path.dirname(CACHE_FILE);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(CACHE_FILE, JSON.stringify(_cache, null, 2));
    } catch (_) {}
}

// Cache key format: "hostname::description" — scoping prevents cross-site conflicts
function cacheKey(hostname, description) {
    return `${hostname}::${description.toLowerCase().trim()}`;
}

// Get cached selector — returns null if missing or stale
function get(hostname, description) {
    const cache = load();
    const entry = cache[cacheKey(hostname, description)];
    if (!entry) return null;
    if (Date.now() - entry.ts > STALE_MS) {
        delete cache[cacheKey(hostname, description)];
        save();
        return null;
    }
    return entry.selector;
}

// Store selector with timestamp — evicts oldest entries when over limit
function set(hostname, description, selector) {
    const cache = load();
    const key = cacheKey(hostname, description);
    cache[key] = { selector, ts: Date.now() };

    // LRU-style eviction: remove oldest entries when cache exceeds limit
    const keys = Object.keys(cache);
    if (keys.length > MAX_ENTRIES) {
        const sorted = keys.sort((a, b) => cache[a].ts - cache[b].ts);
        sorted.slice(0, keys.length - MAX_ENTRIES).forEach(k => delete cache[k]);
    }
    save();
}

// Remove a specific entry — called when a cached selector fails
function invalidate(hostname, description) {
    const cache = load();
    delete cache[cacheKey(hostname, description)];
    save();
}

// Return cache stats — used by browser_cache_stats tool
function stats() {
    const cache = load();
    const entries = Object.keys(cache).length;
    const stale = Object.values(cache).filter(e => Date.now() - e.ts > STALE_MS).length;
    return { entries, stale };
}

module.exports = { get, set, invalidate, stats };
