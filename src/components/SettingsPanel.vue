<script setup>
const props = defineProps({
  settings: { type: Object, required: true },
});
const emit = defineEmits(['toggle-mute', 'volume', 'toggle-shake', 'toggle-fps']);
</script>

<template>
  <div class="panel flex flex-wrap items-center gap-x-4 gap-y-2 px-3 py-2">
    <button
      type="button"
      class="text-[12px] font-medium text-zinc-400 transition-colors hover:text-zinc-100"
      @click="emit('toggle-mute')"
      :title="settings.muted ? 'Unmute (M)' : 'Mute (M)'"
    >
      {{ settings.muted ? '🔇 Muted' : '🔊 Sound' }}
    </button>
    <label class="flex items-center gap-2 text-[12px] text-zinc-500">
      Vol
      <input
        type="range"
        min="0"
        max="1"
        step="0.05"
        :value="settings.volume"
        class="h-1 w-20 accent-sky-400"
        @input="emit('volume', Number($event.target.value))"
      />
    </label>
    <button
      type="button"
      class="text-[12px] font-medium transition-colors"
      :class="settings.shake ? 'text-zinc-300 hover:text-zinc-100' : 'text-zinc-600 hover:text-zinc-400'"
      @click="emit('toggle-shake')"
      title="Toggle screen shake"
    >
      {{ settings.shake ? '📳 Shake on' : '📳 Shake off' }}
    </button>
    <button
      type="button"
      class="text-[12px] font-medium transition-colors"
      :class="settings.showFps ? 'text-zinc-300 hover:text-zinc-100' : 'text-zinc-600 hover:text-zinc-400'"
      @click="emit('toggle-fps')"
      title="Toggle FPS meter"
    >
      {{ settings.showFps ? 'FPS on' : 'FPS off' }}
    </button>
  </div>
</template>
