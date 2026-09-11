<script setup>
import { ref, watch } from 'vue';
import { useLeaderboard } from '../composables/useLeaderboard.js';
import { useCloudBoard } from '../composables/useCloudBoard.js';

const props = defineProps({
  cloud: { type: Boolean, default: false },
});

const { entries, clear, exportJson } = useLeaderboard();
const { global, loading, error, loadGlobal } = useCloudBoard();

const tab = ref('local');

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

const RANK_STYLES = [
  { bg: 'rgba(251,191,36,0.15)', color: '#fbbf24', label: '🥇' },
  { bg: 'rgba(161,161,170,0.15)', color: '#a1a1aa', label: '🥈' },
  { bg: 'rgba(180,120,80,0.15)', color: '#b47850', label: '🥉' },
];
</script>

<template>
  <section class="panel-elevated w-full overflow-hidden">
    <!-- Header -->
    <div class="flex items-center justify-between gap-2 border-b border-white/[0.06] px-4 py-4">
      <div>
        <div class="label">Leaderboard</div>
        <div class="font-display text-sm font-bold text-zinc-100" style="letter-spacing: 0.1em;">TOP PILOTS</div>
      </div>
      <div class="flex items-center gap-2">
        <!-- Tab toggle -->
        <div class="flex gap-1 rounded-xl border border-white/[0.06] bg-white/[0.04] p-1">
          <button
            type="button"
            class="font-ui rounded-lg px-3 py-1.5 text-[11px] font-bold tracking-widest transition-all duration-200"
            :class="tab === 'local' ? 'bg-white/10 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'"
            @click="tab = 'local'"
          >
            LOCAL
          </button>
          <button
            type="button"
            class="font-ui rounded-lg px-3 py-1.5 text-[11px] font-bold tracking-widest transition-all duration-200"
            :class="tab === 'global' ? 'bg-white/10 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'"
            :disabled="!cloud"
            :title="cloud ? 'Worldwide scores' : 'Log in to see global scores'"
            @click="tab = 'global'"
          >
            GLOBAL
          </button>
        </div>
        <!-- Actions -->
        <button
          v-if="tab === 'local' && entries.length"
          type="button"
          class="btn-ghost p-2 text-[11px]"
          title="Export leaderboard JSON"
          @click="onExport"
        >
          <svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
        </button>
        <button
          v-if="tab === 'local' && entries.length"
          type="button"
          class="btn-ghost p-2 text-[11px] hover:border-danger/30 hover:text-danger"
          title="Clear local leaderboard"
          @click="clear"
        >
          <svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
        </button>
        <button
          v-if="tab === 'global' && cloud"
          type="button"
          class="btn-ghost p-2 text-[11px]"
          title="Refresh global board"
          @click="loadGlobal"
        >
          <svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
        </button>
      </div>
    </div>

    <!-- Local board -->
    <template v-if="tab === 'local'">
      <div v-if="!entries.length" class="px-4 py-10 text-center">
        <div class="mb-2 text-3xl">🎮</div>
        <p class="text-[13px] text-zinc-600">No runs recorded yet.<br/>Complete a run to see your score here.</p>
      </div>
      <div v-else class="overflow-x-auto">
        <table class="w-full text-left text-sm">
          <thead>
            <tr class="border-b border-white/[0.05]">
              <th class="label px-4 py-3">#</th>
              <th class="label px-4 py-3">Pilot</th>
              <th class="label px-4 py-3 text-right">Score</th>
              <th class="label px-4 py-3 text-right">Wave</th>
              <th class="label hidden px-4 py-3 text-right sm:table-cell">Time</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="(entry, index) in entries"
              :key="`${entry.uid ?? entry.name}-${index}`"
              class="border-b border-white/[0.04] transition-colors"
              :style="index === 0 ? 'background: rgba(251,191,36,0.03);' : ''"
            >
              <td class="px-4 py-3">
                <span v-if="index < 3"
                  class="rank-badge text-sm"
                  :style="`background: ${RANK_STYLES[index].bg}; color: ${RANK_STYLES[index].color};`"
                >
                  {{ RANK_STYLES[index].label }}
                </span>
                <span v-else class="text-[13px] text-zinc-600 tabular-nums">{{ index + 1 }}</span>
              </td>
              <td class="px-4 py-3 font-semibold" :class="index === 0 ? 'text-skill' : 'text-zinc-200'">
                {{ entry.name }}
              </td>
              <td class="px-4 py-3 text-right font-bold tabular-nums" :class="index === 0 ? 'text-skill' : 'text-zinc-200'">
                {{ entry.score.toLocaleString() }}
              </td>
              <td class="px-4 py-3 text-right text-zinc-400 tabular-nums">{{ entry.wave }}</td>
              <td class="hidden px-4 py-3 text-right text-zinc-600 tabular-nums sm:table-cell">{{ fmtTime(entry.timeSec) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>

    <!-- Global board -->
    <template v-else>
      <div v-if="!cloud" class="px-4 py-10 text-center">
        <div class="mb-2 text-3xl">🌐</div>
        <p class="text-[13px] text-zinc-600">Log in to see worldwide scores.</p>
      </div>
      <div v-else-if="loading" class="flex items-center justify-center gap-2 px-4 py-10 text-[13px] text-zinc-500">
        <svg class="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
        Loading global board…
      </div>
      <div v-else-if="error" class="px-4 py-10 text-center text-[13px] text-danger">{{ error }}</div>
      <div v-else-if="!global.length" class="px-4 py-10 text-center">
        <div class="mb-2 text-3xl">🌐</div>
        <p class="text-[13px] text-zinc-600">No global scores yet — be the first.</p>
      </div>
      <div v-else class="overflow-x-auto">
        <table class="w-full text-left text-sm">
          <thead>
            <tr class="border-b border-white/[0.05]">
              <th class="label px-4 py-3">#</th>
              <th class="label px-4 py-3">Pilot</th>
              <th class="label px-4 py-3 text-right">Score</th>
              <th class="label px-4 py-3 text-right">Wave</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="(entry, index) in global"
              :key="`${entry.uid ?? entry.name}-${entry.ts}-${index}`"
              class="border-b border-white/[0.04] transition-colors"
              :style="index === 0 ? 'background: rgba(251,191,36,0.03);' : ''"
            >
              <td class="px-4 py-3">
                <span v-if="index < 3"
                  class="rank-badge text-sm"
                  :style="`background: ${RANK_STYLES[index].bg}; color: ${RANK_STYLES[index].color};`"
                >
                  {{ RANK_STYLES[index].label }}
                </span>
                <span v-else class="text-[13px] text-zinc-600 tabular-nums">{{ index + 1 }}</span>
              </td>
              <td class="px-4 py-3 font-semibold" :class="index === 0 ? 'text-skill' : 'text-zinc-200'">
                {{ entry.name }}
              </td>
              <td class="px-4 py-3 text-right font-bold tabular-nums" :class="index === 0 ? 'text-skill' : 'text-zinc-200'">
                {{ entry.score.toLocaleString() }}
              </td>
              <td class="px-4 py-3 text-right text-zinc-400 tabular-nums">{{ entry.wave }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
  </section>
</template>
