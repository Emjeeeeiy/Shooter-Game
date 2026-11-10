<script setup>
// Phones play in landscape, like a console game. While a phone is held
// upright this covers every screen. Android can jump straight to a
// fullscreen landscape lock; iOS has no API for that, so rotating is the way.
import { ref } from 'vue';
import { canFullscreen, enterLandscape } from '../composables/useOrientation.js';
import UiIcon from './UiIcon.vue';

const busy = ref(false);
const failed = ref(false);

async function goLandscape() {
  if (busy.value) return;
  busy.value = true;
  failed.value = !(await enterLandscape());
  busy.value = false;
}
</script>

<template>
  <div
    class="fixed inset-0 z-90 flex touch-none flex-col items-center justify-center gap-5 bg-surface px-8 pt-safe pb-safe text-center select-none"
    role="alertdialog"
    aria-modal="true"
    aria-labelledby="rotate-title"
    aria-describedby="rotate-desc"
  >
    <div class="rotate-hint relative flex h-24 w-24 items-center justify-center" aria-hidden="true">
      <div class="rotate-phone h-20 w-11 rounded-xl border-2 border-accent shadow-[0_0_24px_var(--color-accent-glow)]">
        <span class="mx-auto mt-1.5 block h-1 w-3 rounded-full bg-accent/60" />
      </div>
      <UiIcon name="refresh" cls="absolute -right-1 -bottom-1 h-6 w-6 text-accent/70" />
    </div>

    <div>
      <div class="label">Neon Strike</div>
      <h2 id="rotate-title" class="font-display mt-1 text-xl font-bold text-zinc-50">Rotate your device</h2>
      <p id="rotate-desc" class="mx-auto mt-2 max-w-64 text-sm text-zinc-400">
        Neon Strike plays in landscape. Turn your phone sideways to continue — a run in progress is paused.
      </p>
    </div>

    <button
      v-if="canFullscreen"
      type="button"
      class="btn-primary font-ui min-w-56 font-bold tracking-wider"
      :disabled="busy"
      @click="goLandscape"
    >
      <UiIcon :name="busy ? 'spinner' : 'maximize'" cls="h-4 w-4" />
      Play in landscape
    </button>
    <p v-if="failed" class="max-w-64 text-xs text-zinc-500">
      This browser can't rotate the screen for you — please turn your phone sideways.
    </p>
  </div>
</template>

<style scoped>
/* Phone tilts to landscape and back. */
.rotate-phone {
  animation: rotate-hint 2.4s ease-in-out infinite;
}

@keyframes rotate-hint {
  0%,
  20% {
    transform: rotate(0deg);
  }
  50%,
  75% {
    transform: rotate(-90deg);
  }
  100% {
    transform: rotate(0deg);
  }
}
</style>
