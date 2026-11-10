<script setup>
// Template: ─── Touch strip: one row, leaves the arena clear ───────────────────
import { computed } from 'vue';
import { BUFFS } from '../game/constants.js';

const props = defineProps({
  hud: { type: Object, required: true },
  fps: { type: Number, default: 0 },
  showFps: { type: Boolean, default: false },
  /** 'cards' (desktop) | 'strip' (touch: one compact row). */
  layout: { type: String, default: 'cards' },
});

const BUFF_TEXT = {
  SKILL: 'text-skill',
  AMMO: 'text-accent',
  MAGNET: 'text-magnet',
};
const BUFF_FILL = {
  SKILL: 'bg-skill',
  AMMO: 'bg-accent',
  MAGNET: 'bg-magnet',
};

const buff = computed(() => (props.hud.buff ? BUFFS[props.hud.buff] : null));
const score = computed(() => props.hud.score.toLocaleString());
const wave = computed(() => String(props.hud.wave).padStart(2, '0'));
const targets = computed(() => String(props.hud.targets).padStart(2, '0'));
const time = computed(() => {
  const sec = props.hud.timeSec;
  return `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(Math.floor(sec % 60)).padStart(2, '0')}`;
});
</script>

<template>
  <div v-if="layout === 'strip'" class="flex min-w-0 flex-wrap items-center gap-1.5">
    <div class="flex items-center gap-3 rounded-xl border border-white/10 bg-surface/70 px-3 py-1.5">
      <div>
        <div class="label text-[10px]">Score</div>
        <div class="font-display text-base leading-none font-bold text-zinc-50 tabular-nums">{{ score }}</div>
      </div>
      <div class="h-6 w-px bg-white/10" />
      <div>
        <div class="label text-[10px]">Wave</div>
        <div class="font-display text-base leading-none font-bold text-zinc-200 tabular-nums">{{ wave }}</div>
      </div>
      <div class="h-6 w-px bg-white/10" />
      <div>
        <div class="label text-[10px]">Time</div>
        <div class="font-display text-sm leading-none font-semibold text-zinc-300 tabular-nums">{{ time }}</div>
      </div>
      <div v-if="showFps" class="text-[10px] text-zinc-500 tabular-nums">{{ fps }}fps</div>
    </div>

    <div
      v-if="hud.multiplier > 1"
      :key="hud.multiplier"
      class="animate-combo rounded-xl border border-skill/30 bg-skill/12 px-2.5 py-1.5"
    >
      <div class="font-display text-base leading-none font-bold text-skill tabular-nums">x{{ hud.multiplier }}</div>
      <div class="mt-1 h-0.5 w-8 overflow-hidden rounded-full bg-skill/15">
        <div class="h-full rounded-full bg-skill" :style="{ width: hud.comboTimer * 100 + '%' }" />
      </div>
    </div>

    <div v-if="hud.bossActive" class="animate-combo rounded-xl border border-boss/35 bg-boss/12 px-2.5 py-2">
      <div class="font-display text-xs leading-none font-bold tracking-widest text-boss">BOSS</div>
    </div>

    <div v-if="buff" class="rounded-xl border border-white/10 bg-surface/70 px-2.5 py-1.5">
      <div class="font-display text-xs leading-none font-bold" :class="BUFF_TEXT[hud.buff]">{{ buff.label }}</div>
      <div class="mt-1 h-0.5 w-12 overflow-hidden rounded-full bg-white/10">
        <div class="h-full rounded-full" :class="BUFF_FILL[hud.buff]" :style="{ width: hud.buffRemaining * 100 + '%' }" />
      </div>
    </div>
  </div>

  <!-- ─── Desktop cards ────────────────────────────────────────────────── -->
  <div v-else class="flex flex-wrap items-start gap-2">
    <div class="rounded-xl border border-white/10 bg-surface/70 px-3.5 py-2.5">
      <div class="label">Score</div>
      <div class="font-display mt-0.5 text-lg leading-none font-bold text-zinc-50 tabular-nums">{{ score }}</div>
    </div>
    <div class="rounded-xl border border-white/10 bg-surface/70 px-3.5 py-2.5">
      <div class="label">Wave</div>
      <div class="font-display mt-0.5 text-lg leading-none font-bold text-zinc-200 tabular-nums">{{ wave }}</div>
    </div>
    <div class="rounded-xl border border-white/10 bg-surface/70 px-3.5 py-2.5">
      <div class="label">Targets</div>
      <div class="font-display mt-0.5 text-lg leading-none font-bold text-zinc-200 tabular-nums">{{ targets }}</div>
    </div>

    <div
      v-if="hud.multiplier > 1"
      :key="hud.multiplier"
      class="animate-combo rounded-xl border border-skill/30 bg-skill/12 px-3.5 py-2.5"
    >
      <div class="label text-skill/80">Combo</div>
      <div class="font-display mt-0.5 text-lg leading-none font-bold text-skill tabular-nums">x{{ hud.multiplier }}</div>
      <div class="mt-2 h-0.5 w-full overflow-hidden rounded-full bg-skill/15">
        <div class="h-full rounded-full bg-skill" :style="{ width: hud.comboTimer * 100 + '%' }" />
      </div>
    </div>

    <div v-if="hud.bossActive" class="animate-combo rounded-xl border border-boss/35 bg-boss/12 px-3.5 py-2.5">
      <div class="label text-boss/80">Warning</div>
      <div class="font-display mt-0.5 text-sm leading-none font-bold tracking-widest text-boss">BOSS</div>
    </div>

    <div class="rounded-xl border border-white/10 bg-surface/70 px-3.5 py-2.5">
      <div class="label">Time</div>
      <div class="font-display mt-0.5 text-sm leading-none font-semibold text-zinc-300 tabular-nums">{{ time }}</div>
      <div v-if="showFps" class="mt-1 text-[11px] text-zinc-500 tabular-nums">{{ fps }} fps</div>
    </div>

    <div v-if="buff" class="overflow-hidden rounded-xl border border-white/10 bg-surface/70 px-3.5 py-2.5">
      <div class="label" :class="BUFF_TEXT[hud.buff]">Buff</div>
      <div class="font-display mt-0.5 text-sm leading-none font-bold" :class="BUFF_TEXT[hud.buff]">{{ buff.label }}</div>
      <div class="mt-2 h-0.5 w-full overflow-hidden rounded-full bg-white/10">
        <div
          class="h-full rounded-full transition-[width] duration-100"
          :class="BUFF_FILL[hud.buff]"
          :style="{ width: hud.buffRemaining * 100 + '%' }"
        />
      </div>
    </div>
  </div>
</template>
