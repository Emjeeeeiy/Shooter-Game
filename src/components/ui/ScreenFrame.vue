<script setup>
/**
 * Full-height screen layout: title row → body (fills, never pushes the page)
 * → pinned action bar. The document never scrolls; if a body needs to, it
 * opts in with `scroll-area` on its own panel.
 */
import BackButton from './BackButton.vue';

defineProps({
  eyebrow: { type: String, default: '' },
  title: { type: String, default: '' },
  subtitle: { type: String, default: '' },
  back: { type: Boolean, default: false },
  backLabel: { type: String, default: 'Back' },
  /** Tailwind max-width class for the content column. */
  width: { type: String, default: 'max-w-5xl' },
});
defineEmits(['back']);
</script>

<template>
  <section class="px-safe mx-auto flex h-full min-h-0 w-full flex-col" :class="width">
    <header
      v-if="title || back || $slots.header"
      class="flex shrink-0 items-center gap-3 pt-3 pb-3 short:pt-2 short:pb-2 roomy:pt-6 roomy:pb-5"
    >
      <BackButton v-if="back" :label="backLabel" @click="$emit('back')" />
      <div class="min-w-0 flex-1">
        <div v-if="eyebrow" class="label truncate">{{ eyebrow }}</div>
        <h2
          v-if="title"
          class="font-display truncate text-lg leading-tight font-bold text-zinc-50 short:text-base roomy:text-2xl"
        >
          {{ title }}
        </h2>
        <p v-if="subtitle" class="mt-0.5 truncate text-[13px] text-zinc-500 short:hidden">{{ subtitle }}</p>
      </div>
      <slot name="header" />
    </header>

    <div class="relative flex min-h-0 flex-1 flex-col">
      <slot />
    </div>

    <footer
      v-if="$slots.actions"
      class="flex shrink-0 items-center gap-2 pt-3 pb-[max(0.75rem,var(--sab-c))] short:pt-2 roomy:pb-6"
    >
      <slot name="actions" />
    </footer>
  </section>
</template>
