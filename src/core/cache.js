const fs = require('fs');
const path = require('path');

const CACHE_FILE = path.join(__dirname, '../../user_data/action_cache.json');
const MAX_ENTRIES = 500;
const STALE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

let _cache = null;

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

function save() {
    try {
        const dir = path.dirname(CACHE_FILE);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(CACHE_FILE, JSON.stringify(_cache, null, 2));
    } catch (_) {}
}

function cacheKey(hostname, description) {
    return `${hostname}::${description.toLowerCase().trim()}`;
}

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

function set(hostname, description, selector) {
    const cache = load();
    const key = cacheKey(hostname, description);
    cache[key] = { selector, ts: Date.now() };

    // Evict oldest entries if over limit
    const keys = Object.keys(cache);
    if (keys.length > MAX_ENTRIES) {
        const sorted = keys.sort((a, b) => cache[a].ts - cache[b].ts);
        sorted.slice(0, keys.length - MAX_ENTRIES).forEach(k => delete cache[k]);
    }
    save();
}

function invalidate(hostname, description) {
    const cache = load();
    delete cache[cacheKey(hostname, description)];
    save();
}

function stats() {
    const cache = load();
    const entries = Object.keys(cache).length;
    const stale = Object.values(cache).filter(e => Date.now() - e.ts > STALE_MS).length;
    return { entries, stale };
}

module.exports = { get, set, invalidate, stats };
