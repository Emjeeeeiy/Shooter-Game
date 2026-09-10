import { ref } from 'vue';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  setDoc,
} from 'firebase/firestore';
import { db } from '../game/firebase.js';
import { dbUnreachableError, raceTimeout } from './useRoom.js';

const STALE_MS = 90000;
const HEARTBEAT_MS = 30000;

/**
 * Online pilots + room invites over Firestore.
 * Note: Firestore has no onDisconnect hook, so presence is a heartbeat with
 * client-side staleness filtering — abrupt disconnects linger up to ~90s.
 */
export function usePresence() {
  const online = ref([]);
  let stopBeat = null;

  function goOnline(uid, name) {
    if (!uid) return;
    if (stopBeat) clearInterval(stopBeat);
    const mark = () =>
      setDoc(doc(db, 'status', uid), {
        name: String(name).slice(0, 20),
        lastSeen: Date.now(),
      }).catch(() => {});
    mark();
    stopBeat = setInterval(mark, HEARTBEAT_MS);
  }

  function goOffline(uid) {
    if (stopBeat) {
      clearInterval(stopBeat);
      stopBeat = null;
    }
    if (uid) deleteDoc(doc(db, 'status', uid)).catch(() => {});
  }

  function subscribe() {
    const unsub = onSnapshot(
      query(collection(db, 'status')),
      (snap) => {
        const now = Date.now();
        const list = [];
        snap.forEach((d) => {
          const v = d.data() ?? {};
          if (now - (Number(v.lastSeen) || 0) < STALE_MS) {
            list.push({ uid: d.id, name: String(v.name ?? 'Pilot') });
          }
        });
        list.sort((a, b) => a.name.localeCompare(b.name));
        online.value = list;
      },
      () => {
        // Listen errors ignored; writes surface actionable errors.
      },
    );
    return unsub;
  }

  async function sendInvite(toUid, { fromUid, fromName, roomCode, mode }) {
    await raceTimeout(
      addDoc(collection(db, 'invites', toUid, 'items'), {
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
  let unsub = null;

  function watchUid(uid) {
    if (unsub) unsub();
    unsub = null;
    invites.value = [];
    if (!uid) return;
    const q = query(
      collection(db, 'invites', uid, 'items'),
      orderBy('ts', 'desc'),
      limit(3),
    );
    unsub = onSnapshot(
      q,
      (snap) => {
        const list = [];
        snap.forEach((d) => {
          const v = d.data() ?? {};
          if (v.roomCode) list.push({ id: d.id, ...v });
        });
        invites.value = list;
      },
      () => {
        invites.value = [];
      },
    );
  }

  async function dismiss(uid, id) {
    await deleteDoc(doc(db, 'invites', uid, 'items', id));
  }

  return { invites, watchUid, dismiss };
}
