<script setup>
import { useGame } from '../composables/useGame.js';
import { useLeaderboard } from '../composables/useLeaderboard.js';
import { VIEW_HEIGHT, VIEW_WIDTH, energy as ENERGY, player as PLAYER } from '../game/constants.js';
import AbilityBar from './AbilityBar.vue';
import Banner from './Banner.vue';
import GameOverOverlay from './GameOverOverlay.vue';
import Hud from './Hud.vue';
import Minimap from './Minimap.vue';
import StartOverlay from './StartOverlay.vue';
import StatBar from './StatBar.vue';

const { hud, banner, notice, shaking, canvasRef, minimapRef, start, onPointerMove, onPointerDown } =
  useGame();

const { save } = useLeaderboard();

function onSave(name) {
  save(name, hud.finalScore, hud.finalWave);
  // Fall back to the briefing screen, matching the original flow.
  hud.gameOver = false;
}
</script>

<template>
  <div
    class="relative w-full max-w-[1200px] overflow-hidden rounded-2xl border border-white/10 bg-surface select-none"
    :class="shaking && 'animate-shake'"
    :style="{ aspectRatio: `${VIEW_WIDTH} / ${VIEW_HEIGHT}` }"
  >
    <canvas
      ref="canvasRef"
      class="absolute inset-0 h-full w-full cursor-crosshair"
      @mousemove="onPointerMove"
      @mousedown="onPointerDown"
    />

    <!-- HUD layer: purely presentational, driven by the reactive `hud` mirror. -->
    <div class="pointer-events-none absolute inset-0">
      <div class="absolute top-4 left-4"><Hud :hud="hud" /></div>

      <div class="absolute top-4 right-4 hidden md:block">
        <Minimap @ready="(el) => (minimapRef = el)" />
      </div>

      <div class="absolute bottom-4 left-4 w-48">
        <StatBar label="Integrity" :value="hud.health" :max="PLAYER.maxHealth" tone="danger" />
      </div>

      <div class="absolute bottom-4 left-1/2 hidden -translate-x-1/2 sm:block">
        <AbilityBar :hud="hud" />
      </div>

      <div class="absolute right-4 bottom-4 w-36">
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

    <StartOverlay v-if="!hud.running && !hud.gameOver" @start="start" />

    <GameOverOverlay
      v-else-if="hud.gameOver"
      :score="hud.finalScore"
      :wave="hud.finalWave"
      @save="onSave"
      @restart="start"
    />
  </div>
</template>
