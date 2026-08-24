<script setup>
import { onMounted, ref } from 'vue';
import { MINIMAP_SIZE } from '../game/constants.js';

// The engine draws straight to this canvas, so hand the element to the parent
// once it exists. Its backing store is sized by useGame (device pixel ratio).
const emit = defineEmits(['ready']);
const el = ref(null);

onMounted(() => emit('ready', el.value));
</script>

<template>
  <div class="panel overflow-hidden p-1">
    <canvas
      ref="el"
      class="block rounded-lg"
      :style="{ width: MINIMAP_SIZE + 'px', height: MINIMAP_SIZE + 'px' }"
    />
  </div>
</template>
