<script setup>
import { useLeaderboard } from '../composables/useLeaderboard.js';

const { entries, clear } = useLeaderboard();
</script>

<template>
  <section class="panel w-full max-w-[1200px] overflow-hidden">
    <header class="flex items-center justify-between border-b border-white/10 px-4 py-3">
      <h2 class="text-sm font-semibold text-zinc-200">Top pilots</h2>
      <button
        v-if="entries.length"
        type="button"
        class="text-[11px] font-medium text-zinc-500 transition-colors hover:text-zinc-300"
        @click="clear"
      >
        Clear
      </button>
    </header>

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
            <td class="px-4 py-2.5 text-right text-[13px] text-zinc-600">{{ entry.date }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>
