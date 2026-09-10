<script setup>
defineProps({
  id: { type: String, default: 'vanguard' },
  color: { type: String, default: '#38bdf8' },
});
</script>

<template>
  <svg viewBox="0 0 48 30" class="h-9 w-14 shrink-0" aria-hidden="true">
    <g :fill="color" fill-opacity="0.92">
      <polygon v-if="id === 'spectre'" points="46,15 16,20 10,24 13,15 10,6 16,10" />
      <polygon
        v-else-if="id === 'juggernaut'"
        points="37,15 29,4 11,1 6,9 6,21 11,29 29,26"
      />
      <g v-else-if="id === 'warden'">
        <circle cx="22" cy="15" r="9" />
        <circle cx="22" cy="3.5" r="3.4" />
        <circle cx="22" cy="26.5" r="3.4" />
        <polygon points="44,15 30,12 30,18" />
      </g>
      <polygon v-else points="44,15 11,28 16,15 11,2" />
    </g>
  </svg>
</template>
