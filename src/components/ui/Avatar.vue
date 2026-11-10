<script setup>
import { computed } from 'vue';

const props = defineProps({
  photo: { type: String, default: '' },
  name: { type: String, default: 'P' },
  /** xs 24 · sm 32 · md 40 · lg 56 · xl 72 */
  size: { type: String, default: 'md' },
  square: { type: Boolean, default: false },
  /** null hides the status dot; true/false shows online/offline. */
  online: { type: Boolean, default: null },
});

const SIZES = {
  xs: 'h-6 w-6 text-[11px]',
  sm: 'h-8 w-8 text-[13px]',
  md: 'h-10 w-10 text-sm',
  lg: 'h-14 w-14 text-xl',
  xl: 'h-18 w-18 text-2xl',
};

const box = computed(() => SIZES[props.size] ?? SIZES.md);
const shape = computed(() => (props.square ? 'rounded-2xl' : 'rounded-full'));
const initial = computed(() => (props.name || 'P').trim().charAt(0).toUpperCase() || 'P');
const dot = computed(() => (props.size === 'xs' || props.size === 'sm' ? 'h-2.5 w-2.5' : 'h-3.5 w-3.5'));
</script>

<template>
  <span class="relative inline-flex shrink-0">
    <img
      v-if="photo"
      :src="photo"
      alt=""
      class="border border-accent/30 object-cover"
      :class="[box, shape]"
    />
    <span
      v-else
      class="font-display inline-flex items-center justify-center border border-accent/25 bg-accent/12 font-bold text-accent"
      :class="[box, shape]"
      aria-hidden="true"
    >
      {{ initial }}
    </span>
    <span
      v-if="online !== null"
      class="absolute -right-0.5 -bottom-0.5 rounded-full border-2 border-surface"
      :class="[dot, online ? 'bg-repair' : 'bg-zinc-600']"
      :title="online ? 'Online' : 'Offline'"
    />
  </span>
</template>
