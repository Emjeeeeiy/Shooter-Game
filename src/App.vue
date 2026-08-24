<script setup>
import GameStage from './components/GameStage.vue';
import Leaderboard from './components/Leaderboard.vue';
</script>

<template>
  <div class="min-h-dvh w-full px-4 py-8 sm:px-6 lg:py-12">
    <div class="mx-auto flex w-full max-w-[1200px] flex-col items-center gap-6">
      <header class="flex w-full items-center justify-between gap-4">
        <div class="flex items-center gap-2.5">
          <span class="h-2 w-2 rounded-full bg-accent" />
          <h1 class="text-sm font-semibold tracking-[0.22em] text-zinc-200 uppercase">
            Neon Strike
          </h1>
        </div>
        <p class="hidden text-[13px] text-zinc-500 sm:block">Top-down arena shooter</p>
      </header>

      <GameStage />
      <Leaderboard />

      <footer class="pb-2 text-center text-[11px] text-zinc-600">
        Scores are stored locally in this browser.
      </footer>
    </div>
  </div>
</template>
