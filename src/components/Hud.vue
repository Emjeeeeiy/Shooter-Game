<script setup>
import { computed } from 'vue';
import { BUFFS } from '../game/constants.js';

const props = defineProps({
  hud: { type: Object, required: true },
  fps: { type: Number, default: 0 },
  showFps: { type: Boolean, default: false },
});

const BUFF_COLOR = {
  SKILL: '#fbbf24',
  AMMO: '#38bdf8',
  MAGNET: '#a78bfa',
};

const BUFF_TEXT = {
  SKILL: 'text-skill',
  AMMO: 'text-accent',
  MAGNET: 'text-magnet',
};

const stats = computed(() => [
  { label: 'Score', value: props.hud.score.toLocaleString(), accent: true },
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
    <!-- Core stats -->
    <div
      v-for="stat in stats"
      :key="stat.label"
      class="rounded-xl px-3.5 py-2.5"
      style="background: rgba(8,8,12,0.75); border: 1px solid rgba(255,255,255,0.08); backdrop-filter: blur(12px);"
    >
      <div class="label text-[9px]" style="font-family: 'Rajdhani', sans-serif; letter-spacing: 0.22em;">{{ stat.label }}</div>
      <div
        class="font-display mt-0.5 text-lg font-bold leading-none tabular-nums"
        :class="stat.accent ? 'text-zinc-50' : 'text-zinc-200'"
        style="letter-spacing: 0.03em;"
      >
        {{ stat.value }}
      </div>
    </div>

    <!-- Combo multiplier -->
    <div
      v-if="hud.multiplier > 1"
      :key="hud.multiplier"
      class="animate-combo rounded-xl px-3.5 py-2.5"
      style="background: rgba(251,191,36,0.12); border: 1px solid rgba(251,191,36,0.3); backdrop-filter: blur(12px); box-shadow: 0 0 16px rgba(251,191,36,0.1);"
    >
      <div class="label text-[9px] text-skill/70" style="font-family: 'Rajdhani', sans-serif; letter-spacing: 0.22em;">Combo</div>
      <div class="font-display mt-0.5 text-lg font-bold leading-none text-skill tabular-nums" style="letter-spacing: 0.03em;">
        x{{ hud.multiplier }}
      </div>
      <div class="mt-2 h-0.5 w-full overflow-hidden rounded-full" style="background: rgba(251,191,36,0.15);">
        <div class="h-full rounded-full bg-skill" :style="{ width: hud.comboTimer * 100 + '%' }" />
      </div>
    </div>

    <!-- Boss indicator -->
    <div
      v-if="hud.bossActive"
      class="animate-combo rounded-xl px-3.5 py-2.5"
      style="background: rgba(244,114,182,0.12); border: 1px solid rgba(244,114,182,0.35); backdrop-filter: blur(12px); box-shadow: 0 0 20px rgba(244,114,182,0.12);"
    >
      <div class="label text-[9px] text-boss/70" style="font-family: 'Rajdhani', sans-serif; letter-spacing: 0.22em;">Warning</div>
      <div class="font-display mt-0.5 text-sm font-bold leading-none text-boss" style="letter-spacing: 0.08em;">BOSS</div>
    </div>

    <!-- Timer -->
    <div
      class="rounded-xl px-3.5 py-2.5"
      style="background: rgba(8,8,12,0.75); border: 1px solid rgba(255,255,255,0.08); backdrop-filter: blur(12px);"
    >
      <div class="label text-[9px]" style="font-family: 'Rajdhani', sans-serif; letter-spacing: 0.22em;">Time</div>
      <div class="font-display mt-0.5 text-sm font-semibold leading-none text-zinc-300 tabular-nums" style="letter-spacing: 0.03em;">
        {{ fmtTime(hud.timeSec) }}
      </div>
      <div v-if="showFps" class="mt-1 text-[10px] text-zinc-600 tabular-nums">{{ fps }} fps</div>
    </div>

    <!-- Active buff -->
    <div
      v-if="buff"
      class="overflow-hidden rounded-xl px-3.5 py-2.5"
      style="backdrop-filter: blur(12px);"
      :style="`background: ${BUFF_COLOR[hud.buff]}18; border: 1px solid ${BUFF_COLOR[hud.buff]}30; box-shadow: 0 0 12px ${BUFF_COLOR[hud.buff]}15;`"
    >
      <div class="label text-[9px]" :class="BUFF_TEXT[hud.buff]" style="font-family: 'Rajdhani', sans-serif; letter-spacing: 0.22em; opacity: 0.6;">Buff</div>
      <div class="font-display mt-0.5 text-sm font-bold leading-none" :class="BUFF_TEXT[hud.buff]" style="letter-spacing: 0.06em;">
        {{ buff.label }}
      </div>
      <div class="mt-2 h-0.5 w-full overflow-hidden rounded-full" style="background: rgba(255,255,255,0.08);">
        <div
          class="h-full rounded-full transition-[width] duration-100"
          :class="hud.buff === 'SKILL' ? 'bg-skill' : hud.buff === 'MAGNET' ? 'bg-magnet' : 'bg-accent'"
          :style="{ width: hud.buffRemaining * 100 + '%' }"
        />
      </div>
    </div>
  </div>
</template>
