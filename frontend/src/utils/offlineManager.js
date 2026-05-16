/**
 * offlineManager.js — Stale-While-Revalidate (SWR) + Offline-First
 *
 * Strategy:
 *   1. ALWAYS check IndexedDB cache first.
 *   2. If cache exists → return it IMMEDIATELY (zero wait) + kick off
 *      a background refresh that calls onUpdate(freshData) when done.
 *   3. If no cache + online → wait for network (first visit).
 *   4. If no cache + offline → throw.
 *   5. Mutations are queued when offline and replayed on reconnect.
 *
 * Stores:
 *   "responses"  — cached GET responses
 *   "images"     — Base64-encoded images
 *   "syncQueue"  — offline mutation queue
 */

import axios from 'axios';

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────
const DB_NAME    = 'pg-finder-offline';
const DB_VERSION = 1;
const MAX_IMAGES = 120;
const API_TIMEOUT = 30000; // 30 s — generous for slow mobile connections

// ─────────────────────────────────────────────────────────────────────────────
// DB INIT
// ─────────────────────────────────────────────────────────────────────────────
let _dbPromise = null;

function openDB() {
  if (_dbPromise) return _dbPromise;

  _dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('responses')) {
        db.createObjectStore('responses', { keyPath: 'cacheKey' });
      }
      if (!db.objectStoreNames.contains('images')) {
        const imgs = db.createObjectStore('images', { keyPath: 'url' });
        imgs.createIndex('timestamp', 'timestamp', { unique: false });
      }
      if (!db.objectStoreNames.contains('syncQueue')) {
        db.createObjectStore('syncQueue', { keyPath: 'id', autoIncrement: true });
      }
    };

    req.onsuccess = (e) => resolve(e.target.result);
    req.onerror   = (e) => reject(e.target.error);
  });

  return _dbPromise;
}

// ─────────────────────────────────────────────────────────────────────────────
// LOW-LEVEL HELPERS
// ─────────────────────────────────────────────────────────────────────────────
async function dbGet(storeName, key) {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx  = db.transaction(storeName, 'readonly');
      const req = tx.objectStore(storeName).get(key);
      req.onsuccess = () => resolve(req.result);
      req.onerror   = (e) => reject(e.target.error);
    });
  } catch { return undefined; }
}

async function dbPut(storeName, value) {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx  = db.transaction(storeName, 'readwrite');
      const req = tx.objectStore(storeName).put(value);
      req.onsuccess = () => resolve(req.result);
      req.onerror   = (e) => reject(e.target.error);
    });
  } catch { /* storage full / private mode — silent */ }
}

async function dbDelete(storeName, key) {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx  = db.transaction(storeName, 'readwrite');
      const req = tx.objectStore(storeName).delete(key);
      req.onsuccess = () => resolve();
      req.onerror   = (e) => reject(e.target.error);
    });
  } catch { /* silent */ }
}

async function dbGetAll(storeName) {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx  = db.transaction(storeName, 'readonly');
      const req = tx.objectStore(storeName).getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror   = (e) => reject(e.target.error);
    });
  } catch { return []; }
}

async function dbClear(storeName) {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx  = db.transaction(storeName, 'readwrite');
      const req = tx.objectStore(storeName).clear();
      req.onsuccess = () => resolve();
      req.onerror   = (e) => reject(e.target.error);
    });
  } catch { /* silent */ }
}

// ─────────────────────────────────────────────────────────────────────────────
// NETWORK STATUS
// ─────────────────────────────────────────────────────────────────────────────
export function isOnline() {
  return navigator.onLine;
}

// ─────────────────────────────────────────────────────────────────────────────
// CORE FETCH WITH RETRY
// ─────────────────────────────────────────────────────────────────────────────
async function fetchWithRetry(url, headers, retries = 2) {
  let lastErr;
  for (let i = 0; i < retries; i++) {
    try {
      const res = await axios.get(url, { headers, timeout: API_TIMEOUT });
      return res.data;
    } catch (err) {
      lastErr = err;
      if (i < retries - 1) {
        // Wait 1.5 s before retrying
        await new Promise(r => setTimeout(r, 1500));
      }
    }
  }
  throw lastErr;
}

// ─────────────────────────────────────────────────────────────────────────────
// CACHED GET — TRUE STALE-WHILE-REVALIDATE
// ─────────────────────────────────────────────────────────────────────────────
/**
 * SWR-style GET:
 *  ① ALWAYS reads IndexedDB cache first.
 *  ② If cache exists → returns it immediately (zero network wait).
 *     In background, fetches fresh data; when it arrives, calls onUpdate(fresh).
 *  ③ If no cache + online → waits for network (first-ever load).
 *  ④ If no cache + offline → throws.
 *
 * @param {string}   url       — API endpoint
 * @param {string}   token     — Bearer token (optional)
 * @param {Function} onUpdate  — Called with fresh data when background fetch completes
 * @returns {Promise<any>}     — Cached data (instant) or fresh data (first load)
 */
export async function cachedGet(url, token = null, onUpdate = null) {
  const cacheKey = token ? `${url}|${token.slice(-8)}` : url;
  const headers  = token ? { Authorization: `Bearer ${token}` } : {};

  // ── 1. Read cache (never blocks UI) ──────────────────────────────
  const cached = await dbGet('responses', cacheKey);

  // ── 2. Background refresh helper ─────────────────────────────────
  const refresh = () => {
    fetchWithRetry(url, headers)
      .then(async (fresh) => {
        try { await dbPut('responses', { cacheKey, data: fresh, timestamp: Date.now() }); } catch {}
        if (onUpdate) onUpdate(fresh);
      })
      .catch((err) => {
        console.warn('[OfflineManager] Background refresh failed:', url, err.message);
      });
  };

  // ── 3. Cache HIT → instant return + background refresh ───────────
  if (cached) {
    // Only refresh in background if we appear to have connectivity
    if (navigator.onLine) {
      refresh(); // fire-and-forget
    }
    return cached.data;
  }

  // ── 4. Cache MISS + offline → throw ──────────────────────────────
  if (!navigator.onLine) {
    throw new Error('You are offline and no cached data is available for this page.');
  }

  // ── 5. Cache MISS + online → wait for network (first visit) ──────
  const fresh = await fetchWithRetry(url, headers);
  try { await dbPut('responses', { cacheKey, data: fresh, timestamp: Date.now() }); } catch {}
  return fresh;
}

// ─────────────────────────────────────────────────────────────────────────────
// CACHED MUTATE — with offline queue
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Performs a mutating request (POST/PUT/PATCH/DELETE).
 * If offline, queues it to be replayed when the connection returns.
 *
 * @param {string}   method   — HTTP method
 * @param {string}   url      — Endpoint
 * @param {object}   data     — Body (null for DELETE)
 * @param {string}   token    — Bearer token (optional)
 * @param {Function} onQueued — Called when request is queued offline
 */
export async function cachedMutate(method, url, data = null, token = null, onQueued = null) {
  const headers = token ? { Authorization: `Bearer ${token}` } : {};

  if (navigator.onLine) {
    try {
      const res = await axios({ method, url, data, headers, timeout: API_TIMEOUT });
      return res.data;
    } catch (err) {
      // If it looks like a network failure (not a 4xx), queue it
      if (!err.response) {
        await _queueMutation(method, url, data, token, onQueued);
        return null;
      }
      throw err;
    }
  } else {
    await _queueMutation(method, url, data, token, onQueued);
    return null;
  }
}

async function _queueMutation(method, url, data, token, onQueued) {
  const queueItem = { method, url, data, token, queuedAt: Date.now() };
  await dbPut('syncQueue', queueItem);
  if (onQueued) onQueued(queueItem);
  console.log(`[OfflineManager] Queued offline: ${method} ${url}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// SYNC QUEUE REPLAY
// ─────────────────────────────────────────────────────────────────────────────
let _syncInProgress = false;

async function replayQueue() {
  if (_syncInProgress) return;
  _syncInProgress = true;

  try {
    const queue = await dbGetAll('syncQueue');
    if (!queue || queue.length === 0) return;

    console.log(`[OfflineManager] Replaying ${queue.length} queued mutation(s)...`);

    for (const item of queue) {
      try {
        const headers = item.token ? { Authorization: `Bearer ${item.token}` } : {};
        await axios({ method: item.method, url: item.url, data: item.data, headers, timeout: API_TIMEOUT });
        await dbDelete('syncQueue', item.id);
        console.log(`[OfflineManager] ✓ Synced: ${item.method} ${item.url}`);
      } catch (err) {
        // 4xx errors are permanent failures — drop them from queue
        if (err.response && err.response.status < 500) {
          await dbDelete('syncQueue', item.id);
          console.warn(`[OfflineManager] Dropped (${err.response.status}): ${item.method} ${item.url}`);
        } else {
          console.warn(`[OfflineManager] Will retry later: ${item.method} ${item.url}`);
        }
      }
    }
  } finally {
    _syncInProgress = false;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// IMAGE CACHING
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Fetches an image and stores it as Base64 in IndexedDB.
 * Tries both CORS and no-cors modes for maximum compatibility.
 * Silently fails — best-effort only.
 */
export async function cacheImage(url) {
  if (!url || url.startsWith('data:') || url.startsWith('/')) return;

  try {
    // Skip if already cached
    const existing = await dbGet('images', url);
    if (existing) return;

    // Try cors first (needed for blob conversion), then no-cors as last resort
    let res;
    try {
      res = await fetch(url, { mode: 'cors', cache: 'force-cache' });
    } catch {
      // CORS blocked — skip (image will just load from URL when online)
      return;
    }

    if (!res.ok) return;

    const blob   = await res.blob();
    const base64 = await blobToBase64(blob);

    await dbPut('images', { url, base64, timestamp: Date.now() });
    await evictOldImages();
  } catch {
    // Best-effort — silent failure
  }
}

export async function getCachedImage(url) {
  if (!url) return null;
  if (url.startsWith('data:')) return url;
  try {
    const cached = await dbGet('images', url);
    return cached?.base64 || null;
  } catch { return null; }
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

async function evictOldImages() {
  try {
    const db  = await openDB();
    const tx  = db.transaction('images', 'readwrite');
    const idx = tx.objectStore('images').index('timestamp');
    const all = await new Promise((resolve, reject) => {
      const req = idx.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror   = (e) => reject(e.target.error);
    });

    if (all.length <= MAX_IMAGES) return;
    all.sort((a, b) => a.timestamp - b.timestamp);
    const toDelete = all.slice(0, all.length - MAX_IMAGES);
    await Promise.all(toDelete.map(img => dbDelete('images', img.url)));
  } catch { /* non-critical */ }
}

// ─────────────────────────────────────────────────────────────────────────────
// CACHE INVALIDATION
// ─────────────────────────────────────────────────────────────────────────────
export async function invalidateCache(url, token = null) {
  const cacheKey = token ? `${url}|${token.slice(-8)}` : url;
  await dbDelete('responses', cacheKey);
}

export async function clearAllCache() {
  await dbClear('responses');
  await dbClear('syncQueue');
}

// ─────────────────────────────────────────────────────────────────────────────
// SYNC LISTENER
// ─────────────────────────────────────────────────────────────────────────────
let _listenerAttached = false;

export function startSyncListener() {
  if (_listenerAttached) return;
  _listenerAttached = true;

  window.addEventListener('online', () => {
    console.log('[OfflineManager] Back online — syncing queue...');
    replayQueue();
  });

  if (navigator.onLine) {
    replayQueue();
  }
}
