<script setup>
defineProps({
  banner: { type: Object, default: null },
  notice: { type: Object, default: null },
});

const NOTICE_TONE = {
  skill: 'text-skill',
  ammo: 'text-accent',
  muted: 'text-zinc-400',
};
</script>

<template>
  <div
    class="pointer-events-none absolute inset-x-0 top-[26%] flex flex-col items-center gap-3 text-center"
  >
    <div
      v-if="banner"
      :key="banner.id"
      class="animate-banner text-3xl font-semibold tracking-[0.2em] text-zinc-100 uppercase"
    >
      {{ banner.text }}
    </div>

    <div v-if="notice" :key="notice.id" class="animate-notice">
      <div
        class="text-sm font-semibold tracking-[0.16em] uppercase"
        :class="NOTICE_TONE[notice.tone] ?? 'text-zinc-200'"
      >
        {{ notice.text }}
      </div>
      <div v-if="notice.note" class="mt-1 text-xs text-zinc-500">{{ notice.note }}</div>
    </div>
  </div>
</template>
