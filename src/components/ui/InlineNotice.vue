<script setup>
defineProps({
  tone: { type: String, default: 'info' }, // 'info' | 'danger' | 'success'
});

const TONES = {
  info: 'border-white/8 bg-white/3 text-zinc-400',
  danger: 'border-danger/30 bg-danger/10 text-danger',
  success: 'border-repair/30 bg-repair/10 text-repair',
};
</script>

<template>
  <p class="rounded-xl border px-3.5 py-2.5 text-[13px] leading-snug" :class="TONES[tone] ?? TONES.info" role="status">
    <slot />
  </p>
</template>
