<script setup>
import { ref } from 'vue';

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
    <div class="label">Configuration</div>
    <h2 class="font-display mt-2 text-3xl font-bold text-zinc-50" style="letter-spacing: 0.08em;">SETTINGS</h2>

    <div class="panel-elevated mt-6 w-full space-y-1 overflow-hidden p-2">
      <!-- Callsign rename -->
      <div v-if="canRename" class="rounded-xl p-5" style="background: rgba(255,255,255,0.02);">
        <label class="label mb-2 block" for="settings-callsign">Pilot callsign</label>
        <div class="flex gap-2">
          <input
            id="settings-callsign"
            v-model="name"
            type="text"
            maxlength="20"
            class="input-field flex-1"
            placeholder="Your callsign"
          />
          <button type="button" class="btn-primary px-5" @click="saveName">Save</button>
        </div>
        <p v-if="renameMsg" class="mt-2 text-[12px] text-zinc-500">{{ renameMsg }}</p>
      </div>

      <!-- Setting rows -->
      <div class="divide-y" style="--tw-divide-opacity: 1; border-color: rgba(255,255,255,0.05);">

        <!-- Sound toggle -->
        <div class="flex items-center justify-between gap-4 px-5 py-4">
          <div>
            <div class="font-ui text-sm font-semibold text-zinc-200">Sound FX</div>
            <div class="font-ui text-[11px] font-medium text-zinc-600">In-game audio effects</div>
          </div>
          <button
            type="button"
            :aria-pressed="!settings.muted"
            class="toggle-track h-6 w-11 shrink-0"
            :style="!settings.muted
              ? 'background: rgba(56,189,248,0.3); border-color: rgba(56,189,248,0.5);'
              : 'background: rgba(255,255,255,0.06); border-color: rgba(255,255,255,0.1);'"
            @click="emit('toggle-mute')"
          >
            <span
              class="inline-block h-4 w-4 rounded-full shadow-sm transition-transform duration-200"
              :style="!settings.muted
                ? 'background: #38bdf8; transform: translateX(21px); box-shadow: 0 0 8px rgba(56,189,248,0.6);'
                : 'background: #52525b; transform: translateX(3px);'"
            />
          </button>
        </div>

        <!-- Music toggle -->
        <div class="flex items-center justify-between gap-4 px-5 py-4">
          <div>
            <div class="font-ui text-sm font-semibold text-zinc-200">Music</div>
            <div class="font-ui text-[11px] font-medium text-zinc-600">Background soundtrack</div>
          </div>
          <button
            type="button"
            :aria-pressed="settings.music"
            class="toggle-track h-6 w-11 shrink-0"
            :style="settings.music
              ? 'background: rgba(56,189,248,0.3); border-color: rgba(56,189,248,0.5);'
              : 'background: rgba(255,255,255,0.06); border-color: rgba(255,255,255,0.1);'"
            @click="emit('toggle-music')"
          >
            <span
              class="inline-block h-4 w-4 rounded-full shadow-sm transition-transform duration-200"
              :style="settings.music
                ? 'background: #38bdf8; transform: translateX(21px); box-shadow: 0 0 8px rgba(56,189,248,0.6);'
                : 'background: #52525b; transform: translateX(3px);'"
            />
          </button>
        </div>

        <!-- Volume slider -->
        <div class="px-5 py-4">
          <div class="mb-3 flex items-center justify-between">
            <div>
              <div class="font-ui text-sm font-semibold text-zinc-200">Volume</div>
              <div class="font-ui text-[11px] font-medium text-zinc-600">Master audio level</div>
            </div>
            <span class="text-[13px] font-semibold text-accent tabular-nums">{{ Math.round(settings.volume * 100) }}%</span>
          </div>
          <div class="relative h-5 flex items-center">
            <div class="h-1.5 w-full overflow-hidden rounded-full" style="background: rgba(255,255,255,0.08);">
              <div
                class="h-full rounded-full"
                style="background: linear-gradient(90deg, #38bdf8, #0ea5e9); transition: width 0.1s;"
                :style="{ width: settings.volume * 100 + '%' }"
              />
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              :value="settings.volume"
              class="absolute inset-0 h-full w-full cursor-pointer opacity-0"
              @input="emit('volume', Number($event.target.value))"
            />
          </div>
        </div>

        <!-- Screen shake -->
        <div class="flex items-center justify-between gap-4 px-5 py-4">
          <div>
            <div class="font-ui text-sm font-semibold text-zinc-200">Screen Shake</div>
            <div class="font-ui text-[11px] font-medium text-zinc-600">Haptic-style camera shake on hits</div>
          </div>
          <button
            type="button"
            :aria-pressed="settings.shake"
            class="toggle-track h-6 w-11 shrink-0"
            :style="settings.shake
              ? 'background: rgba(56,189,248,0.3); border-color: rgba(56,189,248,0.5);'
              : 'background: rgba(255,255,255,0.06); border-color: rgba(255,255,255,0.1);'"
            @click="emit('toggle-shake')"
          >
            <span
              class="inline-block h-4 w-4 rounded-full shadow-sm transition-transform duration-200"
              :style="settings.shake
                ? 'background: #38bdf8; transform: translateX(21px); box-shadow: 0 0 8px rgba(56,189,248,0.6);'
                : 'background: #52525b; transform: translateX(3px);'"
            />
          </button>
        </div>

        <!-- FPS meter -->
        <div class="flex items-center justify-between gap-4 px-5 py-4">
          <div>
            <div class="font-ui text-sm font-semibold text-zinc-200">FPS Counter</div>
            <div class="font-ui text-[11px] font-medium text-zinc-600">Show frames per second in HUD</div>
          </div>
          <button
            type="button"
            :aria-pressed="settings.showFps"
            class="toggle-track h-6 w-11 shrink-0"
            :style="settings.showFps
              ? 'background: rgba(56,189,248,0.3); border-color: rgba(56,189,248,0.5);'
              : 'background: rgba(255,255,255,0.06); border-color: rgba(255,255,255,0.1);'"
            @click="emit('toggle-fps')"
          >
            <span
              class="inline-block h-4 w-4 rounded-full shadow-sm transition-transform duration-200"
              :style="settings.showFps
                ? 'background: #38bdf8; transform: translateX(21px); box-shadow: 0 0 8px rgba(56,189,248,0.6);'
                : 'background: #52525b; transform: translateX(3px);'"
            />
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
