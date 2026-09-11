import { computed, ref } from 'vue';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../game/firebase.js';
import { CHARACTER_LIST, CHARACTERS } from '../game/constants.js';

const AVATAR_SIZE = 128;
// Keep well under Firestore's 1 MiB doc limit.
const MAX_PHOTO_CHARS = 400 * 1024;

const profile = ref({
  name: '',
  photo: '',
  shipUsage: {},
  gamesPlayed: 0,
  bestScore: 0,
});
const profileLoading = ref(false);
const profileError = ref(null);
// Per-account isolation: memory cache keyed by account, which account is
// currently displayed, and which keys are cloud-fresh. Sequence numbers drop
// stale cloud results when accounts switch mid-fetch.
const profileCache = new Map();
const freshKeys = new Set();
let loadedFor = null;
let profileKey = null;
let loadSeq = 0;

function cacheKeyOf(uid, offline) {
  return offline ? 'offline' : (uid ?? 'none');
}

function blankProfile(fallbackName = 'Pilot') {
  return { name: fallbackName, photo: '', shipUsage: {}, gamesPlayed: 0, bestScore: 0 };
}

function cloneData(d) {
  return {
    name: d.name,
    photo: d.photo,
    shipUsage: { ...(d.shipUsage ?? {}) },
    gamesPlayed: d.gamesPlayed,
    bestScore: d.bestScore,
  };
}

function localKey(uid, offline) {
  if (offline || !uid) return 'neonStrike_profile_offline';
  return `neonStrike_profile_${uid}`;
}

function readLocal(uid, offline) {
  try {
    const raw = localStorage.getItem(localKey(uid, offline));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeLocal(uid, offline) {
  try {
    localStorage.setItem(localKey(uid, offline), JSON.stringify(profile.value));
  } catch {
    // ignore (private mode)
  }
}

function applyData(data, fallbackName = 'Pilot') {
  if (!data || typeof data !== 'object') return;
  const usage = data.shipUsage && typeof data.shipUsage === 'object' ? data.shipUsage : {};
  const cleanUsage = {};
  for (const [k, v] of Object.entries(usage)) {
    if (CHARACTERS[k] && Number(v) > 0) cleanUsage[k] = Math.min(999999, Math.floor(Number(v)));
  }
  profile.value = {
    name: String(data.name ?? fallbackName).slice(0, 20) || fallbackName,
    photo: typeof data.photo === 'string' ? data.photo.slice(0, MAX_PHOTO_CHARS + 64) : '',
    shipUsage: cleanUsage,
    gamesPlayed: Math.max(0, Math.floor(Number(data.gamesPlayed) || 0)),
    bestScore: Math.max(0, Math.floor(Number(data.bestScore) || 0)),
  };
}

export function useProfile() {
  const mostUsedShipId = computed(() => {
    let top = null;
    let topCount = 0;
    for (const [id, count] of Object.entries(profile.value.shipUsage ?? {})) {
      if (CHARACTERS[id] && count > topCount) {
        top = id;
        topCount = count;
      }
    }
    return top;
  });

  const mostUsedShip = computed(() => {
    const id = mostUsedShipId.value;
    if (!id) return null;
    return CHARACTER_LIST.find((c) => c.id === id) ?? null;
  });

  const mostUsedCount = computed(() => {
    const id = mostUsedShipId.value;
    return id ? Number(profile.value.shipUsage[id]) || 0 : 0;
  });

  const photo = computed(() => profile.value.photo || '');

  async function load(uid, offline, fallbackName = 'Pilot') {
    const key = cacheKeyOf(uid, offline);
    // Already showing fresh data for this account — nothing to do.
    if (key === profileKey && (freshKeys.has(key) || (!uid && !offline))) return profile.value;
    const mySeq = ++loadSeq;
    loadedFor = key;
    profileError.value = null;
    // Instant swap from same-account sources only — never another account's data.
    const mem = profileCache.get(key);
    const local = uid || offline ? readLocal(uid, offline) : null;
    if (!uid && !offline) {
      // Logged out: blank slate, never anyone's data.
      profile.value = blankProfile(fallbackName);
    } else if (mem) {
      profile.value = cloneData(mem);
    } else if (local) {
      applyData(local, fallbackName);
    } else {
      profile.value = blankProfile(fallbackName);
    }
    profileKey = key;
    if (uid && !offline && !freshKeys.has(key)) {
      profileLoading.value = true;
      try {
        const snap = await getDoc(doc(db, 'users', uid));
        // Account switched (or reset) mid-fetch — drop this stale result.
        if (loadedFor !== key || mySeq !== loadSeq) return profile.value;
        if (snap?.exists()) {
          const cloud = snap.data() ?? {};
          const mergedUsage = { ...(local?.shipUsage ?? {}) };
          const cloudUsage = cloud.shipUsage && typeof cloud.shipUsage === 'object' ? cloud.shipUsage : {};
          for (const [k, v] of Object.entries(cloudUsage)) {
            if (CHARACTERS[k]) mergedUsage[k] = Math.max(Number(mergedUsage[k]) || 0, Math.floor(Number(v) || 0));
          }
          const cleanUsage = {};
          for (const [k, v] of Object.entries(mergedUsage)) {
            if (CHARACTERS[k] && Number(v) > 0) cleanUsage[k] = Math.min(999999, Math.floor(Number(v)));
          }
          // The cloud doc is the source of truth for identity. This also
          // self-heals any photo/name saved under the wrong account before.
          profile.value = {
            name: String(cloud.name ?? local?.name ?? fallbackName).slice(0, 20) || fallbackName,
            photo: typeof cloud.photo === 'string' ? cloud.photo.slice(0, MAX_PHOTO_CHARS + 64) : '',
            shipUsage: cleanUsage,
            gamesPlayed: Math.max(Number(cloud.gamesPlayed) || 0, Number(local?.gamesPlayed) || 0),
            bestScore: Math.max(Number(cloud.bestScore) || 0, Number(local?.bestScore) || 0),
          };
          profileCache.set(key, cloneData(profile.value));
          writeLocal(uid, offline);
          freshKeys.add(key);
        } else {
          // No cloud doc yet — keep same-account local until it syncs.
          profileCache.set(key, cloneData(profile.value));
          freshKeys.add(key);
        }
      } catch (e) {
        if (loadedFor !== key || mySeq !== loadSeq) return profile.value;
        profileError.value = e?.message ?? 'Could not load profile.';
        profileCache.set(key, cloneData(profile.value));
      } finally {
        profileLoading.value = false;
      }
    } else {
      profileCache.set(key, cloneData(profile.value));
    }
    return profile.value;
  }

  function refresh(uid, offline) {
    freshKeys.delete(cacheKeyOf(uid, offline));
    return load(uid, offline);
  }

  function resetProfile() {
    loadSeq += 1; // abort any in-flight cloud fetch
    loadedFor = null;
    profileKey = null;
    freshKeys.clear();
    profileLoading.value = false;
    profileError.value = null;
    profile.value = blankProfile('Pilot');
  }

  function keyIsCurrent(uid, offline) {
    const key = cacheKeyOf(uid, offline);
    return loadedFor === key && profileKey === key;
  }

  async function saveName(uid, offline, name, fallbackName = 'Pilot') {
    const clean = String(name ?? '').trim().slice(0, 20) || fallbackName;
    // Refuse stale writes from after an account switch — never stamp one
    // account's data under another account's key.
    if (!keyIsCurrent(uid, offline)) return { ok: false, error: 'Account changed — please try again.' };
    profile.value = { ...profile.value, name: clean };
    profileCache.set(cacheKeyOf(uid, offline), cloneData(profile.value));
    writeLocal(uid, offline);
    if (uid && !offline) {
      try {
        await setDoc(doc(db, 'users', uid), { name: clean, nameLower: clean.toLowerCase() }, { merge: true });
      } catch (e) {
        return { ok: false, error: e?.message ?? 'Could not save name.' };
      }
    }
    return { ok: true, name: clean };
  }

  async function savePhoto(uid, offline, dataUrl) {
    const clean = typeof dataUrl === 'string' ? dataUrl : '';
    if (clean && clean.length > MAX_PHOTO_CHARS) {
      return { ok: false, error: 'Picture too large after resize — try a smaller image.' };
    }
    if (clean && !clean.startsWith('data:image/')) {
      return { ok: false, error: 'Invalid image data.' };
    }
    if (!keyIsCurrent(uid, offline)) return { ok: false, error: 'Account changed — please try again.' };
    profile.value = { ...profile.value, photo: clean };
    profileCache.set(cacheKeyOf(uid, offline), cloneData(profile.value));
    writeLocal(uid, offline);
    if (uid && !offline) {
      try {
        if (!clean) {
          await setDoc(doc(db, 'users', uid), { photo: '' }, { merge: true });
        } else {
          await setDoc(doc(db, 'users', uid), { photo: clean }, { merge: true });
        }
      } catch (e) {
        return { ok: false, error: e?.message ?? 'Could not save picture.' };
      }
    }
    return { ok: true };
  }

  async function recordGame(uid, offline, shipId, score) {
    const s = Math.max(0, Math.floor(Number(score) || 0));
    if (!keyIsCurrent(uid, offline)) return null;
    const usage = { ...(profile.value.shipUsage ?? {}) };
    if (shipId && CHARACTERS[shipId]) {
      usage[shipId] = Math.min(999999, (Number(usage[shipId]) || 0) + 1);
    }
    profile.value = {
      ...profile.value,
      shipUsage: usage,
      gamesPlayed: (Number(profile.value.gamesPlayed) || 0) + 1,
      bestScore: Math.max(Number(profile.value.bestScore) || 0, s),
    };
    profileCache.set(cacheKeyOf(uid, offline), cloneData(profile.value));
    writeLocal(uid, offline);
    if (uid && !offline) {
      try {
        await setDoc(
          doc(db, 'users', uid),
          {
            shipUsage: usage,
            gamesPlayed: profile.value.gamesPlayed,
            bestScore: profile.value.bestScore,
          },
          { merge: true },
        );
      } catch {
        // offline / rules — local copy already saved
      }
    }
    return profile.value;
  }

  // Downscale any upload to a small square JPEG data URL (base64) so it fits
  // in a Firestore doc and loads instantly.
  function fileToAvatarDataUrl(file) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        try {
          const side = Math.min(img.naturalWidth || AVATAR_SIZE, img.naturalHeight || AVATAR_SIZE);
          const sx = ((img.naturalWidth || side) - side) / 2;
          const sy = ((img.naturalHeight || side) - side) / 2;
          const canvas = document.createElement('canvas');
          canvas.width = AVATAR_SIZE;
          canvas.height = AVATAR_SIZE;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, sx, sy, side, side, 0, 0, AVATAR_SIZE, AVATAR_SIZE);
          URL.revokeObjectURL(url);
          resolve(canvas.toDataURL('image/jpeg', 0.82));
        } catch (e) {
          URL.revokeObjectURL(url);
          reject(e);
        }
      };
      img.onerror = (e) => {
        URL.revokeObjectURL(url);
        reject(e);
      };
      img.src = url;
    });
  }

  return {
    profile,
    photo,
    loading: profileLoading,
    error: profileError,
    mostUsedShip,
    mostUsedShipId,
    mostUsedCount,
    load,
    refresh,
    resetProfile,
    saveName,
    savePhoto,
    recordGame,
    fileToAvatarDataUrl,
  };
}
