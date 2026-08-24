<script setup>
import { computed } from 'vue';
import { BUFFS } from '../game/constants.js';

const props = defineProps({
  hud: { type: Object, required: true },
});

const BUFF_TEXT = {
  SKILL: 'text-skill',
  AMMO: 'text-accent',
};

const stats = computed(() => [
  { label: 'Score', value: props.hud.score.toLocaleString() },
  { label: 'Wave', value: String(props.hud.wave).padStart(2, '0') },
  { label: 'Targets', value: String(props.hud.targets).padStart(2, '0') },
]);

const buff = computed(() => (props.hud.buff ? BUFFS[props.hud.buff] : null));
</script>

<template>
  <div class="flex flex-wrap items-start gap-2">
    <div v-for="stat in stats" :key="stat.label" class="panel px-3 py-2">
      <div class="label">{{ stat.label }}</div>
      <div class="mt-0.5 text-lg leading-none font-semibold text-zinc-100 tabular-nums">
        {{ stat.value }}
      </div>
    </div>

    <div v-if="buff" class="panel overflow-hidden px-3 py-2">
      <div class="label">Buff</div>
      <div class="mt-0.5 text-sm leading-none font-semibold" :class="BUFF_TEXT[hud.buff]">
        {{ buff.label }}
      </div>
      <div class="mt-2 h-0.5 w-full overflow-hidden rounded-full bg-white/10">
        <div
          class="h-full rounded-full"
          :class="hud.buff === 'SKILL' ? 'bg-skill' : 'bg-accent'"
          :style="{ width: hud.buffRemaining * 100 + '%' }"
        />
      </div>
    </div>
  </div>
</template>
