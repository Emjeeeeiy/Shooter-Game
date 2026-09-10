import { ref } from 'vue';
import {
  equalTo,
  get,
  limitToLast,
  orderByChild,
  push,
  query,
  ref as dbRef,
} from 'firebase/database';
import { db } from '../game/firebase.js';

const MAX_GLOBAL = 10;

function sanitize(row) {
  if (!row || typeof row !== 'object') return null;
  return {
    name: String(row.name ?? 'Anonymous').replace(/[<>]/g, '').slice(0, 20) || 'Anonymous',
    score: Math.max(0, Math.floor(Number(row.score) || 0)),
    wave: Math.max(1, Math.floor(Number(row.wave) || 1)),
    kills: Math.max(0, Math.floor(Number(row.kills) || 0)),
    timeSec: Math.max(0, Math.floor(Number(row.timeSec) || 0)),
    ts: Number(row.ts) || 0,
  };
}

export function useCloudBoard() {
  const global = ref([]);
  const loading = ref(false);
  const error = ref(null);

  async function submitScore({ uid, name, score, wave, stats = {} }) {
    await push(dbRef(db, 'scores'), {
      uid: uid ?? null,
      name: String(name || 'Anonymous').slice(0, 20),
      score: Math.floor(Number(score) || 0),
      wave: Math.floor(Number(wave) || 1),
      kills: Math.floor(Number(stats.kills) || 0),
      timeSec: Math.floor(Number(stats.timeSec) || 0),
      ts: Date.now(),
    });
  }

  async function loadGlobal() {
    loading.value = true;
    error.value = null;
    try {
      const q = query(dbRef(db, 'scores'), orderByChild('score'), limitToLast(MAX_GLOBAL));
      const snap = await get(q);
      const rows = [];
      snap.forEach((child) => {
        const clean = sanitize(child.val());
        if (clean) rows.push(clean);
      });
      rows.sort((a, b) => b.score - a.score);
      global.value = rows;
    } catch (e) {
      error.value = e?.message ?? 'Could not load global board.';
      global.value = [];
    } finally {
      loading.value = false;
    }
    return global.value;
  }

  async function personalBest(uid) {
    try {
      const q = query(dbRef(db, 'scores'), orderByChild('uid'), equalTo(uid), limitToLast(50));
      const snap = await get(q);
      let best = 0;
      snap.forEach((child) => {
        best = Math.max(best, Number(child.val()?.score) || 0);
      });
      return best;
    } catch {
      return 0;
    }
  }

  return { global, loading, error, submitScore, loadGlobal, personalBest };
}
