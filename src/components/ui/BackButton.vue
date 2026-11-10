<script setup>
import UiIcon from '../UiIcon.vue';

defineProps({
  label: { type: String, default: 'Back' },
});
defineEmits(['click']);
</script>

<template>
  <button type="button" class="btn-ghost btn-sm shrink-0 gap-1 pr-3 pl-2" @click="$emit('click')">
    <UiIcon name="chevron-left" cls="h-4 w-4" />
    <span>{{ label }}</span>
  </button>
</template>
