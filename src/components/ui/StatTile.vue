<script setup>
defineProps({
  label: { type: String, required: true },
  value: { type: [String, Number], default: '—' },
  tone: { type: String, default: 'default' }, // 'default' | 'accent'
});
</script>

<template>
  <div
    class="min-w-0 rounded-xl border px-3 py-2.5 text-center"
    :class="tone === 'accent' ? 'border-accent/20 bg-accent/6' : 'border-white/7 bg-white/3'"
  >
    <div class="label truncate" :class="tone === 'accent' ? 'text-accent/70' : ''">{{ label }}</div>
    <div
      class="font-display mt-1 truncate text-lg leading-tight font-bold tabular-nums"
      :class="tone === 'accent' ? 'text-accent' : 'text-zinc-100'"
      style="letter-spacing: 0.02em"
    >
      {{ value }}
    </div>
  </div>
</template>
