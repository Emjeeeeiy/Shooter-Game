<script setup>
import { computed } from 'vue';

const props = defineProps({
  label: { type: String, required: true },
  value: { type: Number, required: true },
  max: { type: Number, default: 100 },
  tone: { type: String, default: 'accent' },
  align: { type: String, default: 'left' },
  /** Thinner, inline-labelled variant for touch HUDs. */
  compact: { type: Boolean, default: false },
});

const FILL = {
  accent: 'bg-accent',
  danger: 'bg-danger',
  skill: 'bg-skill',
};

const percent = computed(() => Math.max(0, Math.min(100, (props.value / props.max) * 100)));
const fill = computed(() => FILL[props.tone] ?? FILL.accent);
const low = computed(() => props.tone === 'danger' && percent.value <= 25);
</script>

<template>
  <div :class="align === 'right' ? 'text-right' : 'text-left'" role="meter" :aria-label="label" :aria-valuenow="Math.round(value)" aria-valuemin="0" :aria-valuemax="max">
    <div class="flex items-baseline gap-2" :class="[align === 'right' && 'justify-end', compact ? 'mb-1' : 'mb-1.5']">
      <span class="label">{{ label }}</span>
      <span class="text-[11px] font-semibold tabular-nums" :class="low ? 'text-danger' : 'text-zinc-300'">
        {{ Math.round(value) }}
      </span>
    </div>
    <div class="w-full overflow-hidden rounded-full bg-white/10" :class="compact ? 'h-1.5' : 'h-1'">
      <div
        class="h-full rounded-full transition-[width] duration-200 ease-out"
        :class="[fill, low ? 'animate-pulse' : '']"
        :style="{ width: percent + '%' }"
      />
    </div>
  </div>
</template>
