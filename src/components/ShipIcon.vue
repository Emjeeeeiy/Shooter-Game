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
      <polygon v-if="id === 'phantom'" points="40,6 28,11 14,21 20,15 14,9 28,19" />
      <g v-else-if="id === 'bulwark'">
        <rect x="6" y="4" width="24" height="7" rx="1" />
        <rect x="6" y="19" width="24" height="7" rx="1" />
        <rect x="14" y="9" width="12" height="12" />
        <polygon points="26,9 40,15 26,21" />
      </g>
      <g v-else-if="id === 'hornet'">
        <polygon points="42,15 20,19 8,17 2,15 8,13 20,11" />
        <polygon points="24,14 8,26 16,13" />
        <polygon points="24,16 8,4 16,17" />
      </g>
      <polygon v-else-if="id === 'corsair'" points="44,15 22,19 6,28 12,15 6,2 22,11" />
      <polygon v-else-if="id === 'titan'" points="40,15 20,2 8,2 14,15 8,28 20,28" />
      <g v-else-if="id === 'oracle'">
        <circle cx="20" cy="15" r="9" />
        <polygon points="34,15 26,13 26,17" />
        <circle cx="20" cy="15" r="13" fill="none" :stroke="color" stroke-width="2" />
      </g>
      <polygon v-else points="44,15 11,28 16,15 11,2" />
    </g>
  </svg>
</template>
