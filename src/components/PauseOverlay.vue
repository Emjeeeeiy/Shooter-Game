<script setup>
defineEmits(['resume', 'restart', 'quit']);
defineProps({
  score: { type: Number, required: true },
  wave: { type: Number, required: true },
});
</script>

<template>
  <div class="absolute inset-0 z-30 flex items-center justify-center bg-surface/70 backdrop-blur-md">
    <div class="panel w-full max-w-sm p-6 sm:p-7">
      <div class="label">Paused</div>
      <h2 class="mt-1 text-2xl font-semibold text-zinc-50">Systems holding</h2>
      <p class="mt-2 text-[13px] text-zinc-500">
        Score <span class="text-zinc-200 tabular-nums">{{ score.toLocaleString() }}</span>
        · Wave <span class="text-zinc-200 tabular-nums">{{ wave }}</span>
      </p>

      <div class="mt-6 space-y-2">
        <button
          type="button"
          class="w-full rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-surface transition-colors hover:bg-sky-300 focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
          @click="$emit('resume')"
        >
          Resume <kbd class="ml-1 border-black/20 bg-black/10 text-surface">P</kbd>
        </button>
        <div class="flex gap-2">
          <button
            type="button"
            class="flex-1 rounded-lg border border-white/12 px-4 py-2.5 text-sm font-medium text-zinc-300 transition-colors hover:border-white/25 hover:text-zinc-100"
            @click="$emit('restart')"
          >
            Restart
          </button>
          <button
            type="button"
            class="flex-1 rounded-lg border border-white/12 px-4 py-2.5 text-sm font-medium text-zinc-500 transition-colors hover:border-white/25 hover:text-zinc-100"
            @click="$emit('quit')"
          >
            Briefing
          </button>
        </div>
      </div>

      <p class="mt-4 text-center text-[11px] text-zinc-600">
        <kbd>Esc</kbd> / <kbd>P</kbd> to resume · <kbd>M</kbd> to mute
      </p>
    </div>
  </div>
</template>
