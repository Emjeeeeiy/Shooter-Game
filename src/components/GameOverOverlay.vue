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
    <div class="panel my-4 w-full max-w-sm p-6 sm:p-7">
      <div class="flex items-center gap-2">
        <span class="h-1.5 w-1.5 rounded-full bg-danger" />
        <span class="label text-danger">Critical failure</span>
        <span
          v-if="isBest && score > 0"
          class="ml-auto rounded-full bg-skill/15 px-2 py-0.5 text-[10px] font-bold tracking-widest text-skill uppercase"
        >
          New best
        </span>
      </div>

      <div class="mt-5">
        <div class="label">Final score</div>
        <div class="mt-1 text-4xl font-semibold text-zinc-50 tabular-nums">
          {{ props.score.toLocaleString() }}
        </div>
        <div class="mt-1.5 text-[13px] text-zinc-500">
          Reached wave <span class="text-zinc-300 tabular-nums">{{ props.wave }}</span>
        </div>
      </div>

      <div class="mt-4 grid grid-cols-4 gap-2 text-center">
        <div class="panel px-2 py-2">
          <div class="label">Kills</div>
          <div class="mt-1 text-sm font-semibold text-zinc-100 tabular-nums">{{ kills }}</div>
        </div>
        <div class="panel px-2 py-2">
          <div class="label">Time</div>
          <div class="mt-1 text-sm font-semibold text-zinc-100 tabular-nums">{{ fmtTime(timeSec) }}</div>
        </div>
        <div class="panel px-2 py-2">
          <div class="label">Acc</div>
          <div class="mt-1 text-sm font-semibold text-zinc-100 tabular-nums">{{ accuracy }}%</div>
        </div>
        <div class="panel px-2 py-2">
          <div class="label">Combo</div>
          <div class="mt-1 text-sm font-semibold text-skill tabular-nums">x{{ maxMult }}</div>
        </div>
      </div>

      <form class="mt-6 space-y-2.5" @submit.prevent="save">
        <div class="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 px-3 py-2">
          <span class="label">Pilot</span>
          <span class="max-w-[60%] truncate text-sm font-semibold text-zinc-100">{{ accountName }}</span>
        </div>
        <p class="text-[11px] text-zinc-600">
          Score saves to <span class="text-zinc-400">{{ accountName }}</span> — one entry per account, best score kept.
        </p>

        <div class="flex gap-2 pt-1.5">
          <button
            type="submit"
            :disabled="saved"
            class="flex-1 rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-surface transition-colors hover:bg-sky-300 disabled:cursor-default disabled:bg-white/10 disabled:text-zinc-500"
          >
            {{ saved ? 'Score saved' : 'Save score' }}
          </button>
          <button
            type="button"
            class="flex-1 rounded-lg border border-white/12 px-4 py-2.5 text-sm font-medium text-zinc-300 transition-colors hover:border-white/25 hover:text-zinc-100"
            @click="$emit('restart')"
          >
            Retry
          </button>
        </div>
        <button
          v-if="race"
          type="button"
          class="mt-2 w-full rounded-lg bg-skill/15 px-4 py-2.5 text-sm font-semibold text-skill transition-colors hover:bg-skill/25"
          @click="$emit('standings')"
        >
          Room standings
        </button>
        <button
          type="button"
          class="mt-2 w-full rounded-lg border border-white/12 px-4 py-2 text-[12px] font-medium text-zinc-400 transition-colors hover:border-white/30 hover:text-zinc-200"
          @click="$emit('lobby')"
        >
          ← Change ship
        </button>
      </form>
    </div>
  </div>
</template>
