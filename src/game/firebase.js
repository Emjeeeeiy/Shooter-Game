import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getDatabase } from 'firebase/database';

// Your web app's Firebase configuration.
const firebaseConfig = {
  apiKey: 'AIzaSyCeX4JgYGUT2-MrAxB7cvZrfDM4JzW1BBY',
  authDomain: 'shooter-game-cf98f.firebaseapp.com',
  projectId: 'shooter-game-cf98f',
  storageBucket: 'shooter-game-cf98f.firebasestorage.app',
  messagingSenderId: '160568218030',
  appId: '1:160568218030:web:6a0aaeb5488fe81437383f',
  measurementId: 'G-Z851J25YSG',
};

// Realtime Database instance for this project (asia-southeast1 region).
// If you ever recreate the database in another region, copy the URL shown
// at the top of Firebase Console → Realtime Database → Data.
export const databaseURL =
  'https://shooter-game-cf98f-default-rtdb.asia-southeast1.firebasedatabase.app';

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getDatabase(app, databaseURL);

// Analytics is browser-only and optional — never let it break the game.
export async function initAnalytics() {
  try {
    if (typeof window === 'undefined') return null;
    const { getAnalytics, isSupported } = await import('firebase/analytics');
    if (await isSupported()) return getAnalytics(app);
  } catch {
    // Analytics unavailable (blocked / unsupported) — game works without it.
  }
  return null;
}
