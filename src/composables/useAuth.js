import { ref } from 'vue';
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut as fbSignOut,
  updateProfile,
} from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { auth, db } from '../game/firebase.js';

const user = ref(null);
const authReady = ref(false);
// True when the player chose "Continue offline" (no Firebase usage at all).
const offline = ref(false);

let listening = false;

function ensureListener() {
  if (listening) return;
  listening = true;
  onAuthStateChanged(auth, (u) => {
    user.value = u;
    authReady.value = true;
  });
}

const CODE_MESSAGES = {
  'auth/email-already-in-use': 'That email is already registered. Try logging in.',
  'auth/invalid-email': 'That email address looks invalid.',
  'auth/operation-not-allowed': 'Email login is disabled — enable it in Firebase Console → Authentication.',
  'auth/weak-password': 'Password must be at least 6 characters.',
  'auth/user-not-found': 'No account for that email. Register first.',
  'auth/wrong-password': 'Wrong password.',
  'auth/invalid-credential': 'Wrong email or password.',
  'auth/too-many-requests': 'Too many attempts — wait a bit and retry.',
  'auth/network-request-failed': 'Network error — check your connection.',
};

function friendlyError(err) {
  return CODE_MESSAGES[err?.code] ?? err?.message ?? 'Something went wrong.';
}

export function useAuth() {
  ensureListener();

  async function register(email, password, pilotName) {
    const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
    const name = (pilotName || 'Pilot').slice(0, 20);
    try {
      await updateProfile(cred.user, { displayName: name });
      await setDoc(doc(db, 'users', cred.user.uid), {
        name,
        email: email.trim(),
        createdAt: Date.now(),
        gamesPlayed: 0,
        bestScore: 0,
      });
    } catch {
      // Profile write failed (offline / rules) — auth still succeeded.
    }
    return cred.user;
  }

  async function login(email, password) {
    const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
    return cred.user;
  }

  async function logout() {
    await fbSignOut(auth);
  }

  async function rename(name) {
    const u = auth.currentUser;
    if (!u) throw new Error('Not logged in.');
    const clean = String(name).trim().slice(0, 20) || 'Pilot';
    await updateProfile(u, { displayName: clean });
    try {
      await setDoc(doc(db, 'users', u.uid), { name: clean }, { merge: true });
    } catch {
      // RTDB write failed — Auth profile still updated.
    }
    return clean;
  }

  function continueOffline() {
    offline.value = true;
    authReady.value = true;
  }

  function backOnline() {
    offline.value = false;
  }

  return { user, authReady, offline, register, login, logout, rename, continueOffline, backOnline, friendlyError };
}
