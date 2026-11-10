<script setup>
import { computed, ref, watch } from 'vue';
import UiIcon from './UiIcon.vue';

const props = defineProps({
  score: { type: Number, required: true },
  wave: { type: Number, required: true },
  stats: { type: Object, default: null },
  isBest: { type: Boolean, default: false },
  race: { type: Boolean, default: false },
  pilotName: { type: String, default: 'Pilot' },
});

const emit = defineEmits(['save', 'restart', 'lobby', 'standings']);

const saved = ref(false);

const accuracy = computed(() => props.stats?.accuracy ?? 0);
const kills = computed(() => props.stats?.kills ?? 0);
const timeSec = computed(() => props.stats?.timeSec ?? 0);
const maxMult = computed(() => props.stats?.maxMultiplier ?? 1);
const accountName = computed(() => (props.pilotName || 'Pilot').slice(0, 20));
const summary = computed(() => [
  { label: 'Kills', value: kills.value },
  { label: 'Time', value: fmtTime(timeSec.value) },
  { label: 'Acc', value: `${accuracy.value}%` },
  { label: 'Combo', value: `x${maxMult.value}`, tone: 'text-skill' },
]);

// Reset for the next run (overlay remounts on retry, but guard re-use too).
watch([() => props.score, () => props.wave], () => {
  saved.value = false;
});

function fmtTime(sec) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

function save() {
  if (saved.value) return;
  saved.value = true;
  emit('save', accountName.value);
}
</script>

<template>
  <div class="scroll-area absolute inset-0 z-30 bg-surface/75 backdrop-blur-md pointer-coarse:backdrop-blur-none">
    <div class="px-safe flex min-h-full items-center justify-center py-[max(1rem,var(--sat))]">
      <div
        class="panel-elevated grid w-full max-w-sm gap-5 p-5 short:max-w-2xl short:grid-cols-2 short:gap-5 short:p-4 roomy:p-7"
        role="dialog"
        aria-label="Game over"
      >
        <!-- Result -->
        <div class="min-w-0">
          <div class="flex items-center gap-2">
            <span class="h-1.5 w-1.5 rounded-full bg-danger" />
            <span class="font-ui text-[11px] font-semibold tracking-[0.22em] text-danger uppercase">Critical failure</span>
            <span
              v-if="isBest && score > 0"
              class="font-ui ml-auto inline-flex items-center gap-1 rounded-full border border-skill/25 bg-skill/15 px-2 py-0.5 text-[11px] font-bold tracking-widest text-skill uppercase"
            >
              <UiIcon name="star" cls="h-3 w-3" /> New best
            </span>
          </div>

          <div class="mt-3">
            <div class="label">Final score</div>
            <div class="font-display mt-1 truncate text-4xl font-bold text-zinc-50 tabular-nums short:text-3xl roomy:text-5xl">
              {{ props.score.toLocaleString() }}
            </div>
            <div class="font-ui mt-1 text-sm font-medium text-zinc-500">
              Reached wave <span class="font-bold text-zinc-300 tabular-nums">{{ props.wave }}</span>
            </div>
          </div>

          <div class="mt-4 grid grid-cols-4 gap-1.5 text-center">
            <div v-for="s in summary" :key="s.label" class="tile px-1 py-2">
              <div class="label text-[10px]">{{ s.label }}</div>
              <div class="font-display mt-1 text-sm font-bold tabular-nums" :class="s.tone ?? 'text-zinc-100'">{{ s.value }}</div>
            </div>
          </div>
        </div>

        <!-- Actions -->
        <form class="flex min-w-0 flex-col gap-2 short:justify-center" @submit.prevent="save">
          <div class="flex items-center justify-between gap-3 rounded-xl border border-white/8 bg-white/4 px-3.5 py-2">
            <span class="label">Pilot</span>
            <span class="font-ui truncate text-sm font-semibold text-zinc-100">{{ accountName }}</span>
          </div>
          <p class="text-xs text-zinc-500 short:hidden">One entry per account — your best score is kept.</p>

          <div class="flex gap-2">
            <button
              type="submit"
              :disabled="saved"
              class="font-ui flex-1 font-bold tracking-wider"
              :class="saved ? 'btn border border-white/10 text-zinc-500 disabled:opacity-100' : 'btn-primary'"
            >
              <UiIcon :name="saved ? 'check' : 'download'" cls="h-4 w-4" />
              {{ saved ? 'Saved' : 'Save score' }}
            </button>
            <button type="button" class="btn-ghost font-ui flex-1 font-bold tracking-wider" @click="$emit('restart')">
              <UiIcon name="refresh" cls="h-4 w-4" /> Retry
            </button>
          </div>
          <button
            v-if="race"
            type="button"
            class="btn font-ui w-full border border-skill/25 bg-skill/10 font-bold tracking-wider text-skill hover:bg-skill/20"
            @click="$emit('standings')"
          >
            <UiIcon name="trophy" cls="h-4 w-4" /> Room standings
          </button>
          <button type="button" class="btn-ghost w-full text-zinc-400" @click="$emit('lobby')">
            <UiIcon name="chevron-left" cls="h-4 w-4" /> Change ship
          </button>
        </form>
      </div>
    </div>
  </div>
</template>
