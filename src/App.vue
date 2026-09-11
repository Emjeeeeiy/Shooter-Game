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
import { CHARACTER_LIST } from './game/constants.js';
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
const roomsRef = ref(null);
const race = ref(null); // { code, uid, name, seed, mode } when racing
const roomCode = ref(''); // rejoin target for the rooms screen
const nameOverride = ref('');
const best = ref(0);

const { user, authReady, offline, logout, rename, backOnline } = useAuth();
const { photo: profilePhoto, load: loadProfile, saveName: saveProfileName, recordGame, resetProfile } = useProfile();
const { settings, toggleMute, toggleMusic, setVolume, toggleShake, toggleFps } = useSettings();
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
  if (n.target) screen.value = n.target;
  dismissNotif(n.id);
  showNotifs.value = false;
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
// Header Back button: leaves the room first when inside one.
const backAction = computed(() => {
  if (
    screen.value === 'lobby' ||
    screen.value === 'settings' ||
    screen.value === 'profile' ||
    screen.value === 'friends'
  ) {
    return () => {
      screen.value = 'menu';
    };
  }
  if (screen.value === 'rooms') {
    return () => roomsRef.value?.goBack();
  }
  return null;
});

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
  try {
    const r = await getRoom(code);
    if (r) {
      seed = r.seed ?? undefined;
      mode = r.mode ?? 'arcade';
      mapId = r.map ?? 'grid';
      startsAt = r.startsAt ?? 0;
    }
  } catch {
    // room read failed — run unseeded on the classic map
  }
  race.value = { code, uid: user.value.uid, name: pilotName.value, seed, mode, mapId, startsAt };
  runShipId.value = selected.value;
  snapshotBests();
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
  <div :class="screen === 'arena' ? 'h-dvh w-full overflow-hidden' : 'min-h-dvh w-full px-4 py-8 sm:px-6 lg:py-10'">
    <BattleBackground v-if="screen !== 'arena'" />
    <div :class="screen === 'arena' ? 'relative z-10 mx-auto flex h-full w-full flex-col' : 'relative z-10 mx-auto flex w-full max-w-[1600px] flex-col items-center gap-6'">
      <header v-if="screen !== 'arena'" class="sticky top-0 z-40 w-full border-b border-white/5 bg-surface/85 backdrop-blur-md">
        <div class="flex items-center justify-between gap-4 py-3">
          <div class="flex items-center gap-2.5">
            <span class="h-2 w-2 rounded-full bg-accent" />
            <h1 class="text-sm font-semibold tracking-[0.22em] text-zinc-200 uppercase">
              Neon Strike
            </h1>
          </div>
          <div class="flex items-center gap-3">
            <p class="hidden text-[13px] text-zinc-500 sm:block">Top-down arena shooter</p>
            <button
              v-if="authReady && (user || offline)"
              type="button"
              title="Notifications"
              aria-label="Notifications"
              class="relative rounded-full border border-white/10 p-2 text-zinc-300 transition-colors hover:border-white/30 hover:text-zinc-100"
              @click="toggleNotifs"
            >
              <UiIcon name="bell" cls="h-4 w-4" />
              <span
                v-if="bellCount > 0"
                class="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-bold text-white tabular-nums"
              >
                {{ bellCount }}
              </span>
            </button>
            <button
              v-if="canCloud"
              type="button"
              title="Search pilots / friends"
              aria-label="Search pilots and friends"
              class="relative rounded-full border border-white/10 p-2 text-zinc-300 transition-colors hover:border-white/30 hover:text-zinc-100"
              @click="screen = 'friends'"
            >
              <UiIcon name="search" cls="h-4 w-4" />
              <span
                v-if="friendPending > 0"
                class="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-bold text-surface tabular-nums"
              >
                {{ friendPending }}
              </span>
            </button>
            <span
              v-if="user && !offline"
              class="hidden items-center gap-1.5 rounded-full border border-white/10 px-2.5 py-1 text-[11px] font-medium text-zinc-300 sm:flex"
            >
              <img
                v-if="profilePhoto"
                :src="profilePhoto"
                alt=""
                class="h-4 w-4 rounded-full object-cover"
              />
              <UiIcon v-else name="user" cls="h-3.5 w-3.5" />{{ pilotName }}
            </span>
          </div>
        </div>
        <div v-if="backAction" class="pb-3">
          <button
            type="button"
            class="rounded-lg border border-white/12 px-4 py-2 text-[12px] font-medium text-zinc-400 transition-colors hover:border-white/30 hover:text-zinc-100"
            @click="backAction()"
          >
            ← Back
          </button>
        </div>
      </header>

      <div
        v-if="invites.length && screen !== 'auth' && screen !== 'arena'"
        class="fixed top-4 left-1/2 z-50 w-full max-w-sm -translate-x-1/2 space-y-2 px-4"
      >
        <div
          v-for="inv in invites"
          :key="inv.id"
          class="panel flex items-center gap-3 p-3 shadow-2xl"
        >
          <div class="min-w-0 flex-1">
            <div class="truncate text-sm font-semibold text-zinc-100">
              {{ inv.fromName }} invited you
            </div>
            <div class="text-[11px] text-zinc-500">
              Room {{ inv.roomCode }} · {{ inv.mode === 'versus' ? 'Versus Duel' : 'Arcade Co-op' }}
            </div>
          </div>
          <button
            type="button"
            class="rounded-lg bg-accent px-3 py-1.5 text-[12px] font-semibold text-surface hover:bg-sky-300"
            @click="acceptInvite(inv)"
          >
            Join
          </button>
          <button
            type="button"
            class="rounded-lg border border-white/12 px-2.5 py-1.5 text-[12px] text-zinc-400 hover:border-white/30"
            @click="declineInvite(inv)"
          >
            ✕
          </button>
        </div>
        <p v-if="inviteError" class="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-[12px] text-danger">
          {{ inviteError }}
        </p>
      </div>

      <div
        v-if="toastNotifs.length && screen !== 'auth'"
        class="fixed top-16 left-4 z-50 w-full max-w-xs space-y-2"
      >
        <div
          v-for="n in toastNotifs"
          :key="n.id"
          class="panel flex items-start gap-3 border-l-2 p-3 shadow-2xl"
          :class="n.kind === 'best' ? 'border-l-accent' : 'border-l-repair'"
        >
          <span
            class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold"
            :class="n.kind === 'best' ? 'bg-accent/15 text-accent' : 'bg-repair/15 text-repair'"
          >
            {{ n.kind === 'best' ? '★' : '♥' }}
          </span>
          <div class="min-w-0 flex-1">
            <div class="truncate text-sm font-semibold text-zinc-100">{{ n.title }}</div>
            <div class="text-[12px] text-zinc-400">{{ n.body }}</div>
            <button
              v-if="n.target"
              type="button"
              class="mt-1 text-[12px] font-semibold text-accent hover:text-sky-300"
              @click="goNotif(n)"
            >
              View →
            </button>
          </div>
          <button
            type="button"
            class="shrink-0 rounded-md p-1 text-zinc-500 transition-colors hover:text-zinc-200"
            @click="dismissNotif(n.id)"
          >
            ✕
          </button>
        </div>
      </div>

      <div
        v-if="showNotifs && screen !== 'auth'"
        class="fixed top-16 right-4 z-50 w-full max-w-xs"
      >
        <div class="panel p-3 shadow-2xl">
          <div class="flex items-center justify-between px-1 pt-1 pb-2">
            <span class="text-sm font-semibold text-zinc-100">Notifications</span>
            <div class="flex items-center gap-3">
              <button
                v-if="notifs.length"
                type="button"
                class="text-[11px] font-medium text-zinc-500 transition-colors hover:text-zinc-200"
                @click="clearNotifs"
              >
                Clear
              </button>
              <button
                type="button"
                aria-label="Close notifications"
                class="rounded-md p-1 text-zinc-500 transition-colors hover:text-zinc-200"
                @click="showNotifs = false"
              >
                ✕
              </button>
            </div>
          </div>
          <div v-if="!notifs.length && !invites.length" class="px-1 py-4 text-center text-[13px] text-zinc-600">
            No notifications yet.
          </div>
          <div v-if="invites.length" class="mb-2 space-y-2">
            <div class="label px-1">Room invites ({{ invites.length }})</div>
            <div
              v-for="inv in invites"
              :key="inv.id"
              class="flex items-center gap-2.5 rounded-lg border border-accent/30 bg-accent/5 p-2.5"
            >
              <div class="min-w-0 flex-1">
                <div class="truncate text-sm font-semibold text-zinc-100">{{ inv.fromName }} invited you</div>
                <div class="text-[11px] text-zinc-500">
                  Room {{ inv.roomCode }} · {{ inv.mode === 'versus' ? 'Versus Duel' : 'Arcade Co-op' }}
                </div>
              </div>
              <button
                type="button"
                class="shrink-0 rounded-lg bg-accent px-3 py-1.5 text-[12px] font-semibold text-surface hover:bg-sky-300"
                @click="acceptInvite(inv)"
              >
                Join
              </button>
              <button
                type="button"
                aria-label="Decline invite"
                class="shrink-0 rounded-md p-1.5 text-zinc-400 transition-colors hover:text-zinc-200"
                @click="declineInvite(inv)"
              >
                ✕
              </button>
            </div>
          </div>
          <div v-if="notifs.length" class="max-h-80 space-y-2 overflow-y-auto">
            <div
              v-for="n in [...notifs].reverse()"
              :key="n.id"
              class="flex items-start gap-3 rounded-lg border border-white/10 bg-white/5 p-2.5"
            >
              <span
                class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold"
                :class="n.kind === 'best' ? 'bg-accent/15 text-accent' : 'bg-repair/15 text-repair'"
              >
                {{ n.kind === 'best' ? '★' : '♥' }}
              </span>
              <div class="min-w-0 flex-1">
                <div class="truncate text-sm font-semibold text-zinc-100">{{ n.title }}</div>
                <div class="text-[12px] text-zinc-400">{{ n.body }}</div>
                <button
                  v-if="n.target"
                  type="button"
                  class="mt-1 text-[12px] font-semibold text-accent hover:text-sky-300"
                  @click="goNotif(n)"
                >
                  View →
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div
        v-if="friendPending > 0 && screen !== 'auth' && screen !== 'arena' && screen !== 'friends'"
        class="fixed bottom-4 left-1/2 z-50 w-full max-w-sm -translate-x-1/2 px-4"
      >
        <button
          type="button"
          class="panel flex w-full items-center gap-3 p-3 text-left shadow-2xl transition-colors hover:border-accent/50"
          @click="screen = 'friends'"
        >
          <span class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent/15 text-sm font-bold text-accent">
            {{ friendPending }}
          </span>
          <span class="min-w-0 flex-1 text-sm font-semibold text-zinc-100">
            {{ friendPending === 1 ? '1 pilot wants to be friends' : `${friendPending} pilots want to be friends` }}
          </span>
          <span class="shrink-0 text-[12px] font-semibold text-accent">View →</span>
        </button>
      </div>

      <div v-if="!authReady" class="py-20 text-[13px] text-zinc-500">Contacting command…</div>

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
        @settings="screen = 'settings'"
        @profile="screen = 'profile'"
        @logout="onLogout"
      />

      <ProfileScreen
        v-else-if="screen === 'profile'"
        :uid="user?.uid ?? null"
        :pilot-name="pilotName"
        :email="user?.email ?? ''"
        :offline="offline"
        :best="best"
        :online="onlinePilots"
        @rename="onRename"
        @friends="screen = 'friends'"
        @back="screen = 'menu'"
      />

      <FriendsScreen
        v-else-if="screen === 'friends'"
        :uid="user?.uid ?? null"
        :pilot-name="pilotName"
        :photo="profilePhoto"
        :offline="offline"
        :online="onlinePilots"
        @back="screen = 'menu'"
      />

      <SettingsScreen
        v-else-if="screen === 'settings'"
        :settings="settings"
        :pilot-name="pilotName"
        :can-rename="canCloud"
        @toggle-mute="toggleMute(); sfx.setMuted(settings.muted); music.setMuted(settings.muted)"
        @toggle-music="toggleMusic(); music.setEnabled(settings.music)"
        @volume="(v) => { setVolume(v); sfx.setVolume(v); music.setVolume(v); }"
        @toggle-shake="toggleShake"
        @toggle-fps="toggleFps"
        @rename="onRename"
        @back="screen = 'menu'"
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
        ref="roomsRef"
        :key="roomCode || 'gate'"
        :uid="user.uid"
        :pilot-name="pilotName"
        :photo="profilePhoto"
        :rejoin-code="roomCode"
        @deploy="onDeploy"
        @back="roomCode = ''; screen = 'menu'"
      />

      <div v-else-if="screen === 'arena'" class="h-full w-full min-w-0 flex-1">
        <GameStage
          :key="runId"
          :character-id="selected"
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
  </div>
</template>
