<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue';

// The engine draws straight to this canvas, so hand the element to the parent
// once it exists (and take it back on unmount so hidden maps cost nothing).
// The backing store is square (sized by useGame); showing it at the world's
// 3:2 aspect undoes the square projection, so the map is not stretched.
defineProps({
  /** Displayed width in CSS px; height follows the 3:2 world aspect. */
  width: { type: Number, default: 150 },
});
const emit = defineEmits(['ready']);
const el = ref(null);

onMounted(() => emit('ready', el.value));
onBeforeUnmount(() => emit('ready', null));
</script>

<template>
  <div class="overflow-hidden rounded-xl border border-white/10 bg-surface/70 p-1">
    <canvas ref="el" class="block rounded-lg" :style="{ width: width + 'px', height: Math.round((width * 2) / 3) + 'px' }" />
  </div>
</template>
