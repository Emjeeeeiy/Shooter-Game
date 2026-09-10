<script setup>
import { onMounted, ref } from 'vue';
import { Game, createHudState } from '../game/engine.js';
import { WORLD_HEIGHT, WORLD_WIDTH, palette } from '../game/constants.js';

// True mini preview: runs the real obstacle generator with a fixed seed and
// draws the resulting layout to scale, plus the spawn point.
const props = defineProps({
  mapId: { type: String, default: 'grid' },
  seed: { type: Number, default: 7 },
});

const canvasRef = ref(null);

onMounted(() => {
  if (props.mapId === 'random') return;
  const canvas = canvasRef.value;
  if (!canvas) return;
  const game = new Game(createHudState(), () => {});
  game.srand(props.seed);
  game.setMap(props.mapId);
  game.generateObstacles();

  const ctx = canvas.getContext('2d');
  const W = canvas.width;
  const H = canvas.height;
  const s = Math.min(W / WORLD_WIDTH, H / WORLD_HEIGHT);
  const ox = (W - WORLD_WIDTH * s) / 2;
  const oy = (H - WORLD_HEIGHT * s) / 2;

  ctx.fillStyle = palette.surface;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = palette.obstacle;
  ctx.strokeStyle = palette.obstacleEdge;
  ctx.lineWidth = 1;
  for (const o of game.obstacles) {
    const x = ox + o.x * s;
    const y = oy + o.y * s;
    const w = Math.max(1, o.width * s);
    const h = Math.max(1, o.height * s);
    ctx.fillRect(x, y, w, h);
    ctx.strokeRect(x + 0.5, y + 0.5, Math.max(1, w - 1), Math.max(1, h - 1));
  }
  ctx.fillStyle = palette.accent;
  ctx.beginPath();
  ctx.arc(ox + (WORLD_WIDTH / 2) * s, oy + (WORLD_HEIGHT / 2) * s, 3, 0, Math.PI * 2);
  ctx.fill();
});
</script>

<template>
  <div
    v-if="mapId === 'random'"
    class="flex aspect-3/2 w-full items-center justify-center rounded-lg border border-dashed border-white/20 bg-white/3"
  >
    <span class="text-2xl font-bold text-accent">?</span>
  </div>
  <canvas
    v-else
    ref="canvasRef"
    width="360"
    height="240"
    class="block aspect-3/2 w-full rounded-lg border border-white/10"
  />
</template>
