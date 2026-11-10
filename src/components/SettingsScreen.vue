<script setup>
import SegTabs from './ui/SegTabs.vue';
import UiIcon from './UiIcon.vue';
import { canFullscreen } from '../composables/useOrientation.js';
import { useViewport } from '../composables/useViewport.js';

defineProps({
  settings: { type: Object, required: true },
});

// The Fullscreen row only shows on touch devices that support the API.
const vp = useViewport();

const emit = defineEmits(['toggle-mute', 'toggle-music', 'volume', 'toggle-shake', 'toggle-fps', 'theme', 'set']);

const THEMES = [
  { value: 'dark', label: 'Dark', icon: 'moon' },
  { value: 'light', label: 'Light', icon: 'sun' },
];
const TOUCH = [
  { value: 'auto', label: 'Auto' },
  { value: 'on', label: 'On' },
  { value: 'off', label: 'Off' },
];
const SIZES = [
  { value: 's', label: 'S' },
  { value: 'm', label: 'M' },
  { value: 'l', label: 'L' },
];
</script>

<template>
  <div class="grid gap-4 short:grid-cols-2 short:gap-5">
    <!-- Audio -->
    <section class="min-w-0">
      <h3 class="label mb-1.5 px-1">Audio</h3>
      <div class="tile divide-themed overflow-hidden">
        <button
          type="button"
          role="switch"
          :aria-checked="!settings.muted"
          class="flex w-full items-center justify-between gap-4 px-4 py-3 text-left"
          @click="emit('toggle-mute')"
        >
          <span class="min-w-0">
            <span class="font-ui block text-sm font-semibold text-zinc-200">Sound FX</span>
            <span class="block text-xs text-zinc-500">In-game audio effects</span>
          </span>
          <span class="switch-track-themed" :data-on="!settings.muted" aria-hidden="true"><span class="switch-thumb" /></span>
        </button>

        <button
          type="button"
          role="switch"
          :aria-checked="settings.music"
          class="flex w-full items-center justify-between gap-4 px-4 py-3 text-left"
          @click="emit('toggle-music')"
        >
          <span class="min-w-0">
            <span class="font-ui block text-sm font-semibold text-zinc-200">Music</span>
            <span class="block text-xs text-zinc-500">Background soundtrack</span>
          </span>
          <span class="switch-track-themed" :data-on="settings.music" aria-hidden="true"><span class="switch-thumb" /></span>
        </button>

        <div class="px-4 pt-3 pb-1.5">
          <div class="flex items-center justify-between gap-4">
            <label for="settings-volume" class="font-ui text-sm font-semibold text-zinc-200">Volume</label>
            <span class="text-[13px] font-semibold text-accent tabular-nums">{{ Math.round(settings.volume * 100) }}%</span>
          </div>
          <input
            id="settings-volume"
            type="range"
            min="0"
            max="1"
            step="0.05"
            :value="settings.volume"
            class="range"
            :style="{ '--fill': `${settings.volume * 100}%` }"
            @input="emit('volume', Number($event.target.value))"
          />
        </div>
      </div>
    </section>

    <!-- Display -->
    <section class="min-w-0">
      <h3 class="label mb-1.5 px-1">Display</h3>
      <div class="tile divide-themed overflow-hidden">
        <div class="flex items-center justify-between gap-4 px-4 py-3">
          <span class="font-ui text-sm font-semibold text-zinc-200">Theme</span>
          <SegTabs
            :model-value="settings.theme"
            :options="THEMES"
            label="Theme"
            size="sm"
            class="w-44"
            @update:model-value="emit('theme', $event)"
          />
        </div>

        <button
          v-if="canFullscreen && vp.coarse"
          type="button"
          role="switch"
          :aria-checked="settings.autoFullscreen"
          class="flex w-full items-center justify-between gap-4 px-4 py-3 text-left"
          @click="emit('set', 'autoFullscreen', !settings.autoFullscreen)"
        >
          <span class="min-w-0">
            <span class="font-ui block text-sm font-semibold text-zinc-200">Fullscreen</span>
            <span class="block text-xs text-zinc-500">Hide the browser bars (turns on with your first tap)</span>
          </span>
          <span class="switch-track-themed" :data-on="settings.autoFullscreen" aria-hidden="true"><span class="switch-thumb" /></span>
        </button>

        <button
          type="button"
          role="switch"
          :aria-checked="settings.shake"
          class="flex w-full items-center justify-between gap-4 px-4 py-3 text-left"
          @click="emit('toggle-shake')"
        >
          <span class="min-w-0">
            <span class="font-ui block text-sm font-semibold text-zinc-200">Screen shake</span>
            <span class="block text-xs text-zinc-500">Camera shake on hits and explosions</span>
          </span>
          <span class="switch-track-themed" :data-on="settings.shake" aria-hidden="true"><span class="switch-thumb" /></span>
        </button>

        <button
          type="button"
          role="switch"
          :aria-checked="settings.showFps"
          class="flex w-full items-center justify-between gap-4 px-4 py-3 text-left"
          @click="emit('toggle-fps')"
        >
          <span class="min-w-0">
            <span class="font-ui block text-sm font-semibold text-zinc-200">FPS counter</span>
            <span class="block text-xs text-zinc-500">Frames per second in the HUD</span>
          </span>
          <span class="switch-track-themed" :data-on="settings.showFps" aria-hidden="true"><span class="switch-thumb" /></span>
        </button>
      </div>
    </section>

    <!-- Touch -->
    <section class="min-w-0 short:col-span-2">
      <h3 class="label mb-1.5 flex items-center gap-1.5 px-1"><UiIcon name="device" cls="h-3.5 w-3.5" /> Touch controls</h3>
      <div class="tile divide-themed overflow-hidden short:grid short:grid-cols-3 short:divide-none">
        <div class="flex items-center justify-between gap-4 px-4 py-3 short:flex-col short:items-start short:gap-2">
          <span class="min-w-0">
            <span class="font-ui block text-sm font-semibold text-zinc-200">On-screen sticks</span>
            <span class="block text-xs text-zinc-500 short:hidden">Auto shows them on touch devices</span>
          </span>
          <SegTabs
            :model-value="settings.touchControls"
            :options="TOUCH"
            label="On-screen sticks"
            size="sm"
            class="w-44"
            @update:model-value="emit('set', 'touchControls', $event)"
          />
        </div>
        <div class="flex items-center justify-between gap-4 px-4 py-3 short:flex-col short:items-start short:gap-2">
          <span class="font-ui text-sm font-semibold text-zinc-200">Control size</span>
          <SegTabs
            :model-value="settings.controlSize"
            :options="SIZES"
            label="Control size"
            size="sm"
            class="w-36"
            @update:model-value="emit('set', 'controlSize', $event)"
          />
        </div>
        <button
          type="button"
          role="switch"
          :aria-checked="settings.leftHanded"
          class="flex w-full items-center justify-between gap-4 px-4 py-3 text-left short:flex-col short:items-start short:gap-2"
          @click="emit('set', 'leftHanded', !settings.leftHanded)"
        >
          <span class="min-w-0">
            <span class="font-ui block text-sm font-semibold text-zinc-200">Left-handed</span>
            <span class="block text-xs text-zinc-500 short:hidden">Aim on the left, move on the right</span>
          </span>
          <span class="switch-track-themed" :data-on="settings.leftHanded" aria-hidden="true"><span class="switch-thumb" /></span>
        </button>
      </div>
    </section>
  </div>
</template>
