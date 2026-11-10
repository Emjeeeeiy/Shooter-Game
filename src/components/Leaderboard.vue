<script setup>
import { computed, ref, watch } from 'vue';
import { useLeaderboard } from '../composables/useLeaderboard.js';
import { useCloudBoard } from '../composables/useCloudBoard.js';
import SegTabs from './ui/SegTabs.vue';
import UiIcon from './UiIcon.vue';

const props = defineProps({
  cloud: { type: Boolean, default: false },
  /** Inside a sheet: no outer panel / title (the sheet provides them). */
  bare: { type: Boolean, default: false },
  /** Preview mode: show only the first N rows plus a "See all" link. */
  limit: { type: Number, default: 0 },
});
const emit = defineEmits(['more']);

const { entries, clear, exportJson } = useLeaderboard();
const { global, loading, error, loadGlobal } = useCloudBoard();

const tab = ref('local');

watch(tab, (t) => {
  if (t === 'global' && props.cloud) loadGlobal();
});

const tabs = computed(() => [
  { value: 'local', label: 'Local', icon: 'device' },
  {
    value: 'global',
    label: 'Global',
    icon: 'globe',
    disabled: !props.cloud,
    title: props.cloud ? 'Worldwide scores' : 'Log in to see global scores',
  },
]);

const rows = computed(() => {
  const list = tab.value === 'local' ? (entries.value ?? []) : (global.value ?? []);
  return props.limit ? list.slice(0, props.limit) : list;
});

function onExport() {
  const blob = new Blob([exportJson()], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'neon-strike-leaderboard.json';
  a.click();
  URL.revokeObjectURL(url);
}

function onClear() {
  if (window.confirm('Clear all locally saved scores on this device?')) clear();
}

function fmtTime(sec) {
  if (!sec) return '—';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

// Gold / silver / bronze — theme tokens so light mode stays legible.
const RANK_CLS = ['bg-skill/15 text-skill', 'bg-zinc-400/15 text-zinc-300', 'bg-missile/15 text-missile'];

const empty = computed(() => {
  if (tab.value === 'local') return entries.value?.length ? null : 'No runs recorded yet. Finish a run to post a score.';
  if (!props.cloud) return 'Log in to see worldwide scores.';
  if (loading.value || error.value) return null;
  return global.value?.length ? null : 'No global scores yet — be the first.';
});
</script>

<template>
  <section
    class="flex min-h-0 flex-col overflow-hidden"
    :class="bare ? 'flex-1' : 'panel-elevated'"
  >
    <!-- Header -->
    <div
      class="flex shrink-0 flex-wrap items-center gap-2 border-b border-white/6 py-3"
      :class="bare ? 'px-safe' : 'px-4'"
    >
      <div v-if="!bare" class="mr-auto min-w-0">
        <div class="label">Leaderboard</div>
        <div class="font-display truncate text-sm font-bold text-zinc-100">TOP PILOTS</div>
      </div>
      <SegTabs v-model="tab" :options="tabs" label="Leaderboard scope" size="sm" :class="bare ? 'flex-1' : 'w-44'" />
      <template v-if="!limit">
        <button
          v-if="tab === 'local' && entries.length"
          type="button"
          class="btn-icon"
          title="Export leaderboard JSON"
          aria-label="Export leaderboard"
          @click="onExport"
        >
          <UiIcon name="download" cls="h-4 w-4" />
        </button>
        <button
          v-if="tab === 'local' && entries.length"
          type="button"
          class="btn-icon hover:border-danger/30 hover:text-danger"
          title="Clear local leaderboard"
          aria-label="Clear local leaderboard"
          @click="onClear"
        >
          <UiIcon name="trash" cls="h-4 w-4" />
        </button>
        <button
          v-if="tab === 'global' && cloud"
          type="button"
          class="btn-icon"
          title="Refresh global board"
          aria-label="Refresh global board"
          @click="loadGlobal"
        >
          <UiIcon name="refresh" cls="h-4 w-4" />
        </button>
      </template>
    </div>

    <!-- Body -->
    <div class="flex min-h-0 flex-1 flex-col" :class="limit ? '' : 'scroll-area'">
      <div v-if="tab === 'global' && cloud && loading" class="flex items-center justify-center gap-2 px-4 py-8 text-[13px] text-zinc-500">
        <UiIcon name="spinner" cls="h-4 w-4" />
        Loading global board…
      </div>
      <div v-else-if="tab === 'global' && cloud && error" class="px-4 py-8 text-center text-[13px] text-danger">{{ error }}</div>
      <div v-else-if="empty" class="flex flex-1 flex-col items-center justify-center gap-2 px-6 py-6 text-center">
        <UiIcon :name="tab === 'local' ? 'gamepad' : 'globe'" cls="h-7 w-7 text-zinc-600" />
        <p class="max-w-56 text-[13px] text-zinc-500">{{ empty }}</p>
      </div>

      <template v-else>
        <div
          class="label sticky top-0 z-10 grid shrink-0 grid-cols-[2rem_minmax(0,1fr)_auto_2.75rem] items-center gap-3 border-b border-white/5 bg-panel/95 py-2 roomy:grid-cols-[2rem_minmax(0,1fr)_auto_2.75rem_3rem]"
          :class="[bare ? 'px-safe bg-surface/95' : 'px-4', limit ? 'hidden' : '']"
        >
          <span>#</span>
          <span>Pilot</span>
          <span class="text-right">Score</span>
          <span class="text-right">Wave</span>
          <span class="hidden text-right roomy:block">{{ tab === 'local' ? 'Time' : '' }}</span>
        </div>
        <ol>
          <li
            v-for="(entry, index) in rows"
            :key="`${entry.uid ?? entry.name}-${entry.ts ?? ''}-${index}`"
            class="grid grid-cols-[2rem_minmax(0,1fr)_auto_2.75rem] items-center gap-3 border-b border-white/4 py-2.5 text-sm roomy:grid-cols-[2rem_minmax(0,1fr)_auto_2.75rem_3rem]"
            :class="[bare ? 'px-safe' : 'px-4', index === 0 ? 'bg-skill/4' : '']"
          >
            <span v-if="index < 3" class="rank-badge" :class="RANK_CLS[index]">{{ index + 1 }}</span>
            <span v-else class="pl-2 text-[13px] text-zinc-500 tabular-nums">{{ index + 1 }}</span>
            <span class="truncate font-semibold" :class="index === 0 ? 'text-skill' : 'text-zinc-200'">{{ entry.name }}</span>
            <span class="text-right font-bold tabular-nums" :class="index === 0 ? 'text-skill' : 'text-zinc-200'">
              {{ Number(entry.score || 0).toLocaleString() }}
            </span>
            <span class="text-right text-zinc-400 tabular-nums">{{ entry.wave }}</span>
            <span class="hidden text-right text-zinc-500 tabular-nums roomy:block">
              {{ tab === 'local' ? fmtTime(entry.timeSec) : '' }}
            </span>
          </li>
        </ol>
      </template>
    </div>

    <button
      v-if="limit"
      type="button"
      class="flex min-h-11 shrink-0 items-center justify-center gap-1 border-t border-white/6 text-[13px] font-semibold text-accent"
      @click="emit('more')"
    >
      See full leaderboard <UiIcon name="chevron-right" cls="h-4 w-4" />
    </button>
  </section>
</template>
