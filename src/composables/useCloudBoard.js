import { ref } from 'vue';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  setDoc,
  where,
} from 'firebase/firestore';
import { db } from '../game/firebase.js';
import { dbUnreachableError, raceTimeout } from './useRoom.js';

const MAX_GLOBAL = 10;

function sanitize(row) {
  if (!row || typeof row !== 'object') return null;
  return {
    uid: typeof row.uid === 'string' && row.uid ? row.uid : null,
    name: String(row.name ?? 'Anonymous').replace(/[<>]/g, '').slice(0, 20) || 'Anonymous',
    score: Math.max(0, Math.floor(Number(row.score) || 0)),
    wave: Math.max(1, Math.floor(Number(row.wave) || 1)),
    kills: Math.max(0, Math.floor(Number(row.kills) || 0)),
    timeSec: Math.max(0, Math.floor(Number(row.timeSec) || 0)),
    ts: Number(row.ts) || 0,
  };
}

function dedupeBest(rows) {
  // Collapse legacy stacked docs: one row per account (uid, fallback: name).
  const map = new Map();
  for (const row of rows) {
    if (!row) continue;
    const key = row.uid ? `uid:${row.uid}` : `name:${row.name.trim().toLowerCase()}`;
    const prev = map.get(key);
    if (!prev || row.score > prev.score) map.set(key, row);
  }
  return [...map.values()].sort((a, b) => b.score - a.score).slice(0, MAX_GLOBAL);
}

export function useCloudBoard() {
  const global = ref([]);
  const loading = ref(false);
  const error = ref(null);

  async function submitScore({ uid, name, score, wave, stats = {} }) {
    if (!uid) throw dbUnreachableError();
    const cleanName = String(name || 'Anonymous').replace(/[<>]/g, '').slice(0, 20) || 'Anonymous';
    const clean = {
      uid,
      name: cleanName,
      score: Math.max(0, Math.floor(Number(score) || 0)),
      wave: Math.max(1, Math.floor(Number(wave) || 1)),
      kills: Math.max(0, Math.floor(Number(stats.kills) || 0)),
      timeSec: Math.max(0, Math.floor(Number(stats.timeSec) || 0)),
      ts: Date.now(),
    };
    // One doc per account (doc id = uid) so scores update instead of stacking.
    const ref = doc(db, 'scores', uid);
    let prev = null;
    try {
      const snap = await raceTimeout(getDoc(ref));
      if (snap?.exists()) prev = sanitize(snap.data());
    } catch {
      prev = null;
    }
    if (prev && clean.score <= prev.score) {
      // Keep the best score, but sync a renamed callsign.
      if (prev.name !== clean.name) {
        await raceTimeout(setDoc(ref, { name: clean.name }, { merge: true })).catch(() => {
          throw dbUnreachableError();
        });
      }
      return { updated: false, best: prev.score };
    }
    await raceTimeout(setDoc(ref, clean, { merge: true })).catch(() => {
      throw dbUnreachableError();
    });
    return { updated: true, best: clean.score };
  }

  async function loadGlobal() {
    loading.value = true;
    error.value = null;
    try {
      // Fetch extra rows so legacy stacked docs can be collapsed per account.
      const q = query(collection(db, 'scores'), orderBy('score', 'desc'), limit(MAX_GLOBAL * 5));
      const snap = await raceTimeout(getDocs(q));
      const rows = [];
      snap.forEach((d) => {
        const clean = sanitize(d.data());
        if (clean) rows.push(clean);
      });
      global.value = dedupeBest(rows);
    } catch (e) {
      error.value = e?.message ?? 'Could not load global board.';
      global.value = [];
    } finally {
      loading.value = false;
    }
    return global.value;
  }

  async function personalBest(uid) {
    if (!uid) return 0;
    try {
      // Fast path: one doc per account.
      const snap = await raceTimeout(getDoc(doc(db, 'scores', uid)));
      if (snap?.exists()) return Math.max(0, Number(snap.data()?.score) || 0);
    } catch {
      // fall through to legacy query
    }
    try {
      // Legacy fallback: stacked docs with random ids but matching uid field.
      // No orderBy here on purpose: where + orderBy needs a composite index.
      const q = query(collection(db, 'scores'), where('uid', '==', uid), limit(50));
      const snap = await raceTimeout(getDocs(q));
      let best = 0;
      snap.forEach((d) => {
        best = Math.max(best, Number(d.data()?.score) || 0);
      });
      return best;
    } catch {
      return 0;
    }
  }

  return { global, loading, error, submitScore, loadGlobal, personalBest };
}
