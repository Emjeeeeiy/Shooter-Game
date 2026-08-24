<script setup>
import { computed } from 'vue';

const props = defineProps({
  label: { type: String, required: true },
  value: { type: Number, required: true },
  max: { type: Number, default: 100 },
  tone: { type: String, default: 'accent' },
  align: { type: String, default: 'left' },
});

const FILL = {
  accent: 'bg-accent',
  danger: 'bg-danger',
  skill: 'bg-skill',
};

const percent = computed(() => Math.max(0, Math.min(100, (props.value / props.max) * 100)));
const fill = computed(() => FILL[props.tone] ?? FILL.accent);
</script>

<template>
  <div :class="align === 'right' ? 'text-right' : 'text-left'">
    <div class="mb-1.5 flex items-baseline gap-2" :class="align === 'right' && 'justify-end'">
      <span class="label">{{ label }}</span>
      <span class="text-[11px] font-medium text-zinc-400 tabular-nums">
        {{ Math.round(value) }}
      </span>
    </div>
    <div class="h-1 w-full overflow-hidden rounded-full bg-white/10">
      <div
        class="h-full rounded-full transition-[width] duration-200 ease-out"
        :class="fill"
        :style="{ width: percent + '%' }"
      />
    </div>
  </div>
</template>
