import { ref } from 'vue';

// Unchanged from the original build so previously saved scores survive.
const STORAGE_KEY = 'neonStrike_leaderboard';
const MAX_ENTRIES = 10;

const entries = ref(read());

function read() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function useLeaderboard() {
  function save(name, score, wave) {
    const next = [
      ...entries.value,
      {
        name: String(name || 'Anonymous').slice(0, 20),
        score,
        wave,
        date: new Date().toLocaleDateString(),
      },
    ]
      .sort((a, b) => b.score - a.score)
      .slice(0, MAX_ENTRIES);

    entries.value = next;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Storage unavailable (private mode / quota) — keep the in-memory list.
    }
  }

  function clear() {
    entries.value = [];
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  }

  return { entries, save, clear };
}
