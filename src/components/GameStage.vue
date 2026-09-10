<script setup>
import { computed, onMounted, onBeforeUnmount } from 'vue';
import { useGame } from '../composables/useGame.js';
import { useLeaderboard } from '../composables/useLeaderboard.js';
import { useSettings } from '../composables/useSettings.js';
import { VIEW_HEIGHT, VIEW_WIDTH, energy as ENERGY, player as PLAYER } from '../game/constants.js';
import { sfx } from '../game/audio.js';
import AbilityBar from './AbilityBar.vue';
import Banner from './Banner.vue';
import GameOverOverlay from './GameOverOverlay.vue';
import Hud from './Hud.vue';
import Minimap from './Minimap.vue';
import PauseOverlay from './PauseOverlay.vue';
import SettingsPanel from './SettingsPanel.vue';
import StartOverlay from './StartOverlay.vue';
import StatBar from './StatBar.vue';
import TouchControls from './TouchControls.vue';

const { settings, toggleMute, setVolume, toggleShake, toggleFps } = useSettings();

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
  // Fall back to the briefing screen, matching the original flow.
  hud.gameOver = false;
}

function onQuitToBriefing() {
  stop();
  hud.gameOver = false;
}

function syncAudio() {
  sfx.setMuted(settings.muted);
  sfx.setVolume(settings.volume);
}

function onMuteEvent() {
  toggleMute();
  syncAudio();
}

onMounted(() => {
  syncAudio();
  window.addEventListener('neon:toggle-mute', onMuteEvent);
});
onBeforeUnmount(() => {
  window.removeEventListener('neon:toggle-mute', onMuteEvent);
});

function onVolume(v) {
  setVolume(v);
  syncAudio();
}
function onToggleMute() {
  toggleMute();
  syncAudio();
  sfx.play('click');
}

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
  <div class="w-full max-w-[1200px]">
    <div class="mb-3 flex items-center justify-between gap-3">
      <SettingsPanel
        :settings="settings"
        @toggle-mute="onToggleMute"
        @volume="onVolume"
        @toggle-shake="toggleShake"
        @toggle-fps="toggleFps"
      />
      <button
        v-if="hud.running && !hud.gameOver"
        type="button"
        class="panel px-3 py-2 text-[12px] font-medium text-zinc-400 transition-colors hover:text-zinc-100"
        @click="togglePause"
      >
        {{ hud.paused ? 'Resume' : 'Pause' }} <kbd class="ml-1">P</kbd>
      </button>
    </div>

    <div
      class="relative w-full overflow-hidden rounded-2xl border border-white/10 bg-surface select-none"
      :class="shakeClass"
      :style="{ aspectRatio: `${VIEW_WIDTH} / ${VIEW_HEIGHT}` }"
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
          <StatBar label="Integrity" :value="hud.health" :max="PLAYER.maxHealth" tone="danger" />
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

      <StartOverlay v-if="!hud.running && !hud.gameOver" @start="start" />

      <PauseOverlay
        v-else-if="hud.paused && !hud.gameOver"
        :score="hud.score"
        :wave="hud.wave"
        @resume="togglePause"
        @restart="start"
        @quit="onQuitToBriefing"
      />

      <GameOverOverlay
        v-else-if="hud.gameOver"
        :score="hud.finalScore"
        :wave="hud.finalWave"
        :stats="hud.finalStats"
        :is-best="willBeBest"
        @save="onSave"
        @restart="start"
      />
    </div>
  </div>
</template>
