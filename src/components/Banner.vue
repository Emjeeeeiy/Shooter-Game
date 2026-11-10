<script setup>
defineProps({
  banner: { type: Object, default: null },
  notice: { type: Object, default: null },
});

const NOTICE_TONE = {
  skill: 'text-skill',
  ammo: 'text-accent',
  magnet: 'text-magnet',
  repair: 'text-repair',
  danger: 'text-danger',
  success: 'text-shock',
  muted: 'text-zinc-400',
};

const BANNER_TONE = {
  accent: 'text-zinc-100',
  danger: 'text-danger',
  success: 'text-shock',
};
</script>

<template>
  <div
    class="pointer-events-none absolute inset-x-0 top-[26%] flex flex-col items-center gap-2 px-6 text-center portrait:top-[22%] short:top-[20%]"
  >
    <div
      v-if="banner"
      :key="banner.id"
      class="font-display animate-banner text-xl font-bold tracking-[0.18em] uppercase short:text-lg roomy:text-3xl"
      :class="BANNER_TONE[banner.tone] ?? 'text-zinc-100'"
    >
      {{ banner.text }}
    </div>

    <div v-if="notice" :key="notice.id" class="animate-notice">
      <div
        class="font-ui text-sm font-bold tracking-[0.16em] uppercase"
        :class="NOTICE_TONE[notice.tone] ?? 'text-zinc-200'"
      >
        {{ notice.text }}
      </div>
      <div v-if="notice.note" class="mt-0.5 text-xs text-zinc-400">{{ notice.note }}</div>
    </div>
  </div>
</template>
