<script setup>
import HowToPlay from './HowToPlay.vue';

defineEmits(['resume', 'restart', 'quit', 'toggle-music']);
defineProps({
  score: { type: Number, required: true },
  wave: { type: Number, required: true },
  musicOn: { type: Boolean, default: true },
});
</script>

<template>
  <div class="absolute inset-0 z-30 flex items-center justify-center overflow-y-auto bg-surface/70 backdrop-blur-md">
    <div class="panel m-4 grid w-full max-w-3xl gap-6 p-6 sm:p-7 md:grid-cols-[250px_minmax(0,1fr)]">
      <div>
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
          <button
            type="button"
            class="w-full rounded-lg border border-white/12 px-4 py-2 text-[12px] font-medium text-zinc-400 transition-colors hover:border-white/25 hover:text-zinc-100"
            @click="$emit('toggle-music')"
          >
            Music: {{ musicOn ? 'On' : 'Off' }}
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
              Lobby
            </button>
          </div>
        </div>

        <p class="mt-4 text-[11px] text-zinc-600">
          <kbd>Esc</kbd> / <kbd>P</kbd> to resume · <kbd>M</kbd> to mute
        </p>
      </div>

      <div class="min-w-0 border-t border-white/10 pt-5 md:border-t-0 md:border-l md:pt-0 md:pl-6">
        <HowToPlay bare />
      </div>
    </div>
  </div>
</template>
