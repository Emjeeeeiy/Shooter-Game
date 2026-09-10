import { onBeforeUnmount, ref, watch } from 'vue';
import {
  get,
  off,
  onDisconnect,
  onValue,
  ref as dbRef,
  remove,
  set,
  update,
} from 'firebase/database';
import { db, databaseURL } from '../game/firebase.js';

const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

export function genCode() {
  let code = '';
  for (let i = 0; i < 6; i += 1) code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  return code;
}

function roomPath(code) {
  return `rooms/${String(code).toUpperCase()}`;
}

const DB_TIMEOUT_MS = 10000;

function timeout(ms) {
  return new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms));
}

export function raceTimeout(promise, ms = DB_TIMEOUT_MS) {
  return Promise.race([promise, timeout(ms)]);
}

export function dbUnreachableError() {
  return new Error(
    'Cannot reach the Realtime Database. In Firebase Console: 1) create the database, ' +
      '2) publish database.rules.json. ' +
      `The app is trying: ${databaseURL}`,
  );
}

/** Fail fast with a helpful error instead of hanging forever. */
export async function ensureOnline() {
  try {
    const snap = await raceTimeout(get(dbRef(db, '.info/connected')));
    if (snap.val() === true) return;
  } catch {
    // fall through to unreachable error
  }
  throw dbUnreachableError();
}

/** Capped fire-and-forget so presence cleanup never blocks the UI. */
function bestEffort(promise) {
  return raceTimeout(promise, 5000).catch(() => {});
}

function cleanRoom(raw) {
  if (!raw || typeof raw !== 'object') return null;
  return {
    code: String(raw.code ?? ''),
    host: raw.host ?? null,
    status: raw.status ?? 'lobby',
    mode: raw.mode === 'versus' ? 'versus' : 'arcade',
    seed: Number(raw.seed) || null,
    createdAt: Number(raw.createdAt) || 0,
    members: raw.members && typeof raw.members === 'object' ? raw.members : {},
    live: raw.live && typeof raw.live === 'object' ? raw.live : {},
  };
}

export async function createRoom(uid, name, ship, mode = 'arcade') {
  await ensureOnline();
  const code = genCode();
  const path = roomPath(code);
  const exists = await raceTimeout(get(dbRef(db, path))).catch(() => {
    throw dbUnreachableError();
  });
  if (exists.exists()) return createRoom(uid, name, ship, mode); // collision — retry
  const member = { name: name.slice(0, 20), ready: false, ship, joinedAt: Date.now() };
  await raceTimeout(
    update(dbRef(db, path), {
      code,
      host: uid,
      status: 'lobby',
      mode: mode === 'versus' ? 'versus' : 'arcade',
      createdAt: Date.now(),
      [`members/${uid}`]: member,
    }),
  ).catch(() => {
    throw dbUnreachableError();
  });
  await bestEffort(onDisconnect(dbRef(db, `${path}/members/${uid}`)).remove());
  return code;
}

export async function joinRoom(code, uid, name, ship) {
  await ensureOnline();
  const path = roomPath(code);
  const snap = await raceTimeout(get(dbRef(db, path))).catch(() => {
    throw dbUnreachableError();
  });
  if (!snap.exists()) throw new Error('Room not found. Check the code.');
  const room = cleanRoom(snap.val());
  const isMember = !!room.members[uid];
  if (room.status !== 'lobby' && !isMember) throw new Error('That match already started.');
  if (!isMember) {
    await update(dbRef(db, path), {
      [`members/${uid}`]: { name: name.slice(0, 20), ready: false, ship, joinedAt: Date.now() },
    });
    await bestEffort(onDisconnect(dbRef(db, `${path}/members/${uid}`)).remove());
  } else {
    await update(dbRef(db, path), { [`members/${uid}/ship`]: ship });
  }
  return room.code;
}

export async function leaveRoom(code, uid) {
  const path = roomPath(code);
  await remove(dbRef(db, `${path}/members/${uid}`));
  await remove(dbRef(db, `${path}/live/${uid}`));
  await bestEffort(onDisconnect(dbRef(db, `${path}/members/${uid}`)).cancel());
  const snap = await get(dbRef(db, path));
  if (!snap.exists()) return;
  const room = cleanRoom(snap.val());
  const ids = Object.keys(room.members);
  if (ids.length === 0) {
    await remove(dbRef(db, path));
    return;
  }
  if (room.host === uid || !room.members[room.host]) {
    await update(dbRef(db, path), { host: ids[0] });
  }
}

export async function toggleReady(code, uid, ready) {
  await update(dbRef(db, roomPath(code)), { [`members/${uid}/ready`]: !!ready });
}

export async function setRoomShip(code, uid, ship) {
  await update(dbRef(db, roomPath(code)), { [`members/${uid}/ship`]: ship });
}

export async function startMatch(code) {
  // Reset live board, keep members. Ready flags clear for the next round.
  // A shared seed gives every pilot the identical battlefield.
  const snap = await get(dbRef(db, `${roomPath(code)}/members`));
  const members = snap.exists() ? snap.val() : {};
  const reset = {
    status: 'playing',
    seed: Math.floor(Math.random() * 2147483646) + 1,
  };
  for (const id of Object.keys(members)) {
    reset[`live/${id}`] = {
      name: members[id]?.name ?? 'Pilot',
      score: 0,
      wave: 1,
      done: false,
    };
    reset[`members/${id}/ready`] = false;
  }
  await update(dbRef(db, roomPath(code)), reset);
}

export async function setRoomMode(code, mode) {
  await update(dbRef(db, roomPath(code)), {
    mode: mode === 'versus' ? 'versus' : 'arcade',
  });
}

export async function getRoom(code) {
  const snap = await get(dbRef(db, roomPath(code)));
  return snap.exists() ? cleanRoom(snap.val()) : null;
}

/** Increment a per-player live counter (versus `incoming`, arcade `gift`). */
export async function bumpCounter(code, uid, field) {
  const target = dbRef(db, `${roomPath(code)}/live/${uid}/${field}`);
  const snap = await get(target);
  await set(target, (Number(snap.val()) || 0) + 1);
}

export async function showResults(code) {
  await update(dbRef(db, roomPath(code)), { status: 'done' });
}

export async function backToRoomLobby(code) {
  await update(dbRef(db, roomPath(code)), { status: 'lobby', live: null });
}

export async function updateLiveScore(code, uid, { score, wave, name }) {
  await update(dbRef(db, `${roomPath(code)}/live/${uid}`), {
    score: Math.floor(Number(score) || 0),
    wave: Math.floor(Number(wave) || 1),
    ...(name ? { name: String(name).slice(0, 20) } : {}),
  });
}

export async function submitFinal(code, uid, { score, wave, name }) {
  await update(dbRef(db, `${roomPath(code)}/live/${uid}`), {
    score: Math.floor(Number(score) || 0),
    wave: Math.floor(Number(wave) || 1),
    done: true,
    finalScore: Math.floor(Number(score) || 0),
    finalWave: Math.floor(Number(wave) || 1),
    ...(name ? { name: String(name).slice(0, 20) } : {}),
  });
}

/**
 * Reactive room subscription. Accepts a ref or getter for the room code and
 * resubscribes whenever it changes (empty code = no subscription).
 */
export function useRoom(codeSource) {
  const room = ref(null);
  const missing = ref(false);
  let target = null;
  let handler = null;

  const stop = () => {
    if (target && handler) off(target, 'value', handler);
    target = null;
    handler = null;
  };

  const sub = (code) => {
    stop();
    room.value = null;
    missing.value = false;
    if (!code) return;
    target = dbRef(db, roomPath(code));
    handler = (snap) => {
      if (!snap.exists()) {
        room.value = null;
        missing.value = true;
        return;
      }
      missing.value = false;
      room.value = cleanRoom(snap.val());
    };
    onValue(target, handler);
  };

  watch(codeSource, sub, { immediate: true });
  onBeforeUnmount(stop);

  return { room, missing };
}
