<script setup>
import { computed } from 'vue';
import { BUFFS } from '../game/constants.js';

const props = defineProps({
  hud: { type: Object, required: true },
  fps: { type: Number, default: 0 },
  showFps: { type: Boolean, default: false },
});

const BUFF_TEXT = {
  SKILL: 'text-skill',
  AMMO: 'text-accent',
  MAGNET: 'text-magnet',
};

const stats = computed(() => [
  { label: 'Score', value: props.hud.score.toLocaleString() },
  { label: 'Wave', value: String(props.hud.wave).padStart(2, '0') },
  { label: 'Targets', value: String(props.hud.targets).padStart(2, '0') },
]);

const buff = computed(() => (props.hud.buff ? BUFFS[props.hud.buff] : null));

function fmtTime(sec) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}
</script>

<template>
  <div class="flex flex-wrap items-start gap-2">
    <div v-for="stat in stats" :key="stat.label" class="panel px-3 py-2">
      <div class="label">{{ stat.label }}</div>
      <div class="mt-0.5 text-lg leading-none font-semibold text-zinc-100 tabular-nums">
        {{ stat.value }}
      </div>
    </div>

    <div
      v-if="hud.multiplier > 1"
      :key="hud.multiplier"
      class="panel animate-combo border-skill/40 px-3 py-2"
    >
      <div class="label text-skill">Combo</div>
      <div class="mt-0.5 text-lg leading-none font-bold text-skill tabular-nums">
        x{{ hud.multiplier }}
      </div>
      <div class="mt-2 h-0.5 w-full overflow-hidden rounded-full bg-white/10">
        <div class="h-full rounded-full bg-skill" :style="{ width: hud.comboTimer * 100 + '%' }" />
      </div>
    </div>

    <div v-if="hud.bossActive" class="panel animate-combo border-boss/50 px-3 py-2">
      <div class="label text-boss">Boss</div>
      <div class="mt-0.5 text-sm leading-none font-bold text-boss">ENGAGED</div>
    </div>

    <div class="panel px-3 py-2">
      <div class="label">Time</div>
      <div class="mt-0.5 text-sm leading-none font-semibold text-zinc-300 tabular-nums">
        {{ fmtTime(hud.timeSec) }}
      </div>
      <div v-if="showFps" class="mt-1 text-[10px] text-zinc-500 tabular-nums">{{ fps }} fps</div>
    </div>

    <div v-if="buff" class="panel overflow-hidden px-3 py-2">
      <div class="label">Buff</div>
      <div class="mt-0.5 text-sm leading-none font-semibold" :class="BUFF_TEXT[hud.buff]">
        {{ buff.label }}
      </div>
      <div class="mt-2 h-0.5 w-full overflow-hidden rounded-full bg-white/10">
        <div
          class="h-full rounded-full"
          :class="hud.buff === 'SKILL' ? 'bg-skill' : hud.buff === 'MAGNET' ? 'bg-magnet' : 'bg-accent'"
          :style="{ width: hud.buffRemaining * 100 + '%' }"
        />
      </div>
    </div>
  </div>
</template>
