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
    if (!toUid || !fromUid) throw new Error('Log in to invite pilots.');
    try {
      await raceTimeout(
        addDoc(collection(db, 'invites', toUid, 'items'), {
          fromUid,
          fromName: String(fromName).slice(0, 20),
          roomCode: String(roomCode).toUpperCase(),
          mode: mode === 'versus' ? 'versus' : 'arcade',
          ts: Date.now(),
        }),
      );
    } catch (e) {
      if (e?.message === 'timeout') throw dbUnreachableError();
      if (e?.code === 'permission-denied') {
        throw new Error('Not allowed — publish the latest firestore.rules (Firebase Console → Firestore → Rules).');
      }
      throw e;
    }
  }

  return { online, goOnline, goOffline, subscribe, sendInvite };
}

/** Response to a room invite (accepted / declined), sent back to the inviter. */
export async function sendInviteReply(toUid, { roomCode, mode, fromUid, fromName, accepted }) {
  if (!toUid || !fromUid) return;
  await raceTimeout(
    addDoc(collection(db, 'inviteReplies', toUid, 'items'), {
      roomCode: String(roomCode ?? '').toUpperCase(),
      mode: mode === 'versus' ? 'versus' : 'arcade',
      fromUid,
      fromName: String(fromName || 'Pilot').slice(0, 20),
      accepted: !!accepted,
      ts: Date.now(),
    }),
  ).catch((e) => {
    if (e?.message === 'timeout') throw dbUnreachableError();
    throw e;
  });
}

/** Incoming invite replies for one user (auto-cleared after reading). */
export function useInviteReplies() {
  const replies = ref([]);
  let unsub = null;

  function watchUid(uid) {
    if (unsub) unsub();
    unsub = null;
    replies.value = [];
    if (!uid) return;
    const q = query(
      collection(db, 'inviteReplies', uid, 'items'),
      orderBy('ts', 'desc'),
      limit(20),
    );
    unsub = onSnapshot(
      q,
      (snap) => {
        const list = [];
        snap.forEach((d) => {
          const v = d.data() ?? {};
          if (v.fromUid) list.push({ id: d.id, ...v });
        });
        replies.value = list;
      },
      () => {
        replies.value = [];
      },
    );
  }

  async function dismiss(uid, id) {
    await deleteDoc(doc(db, 'inviteReplies', uid, 'items', id)).catch(() => {});
  }

  return { replies, watchUid, dismiss };
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
