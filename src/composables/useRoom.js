import { onBeforeUnmount, ref, watch } from 'vue';
import {
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  increment,
  onSnapshot,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { db } from '../game/firebase.js';

const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const DB_TIMEOUT_MS = 10000;

export function genCode() {
  let code = '';
  for (let i = 0; i < 6; i += 1) code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  return code;
}

function roomRef(code) {
  return doc(db, 'rooms', String(code).toUpperCase());
}

function timeout(ms) {
  return new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms));
}

export function raceTimeout(promise, ms = DB_TIMEOUT_MS) {
  return Promise.race([promise, timeout(ms)]);
}

export function dbUnreachableError() {
  return new Error(
    'Cannot reach Firestore. In Firebase Console: 1) create a Firestore database (native mode), ' +
      '2) publish firestore.rules from this repo.',
  );
}

/** Rejects with the unreachable error only on timeout; real errors pass through. */
async function timed(promise) {
  try {
    return await raceTimeout(promise);
  } catch (e) {
    if (e?.message === 'timeout') throw dbUnreachableError();
    throw e;
  }
}

function cleanRoom(raw) {
  if (!raw || typeof raw !== 'object') return null;
  return {
    code: String(raw.code ?? ''),
    host: raw.host ?? null,
    status: raw.status ?? 'lobby',
    mode: raw.mode === 'versus' ? 'versus' : 'arcade',
    mapPick: ['grid', 'debris', 'pillars', 'void', 'random'].includes(raw.mapPick)
      ? raw.mapPick
      : 'grid',
    map: ['grid', 'debris', 'pillars', 'void'].includes(raw.map) ? raw.map : 'grid',
    seed: Number(raw.seed) || null,
    createdAt: Number(raw.createdAt) || 0,
    members: raw.members && typeof raw.members === 'object' ? raw.members : {},
    live: raw.live && typeof raw.live === 'object' ? raw.live : {},
  };
}

export async function createRoom(uid, name, ship, mode = 'arcade') {
  const code = genCode();
  const ref = roomRef(code);
  const exists = await timed(getDoc(ref));
  if (exists.exists()) return createRoom(uid, name, ship, mode); // collision — retry
  await timed(
    setDoc(ref, {
      code,
      host: uid,
      status: 'lobby',
      mode: mode === 'versus' ? 'versus' : 'arcade',
      mapPick: 'grid',
      map: 'grid',
      createdAt: Date.now(),
      members: {
        [uid]: { name: name.slice(0, 20), ready: false, ship, joinedAt: Date.now() },
      },
      live: {},
    }),
  );
  return code;
}

export async function joinRoom(code, uid, name, ship) {
  const ref = roomRef(code);
  const snap = await timed(getDoc(ref));
  if (!snap.exists()) throw new Error('Room not found. Check the code.');
  const room = cleanRoom(snap.data());
  const isMember = !!room.members[uid];
  if (room.status !== 'lobby' && !isMember) throw new Error('That match already started.');
  if (!isMember) {
    await timed(
      updateDoc(ref, {
        [`members.${uid}`]: {
          name: name.slice(0, 20),
          ready: false,
          ship,
          joinedAt: Date.now(),
        },
      }),
    );
  } else {
    await timed(updateDoc(ref, { [`members.${uid}.ship`]: ship }));
  }
  return room.code;
}

export async function leaveRoom(code, uid) {
  const ref = roomRef(code);
  await timed(
    updateDoc(ref, {
      [`members.${uid}`]: deleteField(),
      [`live.${uid}`]: deleteField(),
    }),
  );
  const snap = await timed(getDoc(ref));
  if (!snap.exists()) return;
  const room = cleanRoom(snap.data());
  const ids = Object.keys(room.members);
  if (ids.length === 0) {
    await timed(deleteDoc(ref));
    return;
  }
  if (room.host === uid || !room.members[room.host]) {
    await timed(updateDoc(ref, { host: ids[0] }));
  }
}

export async function toggleReady(code, uid, ready) {
  await timed(updateDoc(roomRef(code), { [`members.${uid}.ready`]: !!ready }));
}

export async function setRoomShip(code, uid, ship) {
  await timed(updateDoc(roomRef(code), { [`members.${uid}.ship`]: ship }));
}

const MAP_IDS = ['grid', 'debris', 'pillars', 'void'];

export async function setRoomMode(code, mode) {
  await timed(
    updateDoc(roomRef(code), { mode: mode === 'versus' ? 'versus' : 'arcade' }),
  );
}

export async function getRoom(code) {
  const snap = await timed(getDoc(roomRef(code)));
  return snap.exists() ? cleanRoom(snap.data()) : null;
}

/** Atomic increment — no read needed (versus `incoming`, arcade `gift`). */
export async function bumpCounter(code, uid, field) {
  await updateDoc(roomRef(code), { [`live.${uid}.${field}`]: increment(1) }).catch(() => {});
}

export async function setRoomMap(code, mapPick) {
  const pick = ['grid', 'debris', 'pillars', 'void', 'random'].includes(mapPick) ? mapPick : 'grid';
  await timed(updateDoc(roomRef(code), { mapPick: pick }));
}

export async function startMatch(code) {
  const ref = roomRef(code);
  const snap = await timed(getDoc(ref));
  const data = snap.exists() ? snap.data() : {};
  const members = data.members ?? {};
  let pick = data.mapPick ?? 'grid';
  if (pick === 'random' || !MAP_IDS.includes(pick)) {
    pick = MAP_IDS[Math.floor(Math.random() * MAP_IDS.length)];
  }
  const live = {};
  for (const id of Object.keys(members)) {
    live[id] = { name: members[id]?.name ?? 'Pilot', score: 0, wave: 1, done: false };
  }
  await timed(
    setDoc(
      ref,
      {
        status: 'playing',
        seed: Math.floor(Math.random() * 2147483646) + 1,
        map: pick,
        live,
      },
      { merge: true },
    ),
  );
  const readyReset = {};
  for (const id of Object.keys(members)) readyReset[`members.${id}.ready`] = false;
  if (Object.keys(readyReset).length) await timed(updateDoc(ref, readyReset));
}

export async function showResults(code) {
  await timed(updateDoc(roomRef(code), { status: 'done' }));
}

export async function backToRoomLobby(code) {
  await timed(updateDoc(roomRef(code), { status: 'lobby', live: {} }));
}

export async function updateLiveScore(code, uid, { score, wave, name }) {
  const fields = {
    [`live.${uid}.score`]: Math.floor(Number(score) || 0),
    [`live.${uid}.wave`]: Math.floor(Number(wave) || 1),
  };
  if (name) fields[`live.${uid}.name`] = String(name).slice(0, 20);
  // Best-effort: the caller already throttles + swallows errors.
  await updateDoc(roomRef(code), fields).catch(() => {});
}

export async function submitFinal(code, uid, { score, wave, name }) {
  await timed(
    updateDoc(roomRef(code), {
      [`live.${uid}.score`]: Math.floor(Number(score) || 0),
      [`live.${uid}.wave`]: Math.floor(Number(wave) || 1),
      [`live.${uid}.done`]: true,
      [`live.${uid}.finalScore`]: Math.floor(Number(score) || 0),
      [`live.${uid}.finalWave`]: Math.floor(Number(wave) || 1),
      ...(name ? { [`live.${uid}.name`]: String(name).slice(0, 20) } : {}),
    }),
  );
}

/**
 * Reactive room subscription. Accepts a ref or getter for the room code and
 * resubscribes whenever it changes (empty code = no subscription).
 */
export function useRoom(codeSource) {
  const room = ref(null);
  const missing = ref(false);
  let unsub = null;

  const stop = () => {
    if (unsub) unsub();
    unsub = null;
  };

  const sub = (code) => {
    stop();
    room.value = null;
    missing.value = false;
    if (!code) return;
    unsub = onSnapshot(
      roomRef(code),
      (snap) => {
        if (!snap.exists()) {
          room.value = null;
          missing.value = true;
          return;
        }
        missing.value = false;
        room.value = cleanRoom(snap.data());
      },
      () => {
        // Listen errors ignored here; writes surface actionable errors.
      },
    );
  };

  watch(codeSource, sub, { immediate: true });
  onBeforeUnmount(stop);

  return { room, missing };
}
