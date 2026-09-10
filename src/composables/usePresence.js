import { ref } from 'vue';
import { off, onDisconnect, onValue, push, ref as dbRef, remove, set } from 'firebase/database';
import { db } from '../game/firebase.js';
import { dbUnreachableError, raceTimeout } from './useRoom.js';

const STALE_MS = 90000;
const HEARTBEAT_MS = 30000;

/** Online pilots + room invites over RTDB. */
export function usePresence() {
  const online = ref([]);
  let stopBeat = null;

  function goOnline(uid, name) {
    if (!uid) return;
    if (stopBeat) clearInterval(stopBeat);
    const target = dbRef(db, `status/${uid}`);
    const mark = () =>
      set(target, { name: String(name).slice(0, 20), lastSeen: Date.now() }).catch(() => {});
    mark();
    try {
      onDisconnect(target).remove().catch(() => {});
    } catch {
      // unsupported here — stale entries expire client-side via lastSeen
    }
    stopBeat = setInterval(mark, HEARTBEAT_MS);
  }

  function goOffline(uid) {
    if (stopBeat) {
      clearInterval(stopBeat);
      stopBeat = null;
    }
    if (uid) remove(dbRef(db, `status/${uid}`)).catch(() => {});
  }

  function subscribe() {
    const target = dbRef(db, 'status');
    const handler = (snap) => {
      const now = Date.now();
      const list = [];
      snap.forEach((child) => {
        const v = child.val() ?? {};
        if (now - (Number(v.lastSeen) || 0) < STALE_MS) {
          list.push({ uid: child.key, name: String(v.name ?? 'Pilot') });
        }
      });
      list.sort((a, b) => a.name.localeCompare(b.name));
      online.value = list;
    };
    onValue(target, handler);
    return () => off(target, 'value', handler);
  }

  async function sendInvite(toUid, { fromUid, fromName, roomCode, mode }) {
    await raceTimeout(
      push(dbRef(db, `invites/${toUid}`), {
        fromUid,
        fromName: String(fromName).slice(0, 20),
        roomCode: String(roomCode).toUpperCase(),
        mode: mode === 'versus' ? 'versus' : 'arcade',
        ts: Date.now(),
      }),
    ).catch(() => {
      throw dbUnreachableError();
    });
  }

  return { online, goOnline, goOffline, subscribe, sendInvite };
}

/** Incoming room invites for one user. */
export function useInvites() {
  const invites = ref([]);
  let target = null;
  let handler = null;

  function watchUid(uid) {
    if (target && handler) off(target, 'value', handler);
    target = null;
    handler = null;
    invites.value = [];
    if (!uid) return;
    target = dbRef(db, `invites/${uid}`);
    handler = (snap) => {
      const list = [];
      snap.forEach((child) => {
        const v = child.val() ?? {};
        if (v.roomCode) list.push({ id: child.key, ...v });
      });
      list.sort((a, b) => (b.ts || 0) - (a.ts || 0));
      invites.value = list.slice(0, 3);
    };
    onValue(target, handler);
  }

  async function dismiss(uid, id) {
    await remove(dbRef(db, `invites/${uid}/${id}`));
  }

  return { invites, watchUid, dismiss };
}
