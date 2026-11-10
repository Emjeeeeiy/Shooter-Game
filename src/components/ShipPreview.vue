<script setup>
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { drawShipDetails, setCanvasTheme, traceShip } from '../game/renderer.js';

// Hangar preview drawn with the exact same path code as the in-game ship,
// so selection always matches what you fly.
const props = defineProps({
  id: { type: String, default: 'vanguard' },
  color: { type: String, default: '#38bdf8' },
  /** Display width; the 8:5 aspect is kept. */
  cls: { type: String, default: 'w-14' },
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
  setCanvasTheme(document.documentElement.classList.contains('light'));
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

let observer = null;
onMounted(() => {
  render();
  // Repaint when the theme flips (outline colours differ per theme).
  observer = new MutationObserver(render);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
});
onBeforeUnmount(() => observer?.disconnect());
watch(() => [props.id, props.color], render);
</script>

<template>
  <canvas ref="canvasRef" class="block aspect-[8/5] h-auto shrink-0" :class="cls" />
</template>
