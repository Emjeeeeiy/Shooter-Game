<script setup>
// Template: The document never scrolls: header → page → (phone) tab bar, all inside one viewport.
import { computed, onMounted, ref, watch } from 'vue';
import GameStage from './components/GameStage.vue';
import BattleBackground from './components/BattleBackground.vue';
import AppHeader from './components/AppHeader.vue';
import RotateGate from './components/RotateGate.vue';
import NotificationLayer from './components/NotificationLayer.vue';
import Leaderboard from './components/Leaderboard.vue';
import Sheet from './components/ui/Sheet.vue';
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
import { useViewport } from './composables/useViewport.js';
import { enterLandscape, exitFullscreen, useAutoFullscreen } from './composables/useOrientation.js';
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
const { settings, toggleMute, toggleMusic, setVolume, toggleShake, toggleFps, setTheme, setPref } = useSettings();
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

// Secondary pages (ranks / profile / friends / settings) open in a Sheet over
// the current page — closing one returns to exactly where you were (even
// mid-room). Full screen on phones, a dialog on bigger screens.
const overlay = ref(null);
const vp = useViewport();
const authed = computed(() => authReady.value && (!!user.value || offline.value));
const OVERLAY_META = {
  ranks: { eyebrow: 'Leaderboard', title: 'Top Pilots' },
  profile: { eyebrow: 'Pilot', title: 'Profile' },
  friends: { eyebrow: 'Squadron', title: 'Friends' },
  settings: { eyebrow: 'Configuration', title: 'Settings' },
};
const overlayMeta = computed(() => OVERLAY_META[overlay.value] ?? { eyebrow: '', title: '' });

// Settings switches; the fullscreen one also acts at once (the tap is a valid gesture).
function onSetPref(key, value) {
  setPref(key, value);
  if (key !== 'autoFullscreen') return;
  if (value) enterLandscape();
  else exitFullscreen();
}

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
  // Phones: the first tap on any screen enters fullscreen (browsers need a gesture).
  useAutoFullscreen(() => settings.autoFullscreen && vp.coarse && vp.compact);
  // Sheets close themselves on Escape; this only handles the notification panel.
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && showNotifs.value) showNotifs.value = false;
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

// Changing screens closes any open sheet (tab pages belong to the hub).
watch(screen, () => {
  overlay.value = null;
  showNotifs.value = false;
});

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
  <div class="relative flex h-dvh w-full flex-col overflow-hidden">
    <BattleBackground v-if="screen !== 'arena'" :paused="!!overlay || vp.portraitPhone" />

    <AppHeader
      v-if="screen !== 'arena'"
      :theme="settings.theme"
      :authed="authed"
      :can-cloud="canCloud"
      :bell-count="bellCount"
      :friend-pending="friendPending"
      :show-notifs="showNotifs"
      :overlay="overlay"
      :photo="profilePhoto"
      :pilot-name="pilotName"
      :show-name="!!user && !offline"
      :compact="vp.compact"
      @theme="setTheme"
      @bell="toggleNotifs"
      @open="openOverlay"
    />

    <div class="relative z-10 flex min-h-0 flex-1 flex-col">
      <main class="relative flex min-h-0 min-w-0 flex-1 flex-col">
        <Transition name="screen" mode="out-in">
          <div v-if="!authReady" key="loading" class="flex h-full items-center justify-center text-[13px] text-zinc-500">
            Contacting command…
          </div>

          <AuthScreen v-else-if="screen === 'auth'" key="auth" @authed="onAuthed" />

          <MainMenu
            v-else-if="screen === 'menu'"
            key="menu"
            :pilot-name="pilotName"
            :email="user?.email ?? ''"
            :offline="offline"
            :best="best"
            :cloud="canCloud"
            :photo="profilePhoto"
            :compact="vp.compact"
            @single="toLobby"
            @multi="toRooms"
            @ranks="openOverlay('ranks')"
            @logout="onLogout"
          />

          <Lobby
            v-else-if="screen === 'lobby'"
            key="lobby"
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

          <GameStage
            v-else-if="screen === 'arena'"
            :key="`run-${runId}`"
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
        </Transition>

        <!-- ─── Secondary pages: full-screen sheets on phones, dialogs elsewhere ── -->
        <Sheet
          :open="!!overlay && screen !== 'auth' && screen !== 'arena'"
          :flush="overlay === 'ranks' || overlay === 'friends'"
          :eyebrow="overlayMeta.eyebrow"
          :title="overlayMeta.title"
          :width="overlay === 'ranks' ? 'roomy:max-w-2xl' : 'roomy:max-w-lg'"
          @close="closeOverlay"
        >
          <Leaderboard v-if="overlay === 'ranks'" :cloud="canCloud" bare />

          <ProfileScreen
            v-else-if="overlay === 'profile'"
            :uid="user?.uid ?? null"
            :pilot-name="pilotName"
            :email="user?.email ?? ''"
            :offline="offline"
            :best="best"
            :online="onlinePilots"
            @rename="onRename"
            @friends="overlay = 'friends'"
            @logout="onLogout"
          />

          <FriendsScreen
            v-else-if="overlay === 'friends'"
            :uid="user?.uid ?? null"
            :pilot-name="pilotName"
            :photo="profilePhoto"
            :offline="offline"
            :online="onlinePilots"
          />

          <SettingsScreen
            v-else-if="overlay === 'settings'"
            :settings="settings"
            @toggle-mute="toggleMute(); sfx.setMuted(settings.muted); music.setMuted(settings.muted)"
            @toggle-music="toggleMusic(); music.setEnabled(settings.music)"
            @volume="(v) => { setVolume(v); sfx.setVolume(v); music.setVolume(v); }"
            @toggle-shake="toggleShake"
            @toggle-fps="toggleFps"
            @theme="setTheme"
            @set="onSetPref"
          />
        </Sheet>
      </main>
    </div>

    <NotificationLayer
      v-if="screen !== 'arena'"
      :invites="screen !== 'auth' ? invites : []"
      :invite-error="inviteError"
      :toasts="screen !== 'auth' ? toastNotifs : []"
      :notifs="notifs"
      :show-panel="showNotifs && screen !== 'auth'"
      :nudge-count="!vp.compact && screen !== 'auth' && overlay !== 'friends' ? friendPending : 0"
      @accept="acceptInvite"
      @decline="declineInvite"
      @dismiss="dismissNotif"
      @go="goNotif"
      @clear="clearNotifs"
      @close="showNotifs = false"
      @nudge="openOverlay('friends')"
    />

    <!-- Phones play landscape only: covers every screen while held upright. -->
    <RotateGate v-if="vp.portraitPhone" />
  </div>
</template>
