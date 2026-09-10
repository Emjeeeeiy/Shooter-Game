<script setup>
import { computed, onMounted, onBeforeUnmount, ref, watch } from 'vue';
import { useGame } from '../composables/useGame.js';
import { useLeaderboard } from '../composables/useLeaderboard.js';
import { useSettings } from '../composables/useSettings.js';
import { energy as ENERGY } from '../game/constants.js';
import { sfx } from '../game/audio.js';
import { music } from '../game/music.js';
import { bumpCounter, updateLiveScore, useRoom as useRaceRoom } from '../composables/useRoom.js';
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
  doInject,
  doGift,
  setMinimapEl,
  onPointerMove,
  onPointerDown,
  setTouchMove,
  setTouchAim,
} = useGame(settings);

const { save, isBest } = useLeaderboard();

const willBeBest = computed(() => hud.gameOver && isBest(hud.finalScore));

function onSave(name) {
  save(name, hud.finalScore, hud.finalWave, hud.finalStats ?? {});
  emit('run-saved', { name, score: hud.finalScore, wave: hud.finalWave, stats: hud.finalStats ?? {} });
  hud.gameOver = false;
}

// --- multiplayer race: live score broadcast + final submit ------------------
let finishSent = false;
let lastLiveSent = 0;
let lastSentScore = -1;
let lastSentWave = -1;

watch(
  () => hud.running,
  (running) => {
    if (running) {
      finishSent = false;
      lastLiveSent = 0;
      lastSentScore = -1;
      lastSentWave = -1;
    }
  },
);

watch(
  () => hud.score,
  (score) => {
    if (!props.race || !hud.running || hud.gameOver) return;
    const now = Date.now();
    if (now - lastLiveSent < 3000) return;
    // Firestore bills per write — only broadcast actual changes.
    if (score === lastSentScore && hud.wave === lastSentWave) return;
    lastLiveSent = now;
    lastSentScore = score;
    lastSentWave = hud.wave;
    updateLiveScore(props.race.code, props.race.uid, {
      score,
      wave: hud.wave,
      name: props.race.name,
    }).catch(() => {});
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

onMounted(() => {
  syncAudio();
  window.addEventListener('neon:toggle-mute', onMuteEvent);
  setPilotName(props.pilotName);
  start(props.characterId, props.race?.seed, props.race?.mapId ?? props.mapId);
});
onBeforeUnmount(() => {
  window.removeEventListener('neon:toggle-mute', onMuteEvent);
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
        @click="togglePause"
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

      <TouchControls
        v-if="hud.running && !hud.paused && !hud.gameOver"
        @move="(x, y) => setTouchMove(x, y)"
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
        @resume="togglePause"
        @restart="() => start(props.characterId, props.race?.seed, props.race?.mapId ?? props.mapId)"
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
        @save="onSave"
        @restart="() => start(props.characterId, props.race?.seed, props.race?.mapId ?? props.mapId)"
        @lobby="onLobby"
        @standings="emit('room')"
      />
    </div>
  </div>
</template>
