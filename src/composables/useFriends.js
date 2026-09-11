import { ref } from 'vue';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  setDoc,
} from 'firebase/firestore';
import { db } from '../game/firebase.js';
import { dbUnreachableError, raceTimeout } from './useRoom.js';

function cleanUser(id, data) {
  if (!data || typeof data !== 'object') return null;
  const name = String(data.name ?? 'Pilot').replace(/[<>]/g, '').slice(0, 20) || 'Pilot';
  return {
    uid: id,
    name,
    photo: typeof data.photo === 'string' ? data.photo : '',
    bestScore: Math.max(0, Math.floor(Number(data.bestScore) || 0)),
    gamesPlayed: Math.max(0, Math.floor(Number(data.gamesPlayed) || 0)),
  };
}

/** Search pilots by callsign substring (case-insensitive). */
export async function searchPilots(term, excludeUid = null) {
  const needle = String(term ?? '').trim().toLowerCase();
  if (needle.length < 2) return [];
  const q = query(collection(db, 'users'), orderBy('name'), limit(30));
  let snap;
  try {
    snap = await raceTimeout(getDocs(q));
  } catch (e) {
    if (e?.message === 'timeout') throw dbUnreachableError();
    throw e;
  }
  const out = [];
  snap.forEach((d) => {
    if (excludeUid && d.id === excludeUid) return;
    const u = cleanUser(d.id, d.data());
    if (!u) return;
    if (u.name.toLowerCase().includes(needle)) out.push(u);
  });
  return out.slice(0, 10);
}

async function assertNotFriends(myUid, otherUid) {
  const snap = await raceTimeout(getDoc(doc(db, 'friends', myUid, 'list', otherUid))).catch(
    () => null,
  );
  if (snap?.exists()) throw new Error('Already friends.');
}

/** Outgoing-request cache (uid -> request doc id), shared by every screen. */
export function loadSentMap(uid) {
  try {
    const raw = uid ? localStorage.getItem(`neonStrike_sentReq_${uid}`) : null;
    return raw ? (JSON.parse(raw) ?? {}) : {};
  } catch {
    return {};
  }
}

export function storeSentMap(uid, map) {
  try {
    if (uid) localStorage.setItem(`neonStrike_sentReq_${uid}`, JSON.stringify(map ?? {}));
  } catch {
    // ignore (private mode)
  }
}

export function friendlyFriendError(e) {  const code = e?.code ?? '';
  if (code === 'permission-denied') {
    return 'Not allowed — publish the latest firestore.rules (Firebase Console → Firestore → Rules).';
  }
  if (code === 'unavailable' || code === 'failed-precondition' || code === 'deadline-exceeded') {
    return 'Network error — check your connection and retry.';
  }
  return e?.message ?? 'Something went wrong.';
}

/** Send a friend request to another pilot. Resolves with the request id. */
export async function sendFriendRequest(toUid, { fromUid, fromName, fromPhoto = '' }) {
  if (!fromUid) throw new Error('Log in to add friends.');
  if (!toUid || toUid === fromUid) throw new Error('You cannot add yourself.');
  await assertNotFriends(fromUid, toUid);
  let ref;
  try {
    ref = await raceTimeout(
      addDoc(collection(db, 'friendRequests', toUid, 'items'), {
        fromUid,
        fromName: String(fromName || 'Pilot').slice(0, 20),
        fromPhoto: String(fromPhoto || '').slice(0, 450 * 1024),
        ts: Date.now(),
      }),
    );
  } catch (e) {
    if (e?.message === 'timeout') throw dbUnreachableError();
    throw e;
  }
  return { id: ref.id };
}

/** Withdraw an outgoing request (rules let the sender delete their own). */
export async function cancelFriendRequest(toUid, reqId) {
  if (!toUid || !reqId) return;
  try {
    await raceTimeout(deleteDoc(doc(db, 'friendRequests', toUid, 'items', reqId)));
  } catch (e) {
    if (e?.message === 'timeout') throw dbUnreachableError();
    throw e;
  }
}

/** Incoming friend requests for one user. */
export function useFriendRequests() {
  const requests = ref([]);
  let unsub = null;

  function watchUid(uid) {
    if (unsub) unsub();
    unsub = null;
    requests.value = [];
    if (!uid) return;
    const q = query(collection(db, 'friendRequests', uid, 'items'), orderBy('ts', 'desc'), limit(20));
    unsub = onSnapshot(
      q,
      (snap) => {
        const list = [];
        snap.forEach((d) => {
          const v = d.data() ?? {};
          if (v.fromUid) list.push({ id: d.id, ...v });
        });
        requests.value = list;
      },
      () => {
        requests.value = [];
      },
    );
  }

  async function decline(uid, id) {
    await deleteDoc(doc(db, 'friendRequests', uid, 'items', id));
  }

  async function accept(uid, req) {
    // Fetch the other pilot's current profile for a correct friend entry.
    let other = null;
    try {
      const snap = await raceTimeout(getDoc(doc(db, 'users', req.fromUid)));
      if (snap?.exists()) other = cleanUser(req.fromUid, snap.data());
    } catch {
      other = null;
    }
    const otherName = String(other?.name ?? req.fromName ?? 'Pilot').slice(0, 20);
    const otherPhoto = String(other?.photo ?? req.fromPhoto ?? '');
    let mine = { name: 'Pilot', photo: '' };
    try {
      const snap = await raceTimeout(getDoc(doc(db, 'users', uid)));
      if (snap?.exists()) {
        mine = {
          name: String(snap.data()?.name ?? 'Pilot').slice(0, 20),
          photo: String(snap.data()?.photo ?? ''),
        };
      }
    } catch {
      // keep defaults
    }
    const now = Date.now();
    await raceTimeout(
      setDoc(doc(db, 'friends', uid, 'list', req.fromUid), {
        uid: req.fromUid,
        name: otherName,
        photo: otherPhoto.slice(0, 450 * 1024),
        addedAt: now,
      }),
    ).catch((e) => {
      if (e?.message === 'timeout') throw dbUnreachableError();
      throw e;
    });
    await raceTimeout(
      setDoc(doc(db, 'friends', req.fromUid, 'list', uid), {
        uid,
        name: mine.name,
        photo: mine.photo.slice(0, 450 * 1024),
        addedAt: now,
      }),
    ).catch(() => {
      // My side is saved; the mirror write can be retried by re-accepting.
    });
    await deleteDoc(doc(db, 'friendRequests', uid, 'items', req.id));
  }

  return { requests, watchUid, decline, accept };
}

/** Live friend list for one user. */
export function useFriendList() {
  const friends = ref([]);
  let unsub = null;

  function watchUid(uid) {
    if (unsub) unsub();
    unsub = null;
    friends.value = [];
    if (!uid) return;
    const q = query(collection(db, 'friends', uid, 'list'), orderBy('addedAt', 'desc'), limit(100));
    unsub = onSnapshot(
      q,
      (snap) => {
        const list = [];
        snap.forEach((d) => {
          const v = d.data() ?? {};
          list.push({
            uid: d.id,
            name: String(v.name ?? 'Pilot').slice(0, 20),
            photo: typeof v.photo === 'string' ? v.photo : '',
            addedAt: Number(v.addedAt) || 0,
          });
        });
        friends.value = list;
      },
      () => {
        friends.value = [];
      },
    );
  }

  async function remove(uid, friendUid) {
    await deleteDoc(doc(db, 'friends', uid, 'list', friendUid)).catch(() => {});
    await deleteDoc(doc(db, 'friends', friendUid, 'list', uid)).catch(() => {});
  }

  return { friends, watchUid, remove };
}
