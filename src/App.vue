<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import GameStage from './components/GameStage.vue';
import BattleBackground from './components/BattleBackground.vue';
import UiIcon from './components/UiIcon.vue';
import Lobby from './components/Lobby.vue';
import AuthScreen from './components/AuthScreen.vue';
import MainMenu from './components/MainMenu.vue';
import SettingsScreen from './components/SettingsScreen.vue';
import RoomsScreen from './components/RoomsScreen.vue';
import { CHARACTER_LIST } from './game/constants.js';
import { initAnalytics } from './game/firebase.js';
import { useAuth } from './composables/useAuth.js';
import { useSettings } from './composables/useSettings.js';
import { useCloudBoard } from './composables/useCloudBoard.js';
import { getRoom, joinRoom, leaveRoom, submitFinal } from './composables/useRoom.js';
import { useInvites, usePresence } from './composables/usePresence.js';
import { sfx } from './game/audio.js';
import { music } from './game/music.js';

// Screens: auth → menu → settings | lobby → arena | rooms → arena(race)
const screen = ref('auth');
const selected = ref('vanguard');
const mapPick = ref('grid');
const runMapId = ref('grid');
const runId = ref(0);
const roomsRef = ref(null);
const race = ref(null); // { code, uid, name, seed, mode } when racing
const roomCode = ref(''); // rejoin target for the rooms screen
const nameOverride = ref('');
const best = ref(0);

const { user, authReady, offline, logout, rename, backOnline } = useAuth();
const { settings, toggleMute, toggleMusic, setVolume, toggleShake, toggleFps } = useSettings();
const { submitScore, personalBest } = useCloudBoard();

// --- online presence + invites ------------------------------------------------
const presence = usePresence();
const inviteCtl = useInvites();
const invites = inviteCtl.invites;
const inviteError = ref('');
let unsubPresence = null;

watch(
  [user, offline],
  ([u, off]) => {
    if (unsubPresence) {
      unsubPresence();
      unsubPresence = null;
    }
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
    await joinRoom(inv.roomCode, user.value.uid, pilotName.value, selected.value);
    await inviteCtl.dismiss(user.value.uid, inv.id);
    roomCode.value = inv.roomCode;
    screen.value = 'rooms';
  } catch (e) {
    inviteError.value = e?.message ?? 'Could not join room.';
  }
}

async function declineInvite(inv) {
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
  rename(name)
    .then((clean) => {
      nameOverride.value = clean;
      if (user.value) presence.goOnline(user.value.uid, clean);
      done('Saved');
    })
    .catch((e) => done(e?.message ?? 'Could not save.'));
}

// --- single player ----------------------------------------------------------
// Header Back button: leaves the room first when inside one.
const backAction = computed(() => {
  if (screen.value === 'lobby' || screen.value === 'settings') {
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
  try {
    const r = await getRoom(code);
    if (r) {
      seed = r.seed ?? undefined;
      mode = r.mode ?? 'arcade';
      mapId = r.map ?? 'grid';
    }
  } catch {
    // room read failed — run unseeded on the classic map
  }
  race.value = { code, uid: user.value.uid, name: pilotName.value, seed, mode, mapId };
  runId.value += 1;
  screen.value = 'arena';
}

async function onRaceFinish({ score, wave, stats }) {
  if (!race.value) return;
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
  refreshBest();
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

async function onRunSaved({ name, score, wave, stats }) {
  if (race.value || !canCloud.value) return; // race runs submit via onRaceFinish
  try {
    await submitScore({ uid: user.value.uid, name, score, wave, stats });
    refreshBest();
  } catch {
    // offline / rules — local save already succeeded
  }
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
            <span
              v-if="user && !offline"
              class="hidden items-center gap-1.5 rounded-full border border-white/10 px-2.5 py-1 text-[11px] font-medium text-zinc-300 sm:flex"
            >
              <UiIcon name="user" cls="h-3.5 w-3.5" />{{ pilotName }}
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

      <div v-if="!authReady" class="py-20 text-[13px] text-zinc-500">Contacting command…</div>

      <AuthScreen v-else-if="screen === 'auth'" @authed="onAuthed" />

      <MainMenu
        v-else-if="screen === 'menu'"
        :pilot-name="pilotName"
        :email="user?.email ?? ''"
        :offline="offline"
        :best="best"
        :cloud="canCloud"
        @single="toLobby"
        @multi="toRooms"
        @settings="screen = 'settings'"
        @logout="onLogout"
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
        :rejoin-code="roomCode"
        @deploy="onDeploy"
        @back="roomCode = ''; screen = 'menu'"
      />

      <div v-else-if="screen === 'arena'" class="h-full w-full min-w-0 flex-1">
        <GameStage
          :key="runId"
          :character-id="selected"
          :pilot-name="pilotName"
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
