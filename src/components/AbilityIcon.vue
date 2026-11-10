<script setup>
// Ability glyphs shared by the desktop ability bar and the touch buttons.
defineProps({
  name: { type: String, required: true }, // 'dash' | 'missile' | 'ult'
  cls: { type: String, default: 'h-4 w-4' },
});
</script>

<template>
  <svg
    :class="cls"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.8"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <template v-if="name === 'dash'">
      <path d="M5 5l6 7-6 7" />
      <path d="M13 5l6 7-6 7" />
    </template>
    <template v-else-if="name === 'missile'">
      <path d="M3 5h7m0 0-2.5-2.5M10 5 7.5 7.5" />
      <path d="M3 12h13m0 0-3-3M16 12l-3 3" />
      <path d="M3 19h7m0 0-2.5-2.5M10 19l-2.5 2.5" />
    </template>
    <template v-else>
      <circle cx="12" cy="12" r="2.5" />
      <circle cx="12" cy="12" r="6.5" opacity="0.65" />
      <circle cx="12" cy="12" r="10.5" opacity="0.35" />
    </template>
  </svg>
</template>
