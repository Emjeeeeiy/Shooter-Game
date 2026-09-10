<script setup>
import { onMounted, ref, watch } from 'vue';
import { drawShipDetails, traceShip } from '../game/renderer.js';

// Hangar preview drawn with the exact same path code as the in-game ship,
// so selection always matches what you fly.
const props = defineProps({
  id: { type: String, default: 'vanguard' },
  color: { type: String, default: '#38bdf8' },
});

const canvasRef = ref(null);

function render() {
  const canvas = canvasRef.value;
  if (!canvas) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const W = 96;
  const H = 60;
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, W, H);
  ctx.save();
  ctx.translate(W / 2, H / 2);
  ctx.shadowColor = props.color;
  ctx.shadowBlur = 8;
  ctx.fillStyle = props.color;
  traceShip(ctx, props.id);
  ctx.fill();
  ctx.shadowBlur = 0;
  drawShipDetails(ctx, props.id, props.color);
  ctx.restore();
}

onMounted(render);
watch(() => [props.id, props.color], render);
</script>

<template>
  <canvas ref="canvasRef" class="h-9 w-14 shrink-0" style="width: 56px; height: 36px" />
</template>
