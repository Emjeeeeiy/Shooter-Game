<script setup>
import { ref, watch } from 'vue';
import { useLeaderboard } from '../composables/useLeaderboard.js';
import { useCloudBoard } from '../composables/useCloudBoard.js';

const props = defineProps({
  cloud: { type: Boolean, default: false }, // signed-in && online
});

const { entries, clear, exportJson } = useLeaderboard();
const { global, loading, error, loadGlobal } = useCloudBoard();

const tab = ref('local'); // 'local' | 'global'

watch(tab, (t) => {
  if (t === 'global' && props.cloud) loadGlobal();
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

function fmtTime(sec) {
  if (!sec) return '—';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}
</script>

<template>
  <section class="panel w-full overflow-hidden">
    <header class="flex items-center justify-between gap-2 border-b border-white/10 px-4 py-3">
      <div class="flex items-center gap-1 rounded-lg bg-white/5 p-1">
        <button
          type="button"
          class="rounded-md px-2.5 py-1 text-[11px] font-semibold transition-colors"
          :class="tab === 'local' ? 'bg-white/10 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'"
          @click="tab = 'local'"
        >
          Local
        </button>
        <button
          type="button"
          class="rounded-md px-2.5 py-1 text-[11px] font-semibold transition-colors"
          :class="tab === 'global' ? 'bg-white/10 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'"
          :disabled="!cloud"
          :title="cloud ? 'Worldwide scores' : 'Log in to see global scores'"
          @click="tab = 'global'"
        >
          Global
        </button>
      </div>
      <h2 class="hidden text-sm font-semibold text-zinc-200 sm:block">Top pilots</h2>
      <div class="flex items-center gap-3">
        <button
          v-if="tab === 'local' && entries.length"
          type="button"
          class="rounded-md border border-white/12 px-2 py-1 text-[11px] font-medium text-zinc-400 transition-colors hover:border-white/30 hover:text-zinc-100"
          @click="onExport"
        >
          Export
        </button>
        <button
          v-if="tab === 'local' && entries.length"
          type="button"
          class="rounded-md border border-white/12 px-2 py-1 text-[11px] font-medium text-zinc-400 transition-colors hover:border-white/30 hover:text-zinc-100"
          @click="clear"
        >
          Clear
        </button>
        <button
          v-if="tab === 'global' && cloud"
          type="button"
          class="text-[11px] font-medium text-zinc-500 transition-colors hover:text-zinc-300"
          @click="loadGlobal"
        >
          Refresh
        </button>
      </div>
    </header>

    <!-- Local -->
    <template v-if="tab === 'local'">
      <div v-if="!entries.length" class="px-4 py-8 text-center text-[13px] text-zinc-600">
        No runs recorded yet.
      </div>
      <div v-else class="overflow-x-auto">
        <table class="w-full text-left text-sm">
          <thead>
            <tr class="border-b border-white/5">
              <th class="label px-4 py-2 font-medium">Rank</th>
              <th class="label px-4 py-2 font-medium">Pilot</th>
              <th class="label px-4 py-2 text-right font-medium">Score</th>
              <th class="label px-4 py-2 text-right font-medium">Wave</th>
              <th class="label px-4 py-2 text-right font-medium">Kills</th>
              <th class="label px-4 py-2 text-right font-medium">Time</th>
              <th class="label px-4 py-2 text-right font-medium">Date</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="(entry, index) in entries"
              :key="`${entry.name}-${entry.score}-${index}`"
              class="border-b border-white/5 last:border-0"
            >
              <td class="px-4 py-2.5 text-zinc-500 tabular-nums">{{ index + 1 }}</td>
              <td class="px-4 py-2.5 font-medium" :class="index === 0 ? 'text-accent' : 'text-zinc-200'">
                {{ entry.name }}
              </td>
              <td class="px-4 py-2.5 text-right text-zinc-200 tabular-nums">
                {{ entry.score.toLocaleString() }}
              </td>
              <td class="px-4 py-2.5 text-right text-zinc-400 tabular-nums">{{ entry.wave }}</td>
              <td class="px-4 py-2.5 text-right text-zinc-500 tabular-nums">{{ entry.kills ?? '—' }}</td>
              <td class="px-4 py-2.5 text-right text-zinc-500 tabular-nums">{{ fmtTime(entry.timeSec) }}</td>
              <td class="px-4 py-2.5 text-right text-[13px] text-zinc-600">{{ entry.date }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>

    <!-- Global -->
    <template v-else>
      <div v-if="!cloud" class="px-4 py-8 text-center text-[13px] text-zinc-600">
        Log in to see worldwide scores.
      </div>
      <div v-else-if="loading" class="px-4 py-8 text-center text-[13px] text-zinc-500">
        Loading global board…
      </div>
      <div v-else-if="error" class="px-4 py-8 text-center text-[13px] text-danger">
        {{ error }}
      </div>
      <div v-else-if="!global.length" class="px-4 py-8 text-center text-[13px] text-zinc-600">
        No global scores yet — be the first.
      </div>
      <div v-else class="overflow-x-auto">
        <table class="w-full text-left text-sm">
          <thead>
            <tr class="border-b border-white/5">
              <th class="label px-4 py-2 font-medium">Rank</th>
              <th class="label px-4 py-2 font-medium">Pilot</th>
              <th class="label px-4 py-2 text-right font-medium">Score</th>
              <th class="label px-4 py-2 text-right font-medium">Wave</th>
              <th class="label px-4 py-2 text-right font-medium">Kills</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="(entry, index) in global"
              :key="`${entry.name}-${entry.score}-${entry.ts}-${index}`"
              class="border-b border-white/5 last:border-0"
            >
              <td class="px-4 py-2.5 text-zinc-500 tabular-nums">{{ index + 1 }}</td>
              <td class="px-4 py-2.5 font-medium" :class="index === 0 ? 'text-skill' : 'text-zinc-200'">
                {{ entry.name }}
              </td>
              <td class="px-4 py-2.5 text-right text-zinc-200 tabular-nums">
                {{ entry.score.toLocaleString() }}
              </td>
              <td class="px-4 py-2.5 text-right text-zinc-400 tabular-nums">{{ entry.wave }}</td>
              <td class="px-4 py-2.5 text-right text-zinc-500 tabular-nums">{{ entry.kills ?? '—' }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
  </section>
</template>
