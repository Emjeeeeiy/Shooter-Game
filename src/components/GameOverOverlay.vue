<script setup>
import { computed, ref, watch } from 'vue';

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
  <div class="absolute inset-0 z-30 flex items-center justify-center overflow-y-auto bg-surface/70 backdrop-blur-md">
    <div class="panel-elevated my-4 w-full max-w-sm p-6 sm:p-7">
      <!-- Header: CRITICAL FAILURE -->
      <div class="flex items-center gap-2">
        <span class="h-1.5 w-1.5 rounded-full bg-danger" style="box-shadow: 0 0 6px rgba(251,113,133,0.8);" />
        <span class="font-ui text-[10px] font-semibold tracking-[0.22em] text-danger uppercase">Critical Failure</span>
        <span
          v-if="isBest && score > 0"
          class="font-ui ml-auto rounded-full px-2 py-0.5 text-[10px] font-bold tracking-widest text-skill uppercase"
          style="background: rgba(251,191,36,0.15); border: 1px solid rgba(251,191,36,0.25);"
        >
          ★ New Best
        </span>
      </div>

      <!-- GAME OVER heading -->
      <div class="mt-4">
        <div class="font-ui label">Final Score</div>
        <div
          class="font-display mt-1 text-5xl font-bold text-zinc-50 tabular-nums"
          style="letter-spacing: 0.04em;"
        >
          {{ props.score.toLocaleString() }}
        </div>
        <div class="font-ui mt-1.5 text-sm font-medium text-zinc-500">
          Reached wave <span class="font-bold text-zinc-300 tabular-nums">{{ props.wave }}</span>
        </div>
      </div>

      <!-- Stats row -->
      <div class="mt-5 grid grid-cols-4 gap-2 text-center">
        <div class="panel px-2 py-2.5">
          <div class="label text-[8px]">Kills</div>
          <div class="font-display mt-1 text-sm font-bold text-zinc-100 tabular-nums" style="letter-spacing: 0.02em;">{{ kills }}</div>
        </div>
        <div class="panel px-2 py-2.5">
          <div class="label text-[8px]">Time</div>
          <div class="font-display mt-1 text-sm font-bold text-zinc-100 tabular-nums" style="letter-spacing: 0.02em;">{{ fmtTime(timeSec) }}</div>
        </div>
        <div class="panel px-2 py-2.5">
          <div class="label text-[8px]">Acc</div>
          <div class="font-display mt-1 text-sm font-bold text-zinc-100 tabular-nums" style="letter-spacing: 0.02em;">{{ accuracy }}%</div>
        </div>
        <div class="panel px-2 py-2.5">
          <div class="label text-[8px]">Combo</div>
          <div class="font-display mt-1 text-sm font-bold text-skill tabular-nums" style="letter-spacing: 0.02em;">x{{ maxMult }}</div>
        </div>
      </div>

      <!-- Save form -->
      <form class="mt-6 space-y-2.5" @submit.prevent="save">
        <div class="flex items-center justify-between rounded-xl border border-white/8 bg-white/4 px-3.5 py-2.5">
          <span class="label text-[9px]">Pilot</span>
          <span class="font-ui max-w-[60%] truncate text-sm font-semibold text-zinc-100">{{ accountName }}</span>
        </div>
        <p class="font-ui text-[11px] font-medium text-zinc-600">
          Score saves to <span class="text-zinc-400">{{ accountName }}</span> — one entry per account, best score kept.
        </p>

        <div class="flex gap-2 pt-1.5">
          <button
            type="submit"
            :disabled="saved"
            class="font-ui flex-1 rounded-xl py-2.5 text-sm font-bold tracking-wider transition-all"
            :class="saved
              ? 'cursor-default bg-white/6 text-zinc-500'
              : 'bg-accent text-surface hover:brightness-110 active:scale-95'"
          >
            {{ saved ? '✓ Saved' : 'Save Score' }}
          </button>
          <button
            type="button"
            class="btn-ghost font-ui flex-1 py-2.5 text-sm font-bold tracking-wider"
            @click="$emit('restart')"
          >
            Retry
          </button>
        </div>
        <button
          v-if="race"
          type="button"
          class="font-ui mt-2 w-full rounded-xl py-2.5 text-sm font-bold tracking-wider text-skill transition-colors hover:bg-skill/20"
          style="background: rgba(251,191,36,0.1); border: 1px solid rgba(251,191,36,0.2);"
          @click="$emit('standings')"
        >
          Room Standings
        </button>
        <button
          type="button"
          class="font-ui mt-2 w-full rounded-xl border border-white/10 px-4 py-2 text-[13px] font-semibold text-zinc-400 transition-colors hover:border-white/25 hover:text-zinc-200"
          @click="$emit('lobby')"
        >
          ← Change Ship
        </button>
      </form>
    </div>
  </div>
</template>
