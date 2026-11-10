<script setup>
// Template: Full-bleed stage: no top bar; touch-action none so the browser never pans, zooms or pull-to-refreshes mid-run.
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
import UiIcon from './UiIcon.vue';
import { useViewport } from '../composables/useViewport.js';

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

// Touch controls: the setting decides; 'auto' = touch-first device, or any
// touch seen on the stage (covers laptops with touchscreens).
const vp = useViewport();
const touchSeen = ref(false);
const touchOn = computed(
  () =>
    settings.touchControls === 'on' ||
    (settings.touchControls === 'auto' && (vp.coarse || touchSeen.value)),
);
// Phones play landscape only (App shows the rotate gate when upright); the
// portrait HUD remains for tablets held upright.
const hudMode = computed(() =>
  touchOn.value ? (vp.portrait ? 'touch-portrait' : 'touch-landscape') : 'desktop',
);
const showMap = ref(false); // upright tablets: minimap on demand

function onStageTouch() {
  touchSeen.value = true;
}

// Turning a phone upright mid-run pauses it (the rotate gate covers the
// stage). Rotating back leaves it paused until the player taps Resume.
function pauseIfUpright() {
  if (vp.portraitPhone && hud.running && !hud.paused && !hud.gameOver) togglePause();
}
watch(() => vp.portraitPhone, pauseIfUpright);

// Fullscreen is automatic on phones (first tap, see useAutoFullscreen) — no button here.

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
  pauseIfUpright();
}

onMounted(() => {
  syncAudio();
  window.addEventListener('neon:toggle-mute', onMuteEvent);
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
  if (syncTimer) {
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
});

// Dragging on open canvas (outside the sticks) aims at the finger.
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
  <div
    class="relative h-full w-full min-w-0 touch-none overflow-hidden bg-surface select-none [-webkit-touch-callout:none]"
    @touchstart.passive="onStageTouch"
  >
    <!-- Shake moves the world only — never the controls under your thumbs. -->
    <div class="absolute inset-0" :class="shakeClass">
      <canvas
        ref="canvasRef"
        class="absolute inset-0 h-full w-full cursor-crosshair"
        @mousemove="onPointerMove"
        @mousedown="onPointerDown"
        @touchmove.prevent="onTouchAimFire"
      />
    </div>

    <!-- HUD layer: presentational, driven by the reactive `hud` mirror. -->
    <div class="pointer-events-none absolute inset-0">
      <!-- ─── Desktop / keyboard + mouse ─────────────────────────────── -->
      <template v-if="hudMode === 'desktop'">
        <div class="hud-top hud-left absolute max-w-[calc(100%-13rem)]">
          <Hud :hud="hud" :fps="fps" :show-fps="settings.showFps" />
        </div>

        <div class="hud-top hud-right absolute flex flex-col items-end gap-2">
          <div class="pointer-events-auto flex gap-1.5">
            <button
              v-if="hud.running && !hud.gameOver"
              type="button"
              class="btn-icon bg-surface/70"
              :title="hud.paused ? 'Resume (P)' : 'Pause (P)'"
              :aria-label="hud.paused ? 'Resume' : 'Pause'"
              @click="onPauseButton"
            >
              <UiIcon :name="hud.paused ? 'play' : 'pause'" cls="h-4 w-4" />
            </button>
          </div>
          <Minimap v-if="!vp.compact" :width="150" @ready="setMinimapEl" />
          <RacePanel v-if="race" :code="race.code" :my-uid="race.uid" :compact="vp.compact" />
        </div>

        <div class="hud-bottom hud-left hud-right absolute flex flex-wrap items-end justify-between gap-3">
          <div class="w-40 lg:w-48">
            <StatBar label="Integrity" :value="hud.health" :max="hud.maxHealth" tone="danger" />
          </div>
          <div class="order-first flex w-full justify-center sm:order-0 sm:w-auto">
            <AbilityBar :hud="hud" />
          </div>
          <div class="w-32 lg:w-36">
            <StatBar label="Energy" :value="hud.energy" :max="ENERGY.max" tone="accent" align="right" />
          </div>
        </div>
      </template>

      <!-- ─── Touch, landscape ────────────────────────────────────────── -->
      <template v-else-if="hudMode === 'touch-landscape'">
        <div class="hud-top hud-left absolute flex max-w-[58%] flex-col items-start gap-1.5">
          <Hud :hud="hud" :fps="fps" :show-fps="settings.showFps" layout="strip" />
          <div class="grid w-60 grid-cols-2 gap-3 rounded-xl border border-white/10 bg-surface/60 px-3 py-1.5">
            <StatBar label="Integrity" :value="hud.health" :max="hud.maxHealth" tone="danger" compact />
            <StatBar label="Energy" :value="hud.energy" :max="ENERGY.max" tone="accent" compact />
          </div>
        </div>

        <div class="hud-top hud-right absolute flex flex-col items-end gap-1.5">
          <div class="pointer-events-auto flex gap-1.5">
            <button
              v-if="hud.running && !hud.gameOver"
              type="button"
              class="btn-icon bg-surface/70"
              aria-label="Pause"
              @click="onPauseButton"
            >
              <UiIcon name="pause" cls="h-4 w-4" />
            </button>
          </div>
          <RacePanel v-if="race" :code="race.code" :my-uid="race.uid" compact />
          <Minimap v-if="!vp.tiny" :width="112" @ready="setMinimapEl" />
        </div>
      </template>

      <!-- ─── Touch, portrait ─────────────────────────────────────────── -->
      <template v-else>
        <div class="hud-top hud-left hud-right absolute flex flex-col gap-1.5">
          <div class="flex items-start gap-2">
            <div class="min-w-0 flex-1">
              <Hud :hud="hud" :fps="fps" :show-fps="settings.showFps" layout="strip" />
            </div>
            <div class="pointer-events-auto flex shrink-0 gap-1.5">
              <button
                type="button"
                class="btn-icon bg-surface/70"
                :class="showMap ? 'btn-icon-active' : ''"
                :aria-label="showMap ? 'Hide minimap' : 'Show minimap'"
                :aria-pressed="showMap"
                @click="showMap = !showMap"
              >
                <UiIcon name="map" cls="h-4 w-4" />
              </button>
              <button
                v-if="hud.running && !hud.gameOver"
                type="button"
                class="btn-icon bg-surface/70"
                aria-label="Pause"
                @click="onPauseButton"
              >
                <UiIcon name="pause" cls="h-4 w-4" />
              </button>
            </div>
          </div>
          <div class="grid grid-cols-2 gap-3 rounded-xl border border-white/10 bg-surface/60 px-3 py-1.5">
            <StatBar label="Integrity" :value="hud.health" :max="hud.maxHealth" tone="danger" compact />
            <StatBar label="Energy" :value="hud.energy" :max="ENERGY.max" tone="accent" compact />
          </div>
          <div v-if="race || showMap" class="flex items-start justify-between gap-2">
            <RacePanel v-if="race" :code="race.code" :my-uid="race.uid" compact />
            <Minimap v-if="showMap" :width="132" class="ml-auto" @ready="setMinimapEl" />
          </div>
        </div>
      </template>

      <Banner :banner="banner" :notice="notice" />
    </div>

    <div
      v-if="syncWait > 0"
      class="absolute inset-0 z-40 flex flex-col items-center justify-center gap-3 bg-surface/85 px-6 text-center"
    >
      <div class="font-display text-5xl font-bold text-accent tabular-nums">{{ syncWait }}</div>
      <div class="text-sm font-semibold text-zinc-300">Entering shared arena…</div>
      <p class="text-[13px] text-zinc-500">Synced start — same map, same waves.</p>
    </div>

    <TouchControls
      v-if="touchOn && hud.running && !hud.paused && !hud.gameOver && syncWait <= 0"
      :hud="hud"
      :size="settings.controlSize"
      :left-handed="settings.leftHanded"
      :portrait="vp.portrait"
      @move="setTouchMove"
      @aim="setTouchAimVector"
      @fire="setFire"
      @dash="doDash"
      @missiles="doMissiles"
      @ult="doShock"
    />

    <PauseOverlay
      v-if="hud.paused && !hud.gameOver"
      :score="hud.score"
      :wave="hud.wave"
      :music-on="settings.music"
      :paused-by="pausedBy"
      :ship-name="hud.characterName"
      :ship-color="hud.characterColor"
      :pilot-name="pilotName"
      :touch="touchOn"
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
  </div>
</template>
