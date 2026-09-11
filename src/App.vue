<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import GameStage from './components/GameStage.vue';
import BattleBackground from './components/BattleBackground.vue';
import UiIcon from './components/UiIcon.vue';
import Lobby from './components/Lobby.vue';
import AuthScreen from './components/AuthScreen.vue';
import MainMenu from './components/MainMenu.vue';
import FriendsScreen from './components/FriendsScreen.vue';
import ProfileScreen from './components/ProfileScreen.vue';
import SettingsScreen from './components/SettingsScreen.vue';
import RoomsScreen from './components/RoomsScreen.vue';
import { CHARACTER_LIST, CHARACTERS } from './game/constants.js';
import { initAnalytics } from './game/firebase.js';
import { useAuth } from './composables/useAuth.js';
import { useFriendList, useFriendRequests } from './composables/useFriends.js';
import { useLeaderboard } from './composables/useLeaderboard.js';
import { useProfile } from './composables/useProfile.js';
import { useSettings } from './composables/useSettings.js';
import { useCloudBoard } from './composables/useCloudBoard.js';
import { getRoom, joinRoom, leaveRoom, submitFinal } from './composables/useRoom.js';
import { sendInviteReply, useInviteReplies, useInvites, usePresence } from './composables/usePresence.js';
import { sfx } from './game/audio.js';
import { music } from './game/music.js';

// Screens: auth → menu → settings | profile | friends | lobby → arena | rooms → arena(race)
const screen = ref('auth');
const selected = ref('vanguard');
const mapPick = ref('grid');
const runMapId = ref('grid');
const runShipId = ref('vanguard');
const runId = ref(0);
const race = ref(null); // { code, uid, name, seed, mode } when racing
const roomCode = ref(''); // rejoin target for the rooms screen
const nameOverride = ref('');
const best = ref(0);

const { user, authReady, offline, logout, rename, backOnline } = useAuth();
const { photo: profilePhoto, load: loadProfile, saveName: saveProfileName, recordGame, resetProfile } = useProfile();
const { settings, toggleMute, toggleMusic, setVolume, toggleShake, toggleFps, setTheme } = useSettings();
const { submitScore, personalBest } = useCloudBoard();

// --- online presence + invites + friend requests ------------------------------
const presence = usePresence();
const onlinePilots = presence.online;
const inviteCtl = useInvites();
const invites = inviteCtl.invites;
const inviteError = ref('');
const replyCtl = useInviteReplies();
const inviteReplies = replyCtl.replies;
const friendReqCtl = useFriendRequests();
const friendRequests = friendReqCtl.requests;
const friendPending = computed(() => friendRequests.value.length);
const friendListCtl = useFriendList();
const friendList = friendListCtl.friends;
let unsubPresence = null;

// --- transient notifications (high score / friend activity) -------------------
const notifs = ref([]);
const showNotifs = ref(false);
let notifSeq = 0;
let friendSubAt = 0;

const unreadCount = computed(() => notifs.value.filter((n) => !n.read).length);
const toastNotifs = computed(() => notifs.value.filter((n) => n.toast));
// Bell badge covers everything needing attention: notices + room invites.
const bellCount = computed(() => unreadCount.value + (invites.value?.length ?? 0));

function pushNotif({ kind, title, body, target }) {
  const id = ++notifSeq;
  notifs.value = [
    ...notifs.value.slice(-19),
    { id, kind, title, body, target, read: false, toast: true, ts: Date.now() },
  ];
  try {
    sfx.play(kind === 'best' ? 'buff' : 'pickup');
  } catch {
    // audio unavailable — visual notice still shows
  }
  setTimeout(() => {
    const n = notifs.value.find((x) => x.id === id);
    if (n) n.toast = false;
  }, 7000);
}

function dismissNotif(id) {
  const n = notifs.value.find((x) => x.id === id);
  if (n) {
    n.toast = false;
    n.read = true;
  }
}

function toggleNotifs() {
  showNotifs.value = !showNotifs.value;
  if (showNotifs.value) notifs.value.forEach((n) => {
    n.read = true;
  });
}

function clearNotifs() {
  notifs.value = [];
  showNotifs.value = false;
}

function goNotif(n) {
  if (n.target === 'friends') overlay.value = 'friends';
  else if (n.target) screen.value = n.target;
  dismissNotif(n.id);
  showNotifs.value = false;
}

// Modal overlays (profile / friends / settings) float above the current
// page — closing one returns to exactly where you were (even mid-room).
const overlay = ref(null);

function openOverlay(name) {
  overlay.value = overlay.value === name ? null : name;
  showNotifs.value = false;
}

function closeOverlay() {
  overlay.value = null;
}

// Personal-best tracking: snapshot at run start, compare at run end.
const { entries: localEntries } = useLeaderboard();
const runStartBests = ref({ cloud: 0, local: 0 });

function personalLocalBest() {
  const uid = user.value?.uid ?? null;
  const nm = (pilotName.value || '').trim().toLowerCase();
  let top = 0;
  for (const e of localEntries.value ?? []) {
    const ownUid = uid && e.uid && e.uid === uid;
    const ownName = nm && String(e.name ?? '').trim().toLowerCase() === nm;
    if (ownUid || ownName) top = Math.max(top, Number(e.score) || 0);
  }
  return top;
}

function snapshotBests() {
  runStartBests.value = { cloud: Number(best.value) || 0, local: personalLocalBest() };
}

function maybeNotifyBest(score) {
  const s = Math.floor(Number(score) || 0);
  if (s <= 0) return;
  const prev = Math.max(Number(runStartBests.value.cloud) || 0, Number(runStartBests.value.local) || 0);
  if (s > prev) {
    pushNotif({
      kind: 'best',
      title: 'New high score!',
      body: `${s.toLocaleString()} points — your best yet.`,
    });
  }
}

const seenReqIds = ref(new Set());
const seenFriendUids = ref(new Set());
const seenReplyIds = ref(new Set());

watch(friendRequests, (list) => {
  if (!user.value || offline.value) return;
  for (const r of list ?? []) {
    if (!seenReqIds.value.has(r.id)) {
      // Only announce requests sent after we subscribed (ts guard skips
      // pre-existing pending ones from previous sessions).
      if ((Number(r.ts) || 0) > friendSubAt - 5000) {
        pushNotif({
          kind: 'friend',
          title: 'New friend request',
          body: `${r.fromName ?? 'A pilot'} wants to be friends.`,
          target: 'friends',
        });
      }
    }
  }
  seenReqIds.value = new Set((list ?? []).map((r) => r.id));
});

watch(friendList, (list) => {
  if (!user.value || offline.value) return;
  for (const f of list ?? []) {
    if (!seenFriendUids.value.has(f.uid)) {
      if ((Number(f.addedAt) || 0) > friendSubAt - 5000) {
        pushNotif({ kind: 'friend', title: 'New friend', body: `${f.name ?? 'A pilot'} is now your friend.` });
      }
    }
  }
  seenFriendUids.value = new Set((list ?? []).map((f) => f.uid));
});

watch(inviteReplies, (list) => {
  if (!user.value || offline.value) return;
  for (const r of list ?? []) {
    if (!seenReplyIds.value.has(r.id)) {
      // Announce fresh replies, then clear them so the inbox never piles up.
      if ((Number(r.ts) || 0) > friendSubAt - 5000) {
        pushNotif({
          kind: 'friend',
          title: r.accepted ? 'Invite accepted' : 'Invite declined',
          body: r.accepted
            ? `${r.fromName ?? 'A pilot'} joined room ${r.roomCode ?? ''}.`
            : `${r.fromName ?? 'A pilot'} declined room ${r.roomCode ?? ''}.`,
          target: r.accepted ? 'rooms' : undefined,
        });
      }
    }
    replyCtl.dismiss(user.value.uid, r.id);
  }
  seenReplyIds.value = new Set((list ?? []).map((r) => r.id));
});

watch(
  [user, offline],
  ([u, off]) => {
    if (unsubPresence) {
      unsubPresence();
      unsubPresence = null;
    }
    loadProfile(u?.uid ?? null, off, u?.displayName || nameOverride.value || 'Pilot');
    friendSubAt = Date.now();
    friendReqCtl.watchUid(u && !off ? u.uid : null);
    friendListCtl.watchUid(u && !off ? u.uid : null);
    replyCtl.watchUid(u && !off ? u.uid : null);
    if (u && !off) {
      presence.goOnline(u.uid, pilotName.value);
      unsubPresence = presence.subscribe();
      inviteCtl.watchUid(u.uid);
    } else {
      inviteCtl.watchUid(null);
    }
  },
  { immediate: true },
);

async function acceptInvite(inv) {
  inviteError.value = '';
  try {
    await joinRoom(inv.roomCode, user.value.uid, pilotName.value, selected.value, profilePhoto.value);
    await inviteCtl.dismiss(user.value.uid, inv.id);
    // Tell the inviter we joined (best-effort — never blocks joining).
    try {
      await sendInviteReply(inv.fromUid, {
        roomCode: inv.roomCode,
        mode: inv.mode,
        fromUid: user.value.uid,
        fromName: pilotName.value,
        accepted: true,
      });
    } catch {
      // reply failed — inviter still sees us join the room live
    }
    roomCode.value = inv.roomCode;
    screen.value = 'rooms';
  } catch (e) {
    inviteError.value = e?.message ?? 'Could not join room.';
  }
}

async function declineInvite(inv) {
  // Tell the inviter we passed (best-effort), then always clear the invite.
  try {
    await sendInviteReply(inv.fromUid, {
      roomCode: inv.roomCode,
      mode: inv.mode,
      fromUid: user.value.uid,
      fromName: pilotName.value,
      accepted: false,
    });
  } catch {
    // reply failed — dismissing still removes it from our inbox
  }
  try {
    await inviteCtl.dismiss(user.value.uid, inv.id);
  } catch {
    // ignore
  }
}

const pilotName = computed(
  () => nameOverride.value || user.value?.displayName || 'Pilot',
);
const selectedCharacter = computed(
  () => CHARACTER_LIST.find((c) => c.id === selected.value) ?? CHARACTER_LIST[0],
);
const canCloud = computed(() => !!user.value && !offline.value);

async function refreshBest() {
  if (user.value && !offline.value) {
    best.value = await personalBest(user.value.uid);
  } else {
    best.value = 0;
  }
}

watch(
  [authReady, user, offline],
  ([ready, u, off]) => {
    if (ready && (u || off) && screen.value === 'auth') {
      screen.value = 'menu';
      refreshBest();
    }
  },
  { immediate: true },
);

onMounted(() => {
  initAnalytics();
  sfx.setMuted(settings.muted);
  sfx.setVolume(settings.volume);
  syncMusic();
  window.addEventListener('pointerdown', music.unlock, { once: true });
  window.addEventListener('keydown', music.unlock, { once: true });
  window.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (showNotifs.value) showNotifs.value = false;
    else if (overlay.value) closeOverlay();
  });
});

function syncMusic() {
  music.setMuted(settings.muted);
  music.setVolume(settings.volume);
  music.setEnabled(settings.music);
}

watch(
  screen,
  (s) => {
    syncMusic();
    music.playMood(s === 'arena' ? 'game' : 'menu');
  },
  { immediate: true },
);

function onAuthed() {
  screen.value = 'menu';
  refreshBest();
}

async function onLogout() {
  if (user.value) presence.goOffline(user.value.uid);
  inviteCtl.watchUid(null);
  friendReqCtl.watchUid(null);
  friendListCtl.watchUid(null);
  resetProfile();
  notifs.value = [];
  showNotifs.value = false;
  overlay.value = null;
  seenReqIds.value = new Set();
  seenFriendUids.value = new Set();
  if (unsubPresence) {
    unsubPresence();
    unsubPresence = null;
  }
  if (offline.value) {
    backOnline();
  } else {
    try {
      await logout();
    } catch {
      // ignore
    }
  }
  race.value = null;
  roomCode.value = '';
  nameOverride.value = '';
  screen.value = 'auth';
}

function onRename(name, done) {
  const clean = String(name).trim().slice(0, 20) || 'Pilot';
  // Offline (or logged-out) profiles live in localStorage only.
  if (offline.value || !user.value) {
    nameOverride.value = clean;
    saveProfileName(null, true, clean).then(() => done('Saved'));
    return;
  }
  rename(name)
    .then((saved) => {
      nameOverride.value = saved;
      saveProfileName(user.value.uid, false, saved);
      if (user.value) presence.goOnline(user.value.uid, saved);
      done('Saved');
    })
    .catch((e) => done(e?.message ?? 'Could not save.'));
}

// --- single player ----------------------------------------------------------

function toLobby() {
  race.value = null;
  screen.value = 'lobby';
}

const MAP_IDS = ['grid', 'debris', 'pillars', 'void'];

function launchRun() {
  runId.value += 1;
  race.value = null;
  runShipId.value = selected.value;
  snapshotBests();
  runMapId.value =
    mapPick.value === 'random'
      ? MAP_IDS[Math.floor(Math.random() * MAP_IDS.length)]
      : mapPick.value;
  screen.value = 'arena';
}

// --- multiplayer ------------------------------------------------------------
function toRooms() {
  screen.value = 'rooms';
}

async function onDeploy(code) {
  roomCode.value = code;
  let seed;
  let mode = 'arcade';
  let mapId = 'grid';
  let startsAt = 0;
  let ship = selected.value;
  try {
    const r = await getRoom(code);
    if (r) {
      seed = r.seed ?? undefined;
      mode = r.mode ?? 'arcade';
      mapId = r.map ?? 'grid';
      startsAt = r.startsAt ?? 0;
      // The room — not the solo hangar — owns the multiplayer ship pick.
      const roomShip = r.members?.[user.value.uid]?.ship;
      ship = CHARACTERS[roomShip]?.id ?? selected.value;
    }
  } catch {
    // room read failed — run unseeded on the classic map
  }
  race.value = { code, uid: user.value.uid, name: pilotName.value, seed, mode, mapId, startsAt, ship };
  runShipId.value = ship;
  snapshotBests();
  overlay.value = null;
  runId.value += 1;
  screen.value = 'arena';
}

async function onRaceFinish({ score, wave, stats }) {
  if (!race.value) return;
  recordGame(race.value.uid, offline.value, runShipId.value, score);
  try {
    await submitFinal(race.value.code, race.value.uid, {
      score,
      wave,
      name: pilotName.value,
    });
  } catch {
    // room write failed — standings will just miss this run
  }
  // Race runs also count toward the global board.
  try {
    await submitScore({ uid: race.value.uid, name: pilotName.value, score, wave, stats });
  } catch {
    // offline / rules — ignore
  }
  await refreshBest();
  maybeNotifyBest(score);
}

async function onStageLobby() {
  // Quitting mid-race leaves the room entirely.
  if (race.value) {
    try {
      await leaveRoom(race.value.code, race.value.uid);
    } catch {
      // ignore
    }
    race.value = null;
    roomCode.value = '';
    screen.value = 'rooms';
    return;
  }
  screen.value = 'lobby';
}

function onRoomStandings() {
  // Finished the run but still a room member — reattach to watch results.
  if (race.value) roomCode.value = race.value.code;
  screen.value = 'rooms';
}

async function onRunSaved({ score, wave, stats }) {
  recordGame(user.value?.uid ?? null, offline.value, runShipId.value, score);
  if (race.value || !canCloud.value) {
    if (!canCloud.value) maybeNotifyBest(score);
    return; // race runs submit via onRaceFinish
  }
  try {
    // Save under the signed-in account: one doc per uid, best score kept.
    await submitScore({ uid: user.value.uid, name: pilotName.value, score, wave, stats });
    await refreshBest();
  } catch {
    // offline / rules — local save already succeeded
  }
  maybeNotifyBest(score);
}
</script>

<template>
  <div :class="screen === 'arena' ? 'h-dvh w-full overflow-hidden' : 'min-h-dvh w-full'">
    <BattleBackground v-if="screen !== 'arena'" />

    <!-- ─── Global Topbar ──────────────────────────────────────────────── -->
    <header
      v-if="screen !== 'arena'"
      class="sticky top-0 z-40 w-full border-b border-white/10 bg-panel/85 backdrop-blur-xl"
    >
      <div class="mx-auto flex max-w-[1600px] items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <!-- Left: Logo -->
        <div class="flex items-center gap-3">
          <div class="flex items-center gap-2.5">
            <div class="flex h-7 w-7 items-center justify-center rounded-lg" style="background: rgba(56,189,248,0.15); border: 1px solid rgba(56,189,248,0.25);">
              <span class="h-2 w-2 rounded-full bg-accent" style="box-shadow: 0 0 8px 2px rgba(56,189,248,0.6);" />
            </div>
            <h1 class="font-display text-sm font-bold tracking-[0.25em] text-zinc-100 uppercase">
              Neon Strike
            </h1>
          </div>
          <span class="hidden text-[11px] text-zinc-600 sm:block">Top-down arena shooter</span>
        </div>

        <!-- Right: Action Icons -->
        <div class="flex items-center gap-1.5">
          <!-- Theme toggle -->
          <button
            type="button"
            :title="settings.theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'"
            :aria-label="settings.theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'"
            class="btn-icon"
            @click="setTheme(settings.theme === 'light' ? 'dark' : 'light')"
          >
            <UiIcon :name="settings.theme === 'light' ? 'sun' : 'moon'" cls="h-4 w-4" />
          </button>

          <!-- Notifications bell -->
          <button
            v-if="authReady && (user || offline)"
            id="notif-btn"
            type="button"
            title="Notifications"
            aria-label="Notifications"
            class="relative btn-icon"
            :class="showNotifs ? 'btn-icon-active' : ''"
            @click="toggleNotifs"
          >
            <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
            </svg>
              <span
                v-if="bellCount > 0"
                class="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[9px] font-bold tabular-nums"
                style="color: #fff; box-shadow: 0 0 8px rgba(251,113,133,0.7);"
              >{{ bellCount }}</span>
          </button>

          <!-- Friends / Search -->
          <button
            v-if="canCloud"
            id="friends-btn"
            type="button"
            title="Search pilots & friends"
            aria-label="Search pilots and friends"
            class="relative btn-icon"
            :class="overlay === 'friends' ? 'btn-icon-active' : ''"
            @click="openOverlay('friends')"
          >
            <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <span
              v-if="friendPending > 0"
              class="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[9px] font-bold text-ink tabular-nums"
              style="box-shadow: 0 0 8px rgba(56,189,248,0.7);"
            >{{ friendPending }}</span>
          </button>

          <!-- Divider -->
          <div v-if="authReady && (user || offline)" class="mx-1 h-5 w-px bg-white/10" />

          <!-- Profile icon -->
          <button
            v-if="authReady && (user || offline)"
            id="profile-btn"
            type="button"
            title="Profile"
            aria-label="View profile"
            class="btn-icon"
            :class="overlay === 'profile' ? 'btn-icon-active' : ''"
            @click="openOverlay('profile')"
          >
            <img
              v-if="profilePhoto"
              :src="profilePhoto"
              alt=""
              class="h-5 w-5 rounded-full object-cover"
            />
            <svg v-else class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
            </svg>
          </button>

          <!-- Settings icon -->
          <button
            v-if="authReady && (user || offline)"
            id="settings-btn"
            type="button"
            title="Settings"
            aria-label="Open settings"
            class="btn-icon"
            :class="overlay === 'settings' ? 'btn-icon-active' : ''"
            @click="openOverlay('settings')"
          >
            <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
            </svg>
          </button>

          <!-- Pilot name chip (sm+) -->
          <div
            v-if="user && !offline"
            class="hidden items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 py-1.5 text-[12px] font-medium text-zinc-300 sm:flex"
          >
            <span class="max-w-24 truncate">{{ pilotName }}</span>
          </div>
        </div>
      </div>
    </header>

    <!-- ─── Main Content Area ─────────────────────────────────────────── -->
    <div :class="screen === 'arena' ? 'relative z-10 flex h-full w-full flex-col' : 'relative z-10 mx-auto flex w-full max-w-[1600px] flex-col items-center gap-6 px-4 py-8 sm:px-6 lg:py-10 app-content'">

      <!-- Invite banners (floating, top-center) -->
      <div
        v-if="invites.length && screen !== 'auth' && screen !== 'arena'"
        class="fixed top-20 left-1/2 z-50 w-full max-w-sm -translate-x-1/2 space-y-2 px-4"
      >
        <div
          v-for="inv in invites"
          :key="inv.id"
          class="panel-elevated flex animate-slide-up items-center gap-3 p-4"
          style="border-color: rgba(56,189,248,0.2);"
        >
          <div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full" style="background: rgba(56,189,248,0.15);">
            <svg class="h-4 w-4 text-accent" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="17" cy="21" r="1"/><circle cx="7" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>
          </div>
          <div class="min-w-0 flex-1">
            <div class="truncate text-sm font-semibold text-zinc-100">{{ inv.fromName }} invited you</div>
            <div class="text-[11px] text-zinc-500">Room {{ inv.roomCode }} · {{ inv.mode === 'versus' ? 'Versus Duel' : 'Arcade Co-op' }}</div>
          </div>
          <button type="button" class="btn-primary py-1.5 px-3 text-xs" @click="acceptInvite(inv)">Join</button>
          <button type="button" class="btn-ghost py-1.5 px-2 text-xs" @click="declineInvite(inv)">✕</button>
        </div>
        <p v-if="inviteError" class="rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-[12px] text-danger">{{ inviteError }}</p>
      </div>

      <!-- Toast notifications (floating, top-left) -->
      <div
        v-if="toastNotifs.length && screen !== 'auth'"
        class="fixed top-20 left-4 z-50 w-full max-w-xs space-y-2"
      >
        <div
          v-for="n in toastNotifs"
          :key="n.id"
          class="panel-elevated animate-slide-up flex items-start gap-3 border-l-2 p-4"
          :class="n.kind === 'best' ? 'border-l-accent' : 'border-l-repair'"
        >
          <span
            class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold"
            :class="n.kind === 'best' ? 'bg-accent/15 text-accent' : 'bg-repair/15 text-repair'"
          >{{ n.kind === 'best' ? '★' : '♥' }}</span>
          <div class="min-w-0 flex-1">
            <div class="truncate text-sm font-semibold text-zinc-100">{{ n.title }}</div>
            <div class="text-[12px] text-zinc-400">{{ n.body }}</div>
            <button v-if="n.target" type="button" class="mt-1 text-[12px] font-semibold text-accent hover:text-sky-300" @click="goNotif(n)">View →</button>
          </div>
          <button type="button" class="shrink-0 rounded-lg p-1 text-zinc-500 transition-colors hover:text-zinc-200" @click="dismissNotif(n.id)">✕</button>
        </div>
      </div>

      <!-- Notification dropdown panel -->
      <div v-if="showNotifs && screen !== 'auth'" class="fixed top-[60px] right-4 z-50 w-full max-w-sm">
        <div class="panel-elevated p-4" style="border-color: rgba(255,255,255,0.08);">
          <div class="mb-3 flex items-center justify-between">
            <span class="text-sm font-semibold text-zinc-100">Notifications</span>
            <div class="flex items-center gap-2">
              <button v-if="notifs.length" type="button" class="text-[11px] font-medium text-zinc-500 hover:text-zinc-200" @click="clearNotifs">Clear all</button>
              <button type="button" aria-label="Close" class="btn-icon p-1" @click="showNotifs = false">
                <svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
          </div>
          <div v-if="!notifs.length && !invites.length" class="py-6 text-center text-[13px] text-zinc-600">Nothing here yet.</div>
          <div v-if="invites.length" class="mb-3 space-y-2">
            <div class="label mb-1.5">Room invites ({{ invites.length }})</div>
            <div v-for="inv in invites" :key="inv.id" class="flex items-center gap-2.5 rounded-xl border border-accent/20 bg-accent/5 p-3">
              <div class="min-w-0 flex-1">
                <div class="truncate text-sm font-semibold text-zinc-100">{{ inv.fromName }} invited you</div>
                <div class="text-[11px] text-zinc-500">{{ inv.mode === 'versus' ? 'Versus Duel' : 'Arcade Co-op' }} · Room {{ inv.roomCode }}</div>
              </div>
              <button type="button" class="btn-primary py-1 px-3 text-xs" @click="acceptInvite(inv)">Join</button>
              <button type="button" class="btn-ghost py-1 px-2 text-xs" @click="declineInvite(inv)">✕</button>
            </div>
          </div>
          <div v-if="notifs.length" class="max-h-72 space-y-2 overflow-y-auto">
            <div v-for="n in [...notifs].reverse()" :key="n.id" class="flex items-start gap-3 rounded-xl border border-white/6 bg-white/3 p-3">
              <span class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold"
                :class="n.kind === 'best' ? 'bg-accent/15 text-accent' : 'bg-repair/15 text-repair'">
                {{ n.kind === 'best' ? '★' : '♥' }}
              </span>
              <div class="min-w-0 flex-1">
                <div class="truncate text-sm font-semibold text-zinc-100">{{ n.title }}</div>
                <div class="text-[12px] text-zinc-400">{{ n.body }}</div>
                <button v-if="n.target" type="button" class="mt-1 text-[12px] font-semibold text-accent hover:text-sky-300" @click="goNotif(n)">View →</button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Friend request nudge (bottom banner) -->
      <div
        v-if="friendPending > 0 && screen !== 'auth' && screen !== 'arena' && overlay !== 'friends'"
        class="fixed bottom-4 left-1/2 z-50 w-full max-w-sm -translate-x-1/2 px-4"
      >
        <button
          type="button"
          class="panel flex w-full items-center gap-3 p-3 text-left shadow-2xl transition-colors hover:border-accent/50"
          @click="openOverlay('friends')"
        >
          <span class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent/15 text-sm font-bold text-accent">{{ friendPending }}</span>
          <span class="min-w-0 flex-1 text-sm font-semibold text-zinc-100">{{ friendPending === 1 ? '1 pilot wants to be friends' : `${friendPending} pilots want to be friends` }}</span>
          <span class="shrink-0 text-[12px] font-semibold text-accent">View →</span>
        </button>
      </div>

      <!-- Loading state -->
      <div v-if="!authReady" class="py-20 text-[13px] text-zinc-500">Contacting command…</div>

      <!-- ─── Screens ──────────────────────────────────────────────────── -->
      <AuthScreen v-else-if="screen === 'auth'" @authed="onAuthed" />

      <MainMenu
        v-else-if="screen === 'menu'"
        :pilot-name="pilotName"
        :email="user?.email ?? ''"
        :offline="offline"
        :best="best"
        :cloud="canCloud"
        :photo="profilePhoto"
        @single="toLobby"
        @multi="toRooms"
        @settings="openOverlay('settings')"
        @profile="openOverlay('profile')"
        @logout="onLogout"
      />

      <Lobby
        v-if="screen === 'lobby'"
        :selected-id="selected"
        :map-pick="mapPick"
        @select="selected = $event"
        @map-pick="mapPick = $event"
        @launch="launchRun"
        @back="screen = 'menu'"
      />

      <RoomsScreen
        v-else-if="screen === 'rooms' && user"
        :key="roomCode || 'gate'"
        :uid="user.uid"
        :pilot-name="pilotName"
        :photo="profilePhoto"
        :initial-ship="selected"
        :rejoin-code="roomCode"
        @deploy="onDeploy"
        @back="roomCode = ''; screen = 'menu'"
      />

      <div v-else-if="screen === 'arena'" class="h-full w-full min-w-0 flex-1">
        <GameStage
          :key="runId"
          :character-id="race ? (race.ship ?? selected) : selected"
          :pilot-name="pilotName"
          :uid="user?.uid ?? null"
          :map-id="runMapId"
          :race="race"
          @lobby="onStageLobby"
          @room="onRoomStandings"
          @race-finish="onRaceFinish"
          @run-saved="onRunSaved"
        />
      </div>

      <footer v-if="screen !== 'arena'" class="pb-2 text-center text-[11px] text-zinc-600">
        {{ canCloud ? 'Scores sync to the global board · ' : 'Scores are stored locally in this browser · ' }}
        <kbd>P</kbd> pause · <kbd>M</kbd> mute · touch supported
      </footer>
    </div>

    <!-- ─── Modal overlays (float above the current page) ──────────────── -->
    <div
      v-if="overlay && screen !== 'auth' && screen !== 'arena'"
      class="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-sm"
      @click.self="closeOverlay"
    >
      <div class="mx-auto flex min-h-full w-full max-w-lg flex-col items-center justify-center px-4 py-8 app-modal">
        <ProfileScreen
          v-if="overlay === 'profile'"
          :uid="user?.uid ?? null"
          :pilot-name="pilotName"
          :email="user?.email ?? ''"
          :offline="offline"
          :best="best"
          :online="onlinePilots"
          @rename="onRename"
          @friends="overlay = 'friends'"
          @back="closeOverlay"
        />

        <FriendsScreen
          v-else-if="overlay === 'friends'"
          :uid="user?.uid ?? null"
          :pilot-name="pilotName"
          :photo="profilePhoto"
          :offline="offline"
          :online="onlinePilots"
          @back="closeOverlay"
        />

        <SettingsScreen
          v-else-if="overlay === 'settings'"
          :settings="settings"
          :pilot-name="pilotName"
          :can-rename="canCloud"
          @toggle-mute="toggleMute(); sfx.setMuted(settings.muted); music.setMuted(settings.muted)"
          @toggle-music="toggleMusic(); music.setEnabled(settings.music)"
          @volume="(v) => { setVolume(v); sfx.setVolume(v); music.setVolume(v); }"
          @toggle-shake="toggleShake"
          @toggle-fps="toggleFps"
          @theme="setTheme"
          @rename="onRename"
          @back="closeOverlay"
        />
      </div>
    </div>
  </div>
</template>
