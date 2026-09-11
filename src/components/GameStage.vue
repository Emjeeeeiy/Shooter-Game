<script setup>
import { computed, onMounted, onBeforeUnmount, ref, watch } from 'vue';
import { useGame } from '../composables/useGame.js';
import { useLeaderboard } from '../composables/useLeaderboard.js';
import { useSettings } from '../composables/useSettings.js';
import { energy as ENERGY } from '../game/constants.js';
import { sfx } from '../game/audio.js';
import { music } from '../game/music.js';
import { bumpCounter, setRoomPause, updateLiveScore, useRoom as useRaceRoom } from '../composables/useRoom.js';
import AbilityBar from './AbilityBar.vue';
import Banner from './Banner.vue';
import GameOverOverlay from './GameOverOverlay.vue';
import Hud from './Hud.vue';
import Minimap from './Minimap.vue';
import PauseOverlay from './PauseOverlay.vue';
import RacePanel from './RacePanel.vue';
import StatBar from './StatBar.vue';
import TouchControls from './TouchControls.vue';

const props = defineProps({
  characterId: { type: String, default: 'vanguard' },
  pilotName: { type: String, default: 'Pilot' },
  uid: { type: String, default: null },
  mapId: { type: String, default: 'grid' },
  race: { type: Object, default: null }, // { code, uid, name, seed, mode, mapId }
});
const emit = defineEmits(['lobby', 'race-finish', 'room', 'run-saved']);

const { settings, toggleMute, toggleMusic } = useSettings();

const {
  hud,
  banner,
  notice,
  shake,
  fps,
  canvasRef,
  start,
  stop,
  togglePause,
  doDash,
  doMissiles,
  doShock,
  setFire,
  setPilotName,
  getSelf,
  setRivals,
  getFx,
  drainKills,
  applyRemoteKill,
  doInject,
  doGift,
  setMinimapEl,
  onPointerMove,
  onPointerDown,
  setTouchMove,
  setTouchAim,
  setTouchAimVector,
} = useGame(settings);

const { save, isBest } = useLeaderboard();

const willBeBest = computed(
  () => hud.gameOver && isBest(hud.finalScore, props.pilotName, props.uid ?? props.race?.uid ?? null),
);

function onSave() {
  // Save under the signed-in account: username + uid, one entry per account.
  const name = props.pilotName || props.race?.name || 'Pilot';
  const uid = props.uid ?? props.race?.uid ?? null;
  save(name, hud.finalScore, hud.finalWave, hud.finalStats ?? {}, uid);
  emit('run-saved', { name, score: hud.finalScore, wave: hud.finalWave, stats: hud.finalStats ?? {}, uid });
  // Keep the game-over overlay open so Retry / Change ship stay available.
}

// --- multiplayer race: live score broadcast + final submit ------------------
// One heartbeat drives every live field (position, angle, fx, firing, score,
// kills) so rival ghosts move smoothly and skill/basic-attack echoes land
// within one tick of happening, instead of waiting on the old score-only
// throttle. 450ms keeps it well short of Firestore's per-write cost mattering
// for a small squad while giving client-side dead reckoning enough samples
// to extrapolate smooth motion between them.
const LIVE_INTERVAL_MS = 450;
let finishSent = false;
let lastFxSent = -1;
let liveTimer = null;
let seenEids = new Set();

function flushLive() {
  if (!props.race || !hud.running || hud.paused || hud.gameOver) return;
  const self = getSelf();
  const payload = {
    score: hud.score,
    wave: hud.wave,
    name: props.race.name,
    ...self,
  };
  const fx = getFx();
  if (fx && Number.isInteger(fx.s) && fx.s !== lastFxSent) {
    payload.fx = { k: fx.k, s: fx.s, a: fx.a };
    lastFxSent = fx.s;
  }
  // Shared-swarm kills ride the same tick so mates drop their copy fast.
  const ko = drainKills();
  if (ko.length) {
    payload.kills = {};
    const now = Date.now();
    for (const id of ko) payload.kills[id] = now;
  }
  updateLiveScore(props.race.code, props.race.uid, payload).catch(() => {});
}

watch(
  () => hud.running,
  (running) => {
    if (running) {
      finishSent = false;
      lastFxSent = -1;
      seenEids = new Set();
      // Adopt a room-wide pause hold on (re)start so late joiners freeze too.
      // A stale hold of our own is released — a fresh run never starts frozen.
      const rp = raceRoom.value?.pause;
      if (props.race && rp?.by && rp.by !== props.race.uid) {
        pausedBy.value = rp.name ?? 'A pilot';
        if (!hud.paused) togglePause();
      } else {
        selfPause = false;
        pausedBy.value = '';
        if (props.race && rp?.by === props.race.uid) {
          setRoomPause(props.race.code, null).catch(() => {});
        }
      }
      if (!liveTimer) liveTimer = setInterval(flushLive, LIVE_INTERVAL_MS);
    } else if (liveTimer) {
      clearInterval(liveTimer);
      liveTimer = null;
    }
  },
);

watch(
  () => hud.gameOver,
  (over) => {
    if (over && props.race && !finishSent) {
      finishSent = true;
      emit('race-finish', {
        score: hud.finalScore,
        wave: hud.finalWave,
        stats: hud.finalStats ?? {},
      });
    }
  },
);

// --- versus sabotage / arcade gifts ------------------------------------------
const { room: raceRoom } = useRaceRoom(() => props.race?.code ?? '');
const lastMilestone = ref(0);
const lastIncoming = ref(0);
const lastGift = ref(0);

const rivalIds = computed(() => {
  if (!props.race) return [];
  return Object.keys(raceRoom.value?.members ?? {}).filter((id) => id !== props.race.uid);
});

// --- global match pause: one shared arena, so pausing pauses everyone -----
// Any pilot pausing writes the room hold; every client freezes. Any pilot
// resuming clears it for all (democratic — no one can grief-lock the room).
// NOTE: must live below the raceRoom declaration — watch getters evaluate
// once at setup and would hit the temporal dead zone otherwise.
const pausedBy = ref('');
let selfPause = false;

function onPauseButton() {
  if (!props.race) {
    togglePause();
    return;
  }
  togglePause();
  if (!hud.paused) {
    // Resuming always releases globally (even someone else's hold).
    selfPause = false;
    pausedBy.value = '';
    setRoomPause(props.race.code, null).catch(() => {});
  }
  // Pausing broadcasts via the hud.paused watcher below (covers P/Esc too).
}

watch(
  () => hud.paused,
  (paused) => {
    if (!props.race || !hud.running || hud.gameOver) return;
    if (paused && !selfPause && !pausedBy.value) {
      selfPause = true;
      setRoomPause(props.race.code, { by: props.race.uid, name: props.pilotName }).catch(() => {});
    }
    // Resume broadcasts happen in onPauseButton (covers remote holds too).
  },
);

watch(
  () => raceRoom.value?.pause,
  (p) => {
    if (!props.race || !hud.running || hud.gameOver) return;
    const me = props.race.uid;
    if (p?.by && p.by !== me) {
      pausedBy.value = p.name ?? 'A pilot';
      if (!hud.paused) togglePause();
    } else if (!p) {
      // Hold released (possibly by someone else) — unfreeze if we were held.
      if (hud.paused && (selfPause || pausedBy.value)) {
        selfPause = false;
        pausedBy.value = '';
        togglePause();
      }
    } else {
      pausedBy.value = ''; // own echo
    }
  },
);

// --- same-arena rivals: room mates appear as ghost ships ---------------------
// Both clients generate the identical seeded battlefield, so broadcast
// positions land in the right places. Ghosts are visual only.
watch(
  () => raceRoom.value?.live,
  (live) => {
    if (!props.race) return;
    const ghosts = [];
    for (const [id, s] of Object.entries(live ?? {})) {
      if (id === props.race.uid) continue;
      // Shared-swarm kills: drop our copy of anything a mate finished.
      if (s?.kills && typeof s.kills === 'object') {
        for (const eid of Object.keys(s.kills)) {
          if (!seenEids.has(eid)) {
            seenEids.add(eid);
            try {
              applyRemoteKill(eid);
            } catch {
              // ignore — already gone or match over
            }
          }
        }
      }
      if (s?.done) continue;
      if (!Number.isFinite(s?.x) || !Number.isFinite(s?.y)) continue;
      ghosts.push({ uid: id, x: s.x, y: s.y, a: s.a, name: s.name, ship: s.ship, fx: s.fx, firing: s.firing });
    }
    setRivals(ghosts);
  },
  { immediate: true },
);

// Versus: every 5 kills sends a charger at each rival.
watch(
  () => hud.kills,
  (kills) => {
    if (!props.race || props.race.mode !== 'versus' || !hud.running || hud.gameOver) return;
    const m = Math.floor((kills ?? 0) / 5);
    if (m <= lastMilestone.value) return;
    lastMilestone.value = m;
    for (const oid of rivalIds.value) {
      bumpCounter(props.race.code, oid, 'incoming').catch(() => {});
    }
  },
);

// Versus: absorb incoming sabotage as extra chargers.
watch(
  () => raceRoom.value?.live?.[props.race?.uid ?? '']?.incoming,
  (n) => {
    if (!props.race || props.race.mode !== 'versus') return;
    const count = Number(n) || 0;
    if (count <= lastIncoming.value) return;
    const diff = Math.min(3, count - lastIncoming.value);
    lastIncoming.value = count;
    doInject('CHARGER', diff);
  },
);

// Arcade: a boss kill (wave crossing a multiple of 5) gifts repairs to mates.
watch(
  () => hud.wave,
  (w, prev) => {
    if (!props.race || props.race.mode !== 'arcade') return;
    if (typeof prev === 'number' && prev % 5 === 0 && w > prev) {
      for (const tid of rivalIds.value) {
        bumpCounter(props.race.code, tid, 'gift').catch(() => {});
      }
    }
  },
);

// Arcade: absorb teammate gifts as repair drops.
watch(
  () => raceRoom.value?.live?.[props.race?.uid ?? '']?.gift,
  (n) => {
    if (!props.race || props.race.mode !== 'arcade') return;
    const count = Number(n) || 0;
    if (count <= lastGift.value) return;
    lastGift.value = count;
    doGift();
  },
);

function onLobby() {
  stop();
  emit('lobby');
}

// Landscape-only on phones: prompt to rotate + auto-pause while portrait.
const isPortraitPhone = ref(false);

// Touch controls: any coarse-pointer device (phones AND tablets, any size).
const isTouch = ref(false);
let coarseQuery = null;

function syncTouchCapable(e) {
  isTouch.value = e?.matches ?? window.matchMedia?.('(pointer: coarse)').matches ?? false;
}

function checkOrientation() {
  const coarse = window.matchMedia?.('(pointer: coarse)').matches ?? false;
  isPortraitPhone.value =
    coarse && window.innerWidth < 820 && window.innerHeight > window.innerWidth;
}

watch(isPortraitPhone, (portrait) => {
  if (portrait && hud.running && !hud.paused && !hud.gameOver) togglePause();
});

function syncAudio() {
  sfx.setMuted(settings.muted);
  sfx.setVolume(settings.volume);
  music.setMuted(settings.muted);
  music.setVolume(settings.volume);
  music.setEnabled(settings.music);
}

function onMuteEvent() {
  toggleMute();
  syncAudio();
}

function onToggleMusic() {
  toggleMusic();
  music.setEnabled(settings.music);
  sfx.play('click');
}

const syncWait = ref(0);
let syncTimer = null;
let syncClock = null;

function raceOpts() {
  return { race: !!props.race, mode: props.race?.mode };
}

function beginRun() {
  setPilotName(props.pilotName);
  start(props.characterId, props.race?.seed, props.race?.mapId ?? props.mapId, raceOpts());
  if (isPortraitPhone.value && hud.running && !hud.paused && !hud.gameOver) togglePause();
}

onMounted(() => {
  syncAudio();
  window.addEventListener('neon:toggle-mute', onMuteEvent);
  window.addEventListener('resize', checkOrientation);
  window.addEventListener('orientationchange', checkOrientation);
  checkOrientation();
  coarseQuery = window.matchMedia?.('(pointer: coarse)') ?? null;
  syncTouchCapable(coarseQuery);
  if (coarseQuery?.addEventListener) coarseQuery.addEventListener('change', syncTouchCapable);
  else coarseQuery?.addListener?.(syncTouchCapable);
  const gunDelay = (props.race?.startsAt ?? 0) - Date.now();
  if (props.race && gunDelay > 0) {
    // Synced room start: hold on the gun-time so every client ticks from
    // the same moment on the identical seeded arena.
    syncWait.value = Math.ceil(gunDelay / 1000);
    syncClock = setInterval(() => {
      const left = Math.max(0, Math.ceil(((props.race?.startsAt ?? 0) - Date.now()) / 1000));
      syncWait.value = left;
      if (left <= 0 && syncClock) {
        clearInterval(syncClock);
        syncClock = null;
      }
    }, 250);
    syncTimer = setTimeout(() => {
      syncWait.value = 0;
      beginRun();
    }, gunDelay);
  } else {
    beginRun();
  }
});
onBeforeUnmount(() => {
  if (coarseQuery?.removeEventListener) coarseQuery.removeEventListener('change', syncTouchCapable);
  else coarseQuery?.removeListener?.(syncTouchCapable);
  coarseQuery = null;  if (syncTimer) {
    clearTimeout(syncTimer);
    syncTimer = null;
  }
  if (syncClock) {
    clearInterval(syncClock);
    syncClock = null;
  }
  if (liveTimer) {
    clearInterval(liveTimer);
    liveTimer = null;
  }
  window.removeEventListener('neon:toggle-mute', onMuteEvent);
  window.removeEventListener('resize', checkOrientation);
  window.removeEventListener('orientationchange', checkOrientation);
});

// Touch aim: drag on the canvas aims; FIRE button holds fire.
function onTouchAimFire(e) {
  const canvas = canvasRef.value;
  if (!canvas) return;
  const t = e.changedTouches?.[0];
  if (t) setTouchAim(t.clientX, t.clientY);
}

const shakeClass = computed(() => {
  if (!shake.value) return '';
  if (shake.value === 'small') return 'animate-shake-small';
  if (shake.value === 'big') return 'animate-shake-big';
  return 'animate-shake';
});
</script>

<template>
  <div class="flex h-full w-full min-w-0 flex-col">
    <div class="flex items-center justify-between gap-3 px-4 py-2">
      <div class="flex min-w-0 items-center gap-2 text-[12px]">
        <span class="h-2 w-2 shrink-0 rounded-full" :style="{ background: hud.characterColor }" />
        <span class="truncate font-medium text-zinc-300">{{ hud.characterName }}</span>
        <span class="truncate text-zinc-500">· {{ pilotName }}</span>
      </div>
      <button
        v-if="hud.running && !hud.gameOver"
        type="button"
        class="panel shrink-0 px-3 py-1.5 text-[12px] font-medium text-zinc-400 transition-colors hover:text-zinc-100"
        @click="onPauseButton"
      >
        {{ hud.paused ? 'Resume' : 'Pause' }} <kbd class="ml-1">P</kbd>
      </button>
    </div>

    <div
      class="relative min-h-0 w-full flex-1 overflow-hidden bg-surface select-none"
      :class="shakeClass"
    >
      <canvas
        ref="canvasRef"
        class="absolute inset-0 h-full w-full cursor-crosshair touch-none"
        @mousemove="onPointerMove"
        @mousedown="onPointerDown"
        @touchmove.prevent="onTouchAimFire"
      />

      <!-- HUD layer: purely presentational, driven by the reactive `hud` mirror. -->
      <div class="pointer-events-none absolute inset-0">
        <div class="absolute top-4 left-4"><Hud :hud="hud" :fps="fps" :show-fps="settings.showFps" /></div>

        <div class="absolute top-4 right-4 hidden md:block">
          <Minimap @ready="setMinimapEl" />
        </div>

        <div class="absolute bottom-4 left-4 w-40 sm:w-48">
          <StatBar label="Integrity" :value="hud.health" :max="hud.maxHealth" tone="danger" />
        </div>

        <div class="absolute bottom-4 left-1/2 hidden -translate-x-1/2 sm:block">
          <AbilityBar :hud="hud" />
        </div>

        <div class="absolute right-4 bottom-4 w-32 sm:w-36">
          <StatBar
            label="Energy"
            :value="hud.energy"
            :max="ENERGY.max"
            tone="accent"
            align="right"
          />
        </div>

        <div v-if="race" class="absolute top-4 left-1/2 hidden -translate-x-1/2 lg:block">
          <RacePanel :code="race.code" :my-uid="race.uid" />
        </div>

        <Banner :banner="banner" :notice="notice" />
      </div>

      <div
        v-if="syncWait > 0"
        class="absolute inset-0 z-40 flex flex-col items-center justify-center gap-3 bg-surface/85 backdrop-blur-sm"
      >
        <div class="text-5xl font-semibold text-accent tabular-nums">{{ syncWait }}</div>
        <div class="text-sm font-medium text-zinc-300">Entering shared arena…</div>
        <p class="text-[12px] text-zinc-500">Synced start — same map, same waves.</p>
      </div>

      <TouchControls
        v-if="isTouch && hud.running && !hud.paused && !hud.gameOver"
        @move="(x, y) => setTouchMove(x, y)"
        @aim-fire="(dx, dy) => setTouchAimVector(dx, dy)"
        @fire="(held) => setFire(held)"
        @dash="doDash"
        @missiles="doMissiles"
        @shock="doShock"
      />

      <PauseOverlay
        v-if="hud.paused && !hud.gameOver"
        :score="hud.score"
        :wave="hud.wave"
        :music-on="settings.music"
        :paused-by="pausedBy"
        @resume="onPauseButton"
        @restart="() => start(props.characterId, props.race?.seed, props.race?.mapId ?? props.mapId, raceOpts())"
        @quit="onLobby"
        @toggle-music="onToggleMusic"
      />

      <GameOverOverlay
        v-else-if="hud.gameOver"
        :score="hud.finalScore"
        :wave="hud.finalWave"
        :stats="hud.finalStats"
        :is-best="willBeBest"
        :race="!!race"
        :pilot-name="pilotName"
        @save="onSave"
        @restart="() => start(props.characterId, props.race?.seed, props.race?.mapId ?? props.mapId, raceOpts())"
        @lobby="onLobby"
        @standings="emit('room')"
      />

      <div
        v-if="isPortraitPhone && hud.running && !hud.gameOver"
        class="absolute inset-0 z-40 flex flex-col items-center justify-center gap-3 bg-surface/90 p-6 text-center backdrop-blur-sm"
      >
        <svg
          class="h-10 w-10 text-accent"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <polyline points="23 4 23 10 17 10" />
          <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
        </svg>
        <div class="text-lg font-semibold text-zinc-100">Rotate your device</div>
        <p class="max-w-65 text-[13px] text-zinc-500">
          Neon Strike plays in landscape. Turn your phone sideways — your run is paused.
        </p>
      </div>
    </div>
  </div>
</template>
