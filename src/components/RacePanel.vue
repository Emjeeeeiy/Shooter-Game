<script setup>
import { computed, ref } from 'vue';
import { useRoom } from '../composables/useRoom.js';
import UiIcon from './UiIcon.vue';

const props = defineProps({
  code: { type: String, required: true },
  myUid: { type: String, required: true },
  /** Phones: a rank chip that expands to the standings on tap. */
  compact: { type: Boolean, default: false },
});

const { room } = useRoom(() => props.code);
const open = ref(false);

const all = computed(() => {
  const live = room.value?.live ?? {};
  return Object.entries(live)
    .map(([id, s]) => ({
      id,
      name: s.name ?? 'Pilot',
      score: s.score ?? 0,
      wave: s.wave ?? 1,
      done: !!s.done,
    }))
    .sort((a, b) => b.score - a.score);
});
const standings = computed(() => all.value.slice(0, 6));
const myRank = computed(() => all.value.findIndex((s) => s.id === props.myUid) + 1);
</script>

<template>
  <div v-if="compact" class="pointer-events-auto flex flex-col items-center gap-1.5">
    <button
      type="button"
      class="flex min-h-9 items-center gap-1.5 rounded-full border border-white/10 bg-surface/75 px-3 text-xs font-semibold text-zinc-200 tabular-nums"
      :aria-expanded="open"
      aria-label="Race standings"
      @click="open = !open"
    >
      <UiIcon name="trophy" cls="h-3.5 w-3.5 text-skill" />
      <span v-if="myRank">#{{ myRank }}<span class="text-zinc-500">/{{ all.length }}</span></span>
      <span v-else>Race</span>
      <UiIcon name="chevron-down" :cls="`h-3.5 w-3.5 transition-transform ${open ? 'rotate-180' : ''}`" />
    </button>
    <ul v-if="open" class="w-48 space-y-0.5 rounded-xl border border-white/10 bg-surface/90 px-3 py-2">
      <li
        v-for="(s, i) in standings"
        :key="s.id"
        class="flex items-center gap-2 text-xs tabular-nums"
        :class="s.id === myUid ? 'font-bold text-accent' : 'text-zinc-300'"
      >
        <span class="w-3 text-zinc-500">{{ i + 1 }}</span>
        <span class="min-w-0 flex-1 truncate">{{ s.name }}</span>
        <span>{{ s.score.toLocaleString() }}</span>
        <UiIcon v-if="s.done" name="check" cls="h-3 w-3 text-shock" />
      </li>
    </ul>
  </div>

  <div v-else class="pointer-events-none w-48 rounded-xl border border-white/10 bg-surface/75 px-3 py-2">
    <div class="label">Race · {{ code }}</div>
    <ul class="mt-1 space-y-0.5">
      <li
        v-for="(s, i) in standings"
        :key="s.id"
        class="flex items-center gap-2 text-xs tabular-nums"
        :class="s.id === myUid ? 'font-bold text-accent' : 'text-zinc-300'"
      >
        <span class="w-3 text-zinc-500">{{ i + 1 }}</span>
        <span class="min-w-0 flex-1 truncate">{{ s.name }}</span>
        <span>{{ s.score.toLocaleString() }}</span>
        <UiIcon v-if="s.done" name="check" cls="h-3 w-3 text-shock" />
      </li>
    </ul>
  </div>
</template>
