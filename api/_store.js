const path = require('path');

function cleanEnv(value) {
  return (value || '').trim().replace(/^"|"$/g, '').replace(/^'|'$/g, '');
}

// Storage abstraction for serverless handlers.
// - If @vercel/kv is available and KV envs are set, use it
// - Otherwise fallback to local file store (server/sessionStore.js)

let kv = null;
let useKV = false;
try {
  // Sanitize commonly mis-set KV envs and ensure RO token falls back to RW token
  if (process.env.KV_REST_API_URL) process.env.KV_REST_API_URL = cleanEnv(process.env.KV_REST_API_URL);
  if (process.env.KV_REST_API_TOKEN) process.env.KV_REST_API_TOKEN = cleanEnv(process.env.KV_REST_API_TOKEN);
  if (process.env.KV_REST_API_READ_ONLY_TOKEN) process.env.KV_REST_API_READ_ONLY_TOKEN = cleanEnv(process.env.KV_REST_API_READ_ONLY_TOKEN);
  if (process.env.KV_REST_API_TOKEN) process.env.KV_REST_API_READ_ONLY_TOKEN = process.env.KV_REST_API_TOKEN;
  // Only enable if env hints are present
  if (process.env.KV_REST_API_URL || process.env.VERCEL) {
    // eslint-disable-next-line global-require
    kv = require('@vercel/kv').kv;
    useKV = !!kv;
  }
} catch {}

// Fallback: detect Upstash Redis REST envs and create a minimal kv shim
try {
  if (!useKV && process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    // eslint-disable-next-line global-require
    const { Redis } = require('@upstash/redis');
    const redis = new Redis({ url: cleanEnv(process.env.UPSTASH_REDIS_REST_URL), token: cleanEnv(process.env.UPSTASH_REDIS_REST_TOKEN) });
    kv = {
      async get(key) { return redis.get(key); },
      async set(key, value) { return redis.set(key, value); },
      async del(key) { return redis.del(key); },
      async sadd(key, member) { return redis.sadd(key, member); },
      async srem(key, member) { return redis.srem(key, member); },
      async smembers(key) { return redis.smembers(key); },
    };
    useKV = true;
  }
} catch {}

let fileStore = null;
if (!useKV) {
  // eslint-disable-next-line global-require
  fileStore = require(path.join('..', 'server', 'sessionStore'));
}

// Log storage backend on module load
console.log('[store] Storage backend initialized:', {
  useKV,
  hasKV: !!kv,
  hasFileStore: !!fileStore,
  vercel: !!process.env.VERCEL,
  kvUrl: process.env.KV_REST_API_URL ? 'set' : 'not set',
  upstashUrl: process.env.UPSTASH_REDIS_REST_URL ? 'set' : 'not set'
});

async function kvGet(key) {
  const val = await kv.get(key);
  if (!val) return null;
  try { return typeof val === 'string' ? JSON.parse(val) : val; } catch (e) {
    console.error('[store] kvGet: Failed to parse value for key', key, e.message);
    return null;
  }
}

async function kvSet(key, obj) {
  const json = JSON.stringify(obj || {});
  await kv.set(key, json);
}

async function kvList(prefix) {
  // Use Redis set for efficient index management
  const idxKey = `${prefix}:index`;
  let list = [];
  try {
    // Try to use smembers for native Redis set operations
    if (kv.smembers) {
      list = await kv.smembers(idxKey);
    } else {
      // Fallback to legacy JSON parsing for older clients
      const ids = await kv.get(idxKey);
      list = Array.isArray(ids) ? ids : JSON.parse(ids || '[]');
    }
  } catch (e) {
    console.error('[store] kvList: Failed to get index', idxKey, e.message);
    list = [];
  }
  const out = [];
  for (const id of list) {
    const s = await kvGet(`${prefix}:${id}`);
    if (s) out.push(s);
  }
  return out;
}

async function kvUpsertIndex(prefix, id) {
  const idxKey = `${prefix}:index`;
  try {
    // Use native Redis SADD for better performance
    if (kv.sadd) {
      await kv.sadd(idxKey, id);
    } else {
      // Fallback to legacy JSON-based index
      let arr = await kv.get(idxKey);
      try {
        arr = Array.isArray(arr) ? arr : JSON.parse(arr || '[]');
      } catch (e) {
        console.error('[store] kvUpsertIndex: Failed to parse index, creating new', idxKey, e.message);
        arr = [];
      }
      const set = new Set(arr);
      set.add(id);
      const next = JSON.stringify(Array.from(set));
      await kv.set(idxKey, next);
    }
  } catch (e) {
    console.error('[store] kvUpsertIndex: Failed to add to index', idxKey, id, e.message);
  }
}

async function createSession(name, extra) {
  if (useKV) {
    const { randomUUID } = require('crypto');
    const id = randomUUID();
    const session = { id, name, asked: [], skipped: [], answers: {}, ...(extra || {}) };
    await kvSet(`session:${id}`, session);
    await kvUpsertIndex('session', id);
    return session;
  }
  return fileStore.createSession(name, extra || {});
}

async function getSession(id) {
  if (useKV) return kvGet(`session:${id}`);
  return fileStore.getSession(id);
}

async function saveSession(session) {
  if (useKV) {
    // Use updateSession to maintain version consistency and avoid race conditions
    return updateSession(session.id, (current) => {
      // Merge the updated fields while preserving version
      return { ...current, ...session };
    });
  }
  return fileStore.saveSession(session);
}

// In-memory locks for KV updates to prevent race conditions
const kvUpdateLocks = new Map();

async function updateSession(id, updater) {
  if (useKV) {
    // Use promise chaining to serialize updates per session (same as fileStore)
    const last = kvUpdateLocks.get(id) || Promise.resolve();
    const next = last.then(async () => {
      const MAX_RETRIES = 3;
      let retries = 0;

      while (retries < MAX_RETRIES) {
        const current = await kvGet(`session:${id}`);
        if (!current) {
          console.error('[store] updateSession: Session not found in KV:', { id });
          return null;
        }

        // Add version to session if not present
        if (typeof current._version !== 'number') {
          current._version = 0;
        }

        const currentVersion = current._version;
        const updated = updater(current);

        // Check if updater returned an error
        if (!updated || (updated.error && !updated.id)) {
          return updated;
        }

        // Increment version for optimistic locking
        updated._version = currentVersion + 1;

        try {
          // Try to save with version check
          // Note: Basic implementation - ideally use Redis WATCH/MULTI/EXEC for true atomicity
          const checkCurrent = await kvGet(`session:${id}`);
          if (checkCurrent && checkCurrent._version !== currentVersion) {
            // Version mismatch - someone else updated, retry
            console.warn('[store] updateSession: Version conflict, retrying:', { id, retries, currentVersion, checkVersion: checkCurrent._version });
            retries++;
            continue;
          }

          await kvSet(`session:${id}`, updated);
          return updated;
        } catch (e) {
          console.error('[store] updateSession: Error during save attempt:', { id, retries, error: e.message });
          retries++;
          if (retries >= MAX_RETRIES) throw e;
        }
      }

      const err = new Error('Max retries exceeded for session update');
      console.error('[store] updateSession: Max retries exceeded:', { id });
      throw err;
    }).catch((e) => { throw e; });

    // Cleanup when the chain settles
    kvUpdateLocks.set(id, next.finally(() => {
      if (kvUpdateLocks.get(id) === next) kvUpdateLocks.delete(id);
    }));

    return next;
  }
  return fileStore.updateSession(id, updater);
}

async function listSessions() {
  if (useKV) return kvList('session');
  if (fileStore.listSessions) return fileStore.listSessions();
  return [];
}

async function kvRemoveFromIndex(prefix, id) {
  const idxKey = `${prefix}:index`;
  try {
    // Use native Redis SREM for better performance
    if (kv.srem) {
      await kv.srem(idxKey, id);
    } else {
      // Fallback to legacy JSON-based index
      let arr = await kv.get(idxKey);
      try {
        arr = Array.isArray(arr) ? arr : JSON.parse(arr || '[]');
      } catch (e) {
        console.error('[store] kvRemoveFromIndex: Failed to parse index', idxKey, e.message);
        return;
      }
      const filtered = arr.filter(item => item !== id);
      const next = JSON.stringify(filtered);
      await kv.set(idxKey, next);
    }
  } catch (e) {
    console.error('[store] kvRemoveFromIndex: Failed to remove from index', idxKey, id, e.message);
  }
}

async function deleteSession(id) {
  if (useKV) {
    await kv.del(`session:${id}`);
    await kvRemoveFromIndex('session', id);
    return true;
  }
  if (fileStore.deleteSession) return fileStore.deleteSession(id);
  return false;
}

module.exports = { createSession, getSession, saveSession, updateSession, listSessions, deleteSession };

