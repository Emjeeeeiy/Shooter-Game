<script setup>
import { ref } from 'vue';
import UiIcon from './UiIcon.vue';

const props = defineProps({
  settings: { type: Object, required: true },
  pilotName: { type: String, default: 'Pilot' },
  canRename: { type: Boolean, default: false },
});

const emit = defineEmits(['toggle-mute', 'toggle-music', 'volume', 'toggle-shake', 'toggle-fps', 'rename', 'back']);

const name = ref(props.pilotName);
const renameMsg = ref('');

function saveName() {
  const clean = name.value.trim().slice(0, 20);
  if (!clean) {
    renameMsg.value = 'Enter a callsign.';
    return;
  }
  emit('rename', clean, (msg) => {
    renameMsg.value = msg;
  });
}
</script>

<template>
  <div class="flex w-full max-w-md flex-col items-center">
    <div class="label">Neon Strike</div>
    <h2 class="mt-1 text-3xl font-semibold text-zinc-50">Settings</h2>

    <div class="panel mt-6 w-full space-y-5 p-6">
      <div v-if="canRename">
        <label class="label block" for="settings-callsign">Pilot callsign</label>
        <div class="mt-1.5 flex gap-2">
          <input
            id="settings-callsign"
            v-model="name"
            type="text"
            maxlength="20"
            class="flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-zinc-100 focus:border-accent/60 focus:outline-none"
          />
          <button
            type="button"
            class="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-surface hover:bg-sky-300"
            @click="saveName"
          >
            Save
          </button>
        </div>
        <p v-if="renameMsg" class="mt-1.5 text-[12px] text-zinc-500">{{ renameMsg }}</p>
      </div>

      <div class="flex items-center justify-between gap-3">
        <span class="text-sm text-zinc-300">Sound</span>
        <button
          type="button"
          class="rounded-lg border border-white/12 px-3 py-1.5 text-[12px] font-medium text-zinc-300 hover:border-white/25"
          @click="emit('toggle-mute')"
        >
          <span class="inline-flex items-center gap-1.5"><UiIcon :name="settings.muted ? 'sound-off' : 'sound-on'" cls="h-3.5 w-3.5" />{{ settings.muted ? 'Muted' : 'On' }}</span>
        </button>
      </div>

      <div class="flex items-center justify-between gap-3">
        <span class="text-sm text-zinc-300">Music</span>
        <button
          type="button"
          class="rounded-lg border border-white/12 px-3 py-1.5 text-[12px] font-medium text-zinc-300 hover:border-white/25"
          @click="emit('toggle-music')"
        >
          {{ settings.music ? 'On' : 'Off' }}
        </button>
      </div>

      <label class="flex items-center justify-between gap-3">
        <span class="text-sm text-zinc-300">Volume</span>
        <input
          type="range"
          min="0"
          max="1"
          step="0.05"
          :value="settings.volume"
          class="h-1 w-40 accent-sky-400"
          @input="emit('volume', Number($event.target.value))"
        />
      </label>

      <div class="flex items-center justify-between gap-3">
        <span class="text-sm text-zinc-300">Screen shake</span>
        <button
          type="button"
          class="rounded-lg border border-white/12 px-3 py-1.5 text-[12px] font-medium text-zinc-300 hover:border-white/25"
          @click="emit('toggle-shake')"
        >
          {{ settings.shake ? 'On' : 'Off' }}
        </button>
      </div>

      <div class="flex items-center justify-between gap-3">
        <span class="text-sm text-zinc-300">FPS meter</span>
        <button
          type="button"
          class="rounded-lg border border-white/12 px-3 py-1.5 text-[12px] font-medium text-zinc-300 hover:border-white/25"
          @click="emit('toggle-fps')"
        >
          {{ settings.showFps ? 'On' : 'Off' }}
        </button>
      </div>
    </div>

  </div>
</template>
