<script setup>
import { ref } from 'vue';
import HowToPlay from './HowToPlay.vue';
import SegTabs from './ui/SegTabs.vue';
import UiIcon from './UiIcon.vue';

const props = defineProps({
  score: { type: Number, required: true },
  wave: { type: Number, required: true },
  musicOn: { type: Boolean, default: true },
  pausedBy: { type: String, default: '' },
  shipName: { type: String, default: '' },
  shipColor: { type: String, default: '' },
  pilotName: { type: String, default: '' },
  touch: { type: Boolean, default: false },
});
defineEmits(['resume', 'restart', 'quit', 'toggle-music']);

const helpMode = ref(props.touch ? 'touch' : 'keyboard');
const showHelp = ref(false);
const HELP_TABS = [
  { value: 'touch', label: 'Touch', icon: 'device' },
  { value: 'keyboard', label: 'Keyboard', icon: 'gamepad' },
];
</script>

<template>
  <div class="scroll-area absolute inset-0 z-30 bg-surface/80 backdrop-blur-md pointer-coarse:backdrop-blur-none">
    <div class="px-safe flex min-h-full items-center justify-center py-[max(1rem,var(--sat))]">
      <div
        class="panel-elevated grid w-full max-w-md gap-5 p-5 short:h-[calc(100dvh-2rem)] short:max-w-3xl short:grid-cols-[minmax(0,15rem)_minmax(0,1fr)] short:grid-rows-[minmax(0,1fr)] short:gap-4 short:p-4 roomy:h-[min(40rem,calc(100dvh-3rem))] roomy:max-w-3xl roomy:grid-cols-[16rem_minmax(0,1fr)] roomy:grid-rows-[minmax(0,1fr)] roomy:p-7"
        role="dialog"
        aria-label="Paused"
      >
        <!-- Actions -->
        <div class="flex min-h-0 flex-col">
          <div class="label">Paused</div>
          <h2 class="font-display mt-1 text-xl font-bold text-zinc-50 roomy:text-2xl">SYSTEMS HOLDING</h2>
          <div class="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-zinc-500">
            <span v-if="shipName" class="inline-flex items-center gap-1.5">
              <span class="h-2 w-2 rounded-full" :style="{ background: shipColor }" />
              <span class="font-semibold text-zinc-300">{{ shipName }}</span>
            </span>
            <span>Score <span class="font-bold text-zinc-200 tabular-nums">{{ score.toLocaleString() }}</span></span>
            <span>Wave <span class="font-bold text-zinc-200 tabular-nums">{{ wave }}</span></span>
          </div>
          <p v-if="pausedBy" class="mt-2 text-[13px] font-semibold text-accent">
            {{ pausedBy }} paused the match — resuming unpauses everyone.
          </p>

          <div class="mt-5 space-y-2 short:mt-auto">
            <button type="button" class="btn-primary font-ui w-full font-bold tracking-wider" @click="$emit('resume')">
              <UiIcon name="play" cls="h-4 w-4" /> Resume <kbd class="border-black/20 bg-black/10 text-ink pointer-coarse:hidden">P</kbd>
            </button>
            <div class="flex gap-2">
              <button type="button" class="btn-ghost flex-1" @click="$emit('restart')">
                <UiIcon name="refresh" cls="h-4 w-4" /> Restart
              </button>
              <button type="button" class="btn-ghost flex-1" @click="$emit('quit')">
                <UiIcon name="logout" cls="h-4 w-4" /> Leave
              </button>
            </div>
            <button
              type="button"
              role="switch"
              :aria-checked="musicOn"
              class="btn-ghost w-full text-zinc-400"
              @click="$emit('toggle-music')"
            >
              <UiIcon name="music" cls="h-4 w-4" /> Music {{ musicOn ? 'on' : 'off' }}
            </button>
            <button
              type="button"
              class="btn-ghost w-full text-zinc-400 short:hidden roomy:hidden"
              :aria-expanded="showHelp"
              @click="showHelp = !showHelp"
            >
              <UiIcon name="info" cls="h-4 w-4" /> {{ showHelp ? 'Hide' : 'Show' }} controls &amp; tips
            </button>
          </div>

          <p class="mt-3 text-xs text-zinc-500 pointer-coarse:hidden">
            <kbd>Esc</kbd> / <kbd>P</kbd> resume · <kbd>M</kbd> mute
          </p>
        </div>

        <!-- Help: side column when there is room, collapsible on portrait phones -->
        <div
          class="min-h-0 min-w-0 flex-col border-t border-white/10 pt-4 short:flex short:border-t-0 short:border-l short:pt-0 short:pl-4 roomy:flex roomy:border-t-0 roomy:border-l roomy:pt-0 roomy:pl-6"
          :class="showHelp ? 'flex' : 'hidden'"
        >
          <SegTabs v-model="helpMode" :options="HELP_TABS" label="Control scheme" size="sm" class="mb-3 shrink-0" />
          <div class="scroll-area min-h-0 flex-1 pr-1">
            <HowToPlay bare :mode="helpMode" />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
