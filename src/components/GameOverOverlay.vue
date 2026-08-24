<script setup>
import { ref } from 'vue';

const props = defineProps({
  score: { type: Number, required: true },
  wave: { type: Number, required: true },
});

const emit = defineEmits(['save', 'restart']);

const name = ref('Pilot');
const saved = ref(false);

function save() {
  if (saved.value) return;
  saved.value = true;
  emit('save', name.value.trim() || 'Anonymous');
}
</script>

<template>
  <div class="absolute inset-0 z-30 flex items-center justify-center bg-surface/70 backdrop-blur-md">
    <div class="panel w-full max-w-sm p-6 sm:p-7">
      <div class="flex items-center gap-2">
        <span class="h-1.5 w-1.5 rounded-full bg-danger" />
        <span class="label text-danger">Critical failure</span>
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

      <form class="mt-6 space-y-2.5" @submit.prevent="save">
        <label class="label block" for="pilot">Pilot ID</label>
        <input
          id="pilot"
          v-model="name"
          type="text"
          maxlength="20"
          :disabled="saved"
          class="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:border-accent/60 focus:outline-none disabled:opacity-50"
          placeholder="Enter a name"
        />

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
      </form>
    </div>
  </div>
</template>
