<script setup>
import { computed } from 'vue';
import { useRoom } from '../composables/useRoom.js';
import UiIcon from './UiIcon.vue';

const props = defineProps({
  code: { type: String, required: true },
  myUid: { type: String, required: true },
});

const { room } = useRoom(() => props.code);

const standings = computed(() => {
  const live = room.value?.live ?? {};
  return Object.entries(live)
    .map(([id, s]) => ({
      id,
      name: s.name ?? 'Pilot',
      score: s.score ?? 0,
      wave: s.wave ?? 1,
      done: !!s.done,
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 6);
});
</script>

<template>
  <div class="panel pointer-events-none px-3 py-2">
    <div class="label text-center">Race · {{ code }}</div>
    <ul class="mt-1 space-y-0.5">
      <li
        v-for="(s, i) in standings"
        :key="s.id"
        class="flex items-center gap-2 text-[11px] tabular-nums"
        :class="s.id === myUid ? 'font-bold text-accent' : 'text-zinc-300'"
      >
        <span class="w-3 text-zinc-500">{{ i + 1 }}</span>
        <span class="max-w-[90px] truncate">{{ s.name }}</span>
        <span class="ml-auto">{{ s.score.toLocaleString() }}</span>
        <UiIcon v-if="s.done" name="check" cls="h-3 w-3 text-shock" />
      </li>
    </ul>
  </div>
</template>
