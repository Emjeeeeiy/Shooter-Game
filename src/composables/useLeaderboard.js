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
  return { name, score, wave, kills, timeSec, date, iso };
}

function read() {
  // Migrate legacy scores once.
  try {
    const current = localStorage.getItem(STORAGE_KEY);
    if (current) {
      const parsed = JSON.parse(current);
      if (Array.isArray(parsed)) return parsed.map(sanitize).filter(Boolean);
    }
    const legacy = localStorage.getItem(LEGACY_KEY);
    if (legacy) {
      const parsed = JSON.parse(legacy);
      if (Array.isArray(parsed)) {
        const migrated = parsed.map(sanitize).filter(Boolean);
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
  function save(name, score, wave, stats = {}) {
    const entry = sanitize({
      name,
      score,
      wave,
      kills: stats.kills,
      timeSec: stats.timeSec,
      date: new Date().toLocaleDateString(),
      iso: new Date().toISOString(),
    });
    if (!entry) return null;
    const next = [...entries.value, entry].sort((a, b) => b.score - a.score).slice(0, MAX_ENTRIES);
    entries.value = next;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Storage unavailable — keep in-memory list.
    }
    return entry;
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

  function isBest(score) {
    if (!entries.value.length) return Number(score) > 0;
    return Number(score) > (entries.value[0]?.score ?? 0);
  }

  function exportJson() {
    return JSON.stringify(entries.value, null, 2);
  }

  return { entries, best, save, clear, isBest, exportJson };
}
