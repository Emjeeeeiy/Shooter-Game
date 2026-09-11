import { computed, ref } from 'vue';

const STORAGE_KEY = 'neonStrike_leaderboard_v2';
const LEGACY_KEY = 'neonStrike_leaderboard';
const MAX_ENTRIES = 10;

function sanitize(entry) {
  if (!entry || typeof entry !== 'object') return null;
  const score = Math.max(0, Math.min(99999999, Math.floor(Number(entry.score) || 0)));
  const wave = Math.max(1, Math.min(999, Math.floor(Number(entry.wave) || 1)));
  const name = String(entry.name ?? 'Anonymous').replace(/[<>]/g, '').slice(0, 20) || 'Anonymous';
  const kills = Math.max(0, Math.floor(Number(entry.kills) || 0));
  const timeSec = Math.max(0, Math.floor(Number(entry.timeSec) || 0));
  const date = typeof entry.date === 'string' ? entry.date.slice(0, 24) : new Date().toLocaleDateString();
  const iso = typeof entry.iso === 'string' ? entry.iso : new Date().toISOString();
  const uid = typeof entry.uid === 'string' && entry.uid ? entry.uid.slice(0, 128) : null;
  return uid ? { uid, name, score, wave, kills, timeSec, date, iso } : { name, score, wave, kills, timeSec, date, iso };
}

function keyOf(entry) {
  if (entry.uid) return `uid:${entry.uid}`;
  return `name:${String(entry.name ?? '').trim().toLowerCase()}`;
}

function dedupeBest(list) {
  // One row per account: keep only the best score per uid (fallback: name).
  const map = new Map();
  for (const entry of list) {
    if (!entry) continue;
    const key = keyOf(entry);
    const prev = map.get(key);
    if (!prev || entry.score > prev.score) map.set(key, entry);
  }
  return [...map.values()].sort((a, b) => b.score - a.score).slice(0, MAX_ENTRIES);
}

function read() {
  // Migrate legacy scores once.
  try {
    const current = localStorage.getItem(STORAGE_KEY);
    if (current) {
      const parsed = JSON.parse(current);
      if (Array.isArray(parsed)) {
        const cleaned = parsed.map(sanitize).filter(Boolean);
        const deduped = dedupeBest(cleaned);
        // Persist the deduped form so old stacked rows disappear.
        if (deduped.length !== cleaned.length) {
          try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(deduped));
          } catch {
            // ignore
          }
        }
        return deduped;
      }
    }
    const legacy = localStorage.getItem(LEGACY_KEY);
    if (legacy) {
      const parsed = JSON.parse(legacy);
      if (Array.isArray(parsed)) {
        const migrated = dedupeBest(parsed.map(sanitize).filter(Boolean));
        localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
        return migrated;
      }
    }
  } catch {
    // corrupted storage -> start fresh
  }
  return [];
}

const entries = ref(read());
const best = computed(() => (entries.value.length ? entries.value[0] : null));

export function useLeaderboard() {
  function save(name, score, wave, stats = {}, uid = null) {
    const entry = sanitize({
      uid: typeof uid === 'string' && uid ? uid : null,
      name,
      score,
      wave,
      kills: stats.kills,
      timeSec: stats.timeSec,
      date: new Date().toLocaleDateString(),
      iso: new Date().toISOString(),
    });
    if (!entry) return null;
    // Upsert per account so the board never stacks up: one row per uid
    // (fallback: case-insensitive pilot name). Only a better score replaces.
    const next = [...entries.value, entry];
    const merged = dedupeBest(next.map(sanitize).filter(Boolean));
    // If this run didn't beat the stored best, keep the stored row as-is.
    const stored = merged.find((e) => keyOf(e) === keyOf(entry));
    entries.value = merged;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
    } catch {
      // Storage unavailable — keep in-memory list.
    }
    return stored ?? entry;
  }

  function clear() {
    entries.value = [];
    try {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(LEGACY_KEY);
    } catch {
      // ignore
    }
  }

  function isBest(score, name = null, uid = null) {
    const s = Number(score) || 0;
    if (s <= 0) return false;
    // Per-account check: beat your own stored best?
    if (name != null || uid != null) {
      const probe = sanitize({ name: name ?? 'Anonymous', uid, score: 0, wave: 1 });
      const own = entries.value.find((e) => probe && keyOf(e) === keyOf(probe));
      if (!own) return true; // first ever run for this account
      return s > own.score;
    }
    if (!entries.value.length) return s > 0;
    return s > (entries.value[0]?.score ?? 0);
  }

  function exportJson() {
    return JSON.stringify(entries.value, null, 2);
  }

  return { entries, best, save, clear, isBest, exportJson };
}
