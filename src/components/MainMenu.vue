<script setup>
import UiIcon from './UiIcon.vue';
import Leaderboard from './Leaderboard.vue';

defineProps({
  pilotName: { type: String, default: 'Pilot' },
  email: { type: String, default: '' },
  offline: { type: Boolean, default: false },
  best: { type: Number, default: 0 },
  cloud: { type: Boolean, default: false },
  photo: { type: String, default: '' },
});

defineEmits(['single', 'multi', 'settings', 'profile', 'logout']);
</script>

<template>
  <div class="flex w-full max-w-5xl flex-col items-center">
    <!-- Hero heading -->
    <div class="label tracking-widest">Command Deck</div>
    <div class="mt-4 flex items-center gap-4">
      <div class="relative">
        <img
          v-if="photo"
          :src="photo"
          alt="Pilot avatar"
          class="h-14 w-14 rounded-full border-2 object-cover"
          style="border-color: rgba(56,189,248,0.35); box-shadow: 0 0 20px rgba(56,189,248,0.2);"
        />
        <div
          v-else
          class="flex h-14 w-14 items-center justify-center rounded-full font-display text-xl font-bold text-accent"
          style="background: rgba(56,189,248,0.12); border: 2px solid rgba(56,189,248,0.3); box-shadow: 0 0 20px rgba(56,189,248,0.15);"
        >
          {{ (pilotName || 'P').trim().charAt(0).toUpperCase() }}
        </div>
      </div>
      <div class="text-left">
        <h2 class="font-display text-3xl font-bold text-zinc-50" style="letter-spacing: 0.05em;">
          {{ pilotName }}
        </h2>
        <p class="font-ui mt-1 text-sm font-medium text-zinc-500 tabular-nums">
          {{ offline ? 'Flying offline · local scores only' : email }}
          <span v-if="best > 0"> · Best <span class="font-semibold text-zinc-300">{{ best.toLocaleString() }}</span></span>
        </p>
      </div>
    </div>

    <div class="mt-8 grid w-full items-start gap-5 md:grid-cols-[1fr_1.1fr]">
      <!-- Left: Action cards -->
      <div class="grid gap-3">
        <!-- Single Player card -->
        <button
          type="button"
          class="group relative overflow-hidden rounded-2xl border border-white/6 bg-panel/90 p-6 text-left transition-all duration-300 hover:border-accent/35"
          @click="$emit('single')"
        >
          <div class="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
            style="background: radial-gradient(ellipse at 20% 50%, rgba(56,189,248,0.07) 0%, transparent 70%);" />
          <div class="relative">
            <div class="mb-3 flex items-center gap-3">
              <div class="flex h-10 w-10 items-center justify-center rounded-xl"
                style="background: rgba(56,189,248,0.15); border: 1px solid rgba(56,189,248,0.25);">
                <svg class="h-5 w-5 text-accent" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><polygon points="5 3 19 12 5 21 5 3"/></svg>
              </div>
              <div>
                <div class="font-ui text-base font-bold text-zinc-100 transition-colors group-hover:text-accent" style="letter-spacing: 0.06em;">SINGLE PLAYER</div>
                <div class="label text-[10px]">Arcade mode</div>
              </div>
            </div>
            <p class="font-ui text-sm font-medium leading-relaxed text-zinc-500">Pick a ship, survive the waves, chase your personal best. Fully offline capable.</p>
            <div class="font-ui mt-4 inline-flex items-center gap-1.5 text-[13px] font-semibold text-accent opacity-0 transition-opacity group-hover:opacity-100">
              Launch <svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="9 18 15 12 9 6"/></svg>
            </div>
          </div>
        </button>

        <!-- Multiplayer card -->
        <button
          type="button"
          class="group relative overflow-hidden rounded-2xl border border-white/6 bg-panel/90 p-6 text-left transition-all duration-300 hover:border-missile/35"
          :class="offline ? 'cursor-not-allowed' : ''"
          :disabled="offline"
          :title="offline ? 'Log in to race friends in live score rooms.' : ''"
          @click="$emit('multi')"
        >
          <div class="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
            style="background: radial-gradient(ellipse at 20% 50%, rgba(251,146,60,0.07) 0%, transparent 70%);" />
          <div class="relative" :class="offline ? 'opacity-50' : ''">
            <div class="mb-3 flex items-center gap-3">
              <div class="flex h-10 w-10 items-center justify-center rounded-xl"
                style="background: rgba(251,146,60,0.15); border: 1px solid rgba(251,146,60,0.25);">
                <svg class="h-5 w-5 text-missile" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14.5 10c-.83 0-1.5-.67-1.5-1.5v-5c0-.83.67-1.5 1.5-1.5s1.5.67 1.5 1.5v5c0 .83-.67 1.5-1.5 1.5z"/><path d="M20.5 10H19V8.5c0-.83.67-1.5 1.5-1.5s1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"/><path d="M9.5 14c.83 0 1.5.67 1.5 1.5v5c0 .83-.67 1.5-1.5 1.5S8 21.33 8 20.5v-5c0-.83.67-1.5 1.5-1.5z"/><path d="M3.5 14H5v1.5c0 .83-.67 1.5-1.5 1.5S2 16.33 2 15.5 2.67 14 3.5 14z"/><path d="M14 14.5c0-.83.67-1.5 1.5-1.5h5c.83 0 1.5.67 1.5 1.5s-.67 1.5-1.5 1.5h-5c-.83 0-1.5-.67-1.5-1.5z"/><path d="M15.5 19H14v1.5c0 .83.67 1.5 1.5 1.5s1.5-.67 1.5-1.5-.67-1.5-1.5-1.5z"/><path d="M10 9.5C10 8.67 9.33 8 8.5 8h-5C2.67 8 2 8.67 2 9.5S2.67 11 3.5 11h5c.83 0 1.5-.67 1.5-1.5z"/><path d="M8.5 5H10V3.5C10 2.67 9.33 2 8.5 2S7 2.67 7 3.5 7.67 5 8.5 5z"/></svg>
              </div>
              <div>
                <div class="font-ui text-base font-bold text-zinc-100 transition-colors group-hover:text-missile" style="letter-spacing: 0.06em;">MULTIPLAYER</div>
                <div class="label text-[10px]">Live score rooms</div>
              </div>
            </div>
            <p class="font-ui text-sm font-medium leading-relaxed text-zinc-500">
              {{ offline ? 'Log in to race friends in live score rooms.' : 'Create or join a room, race live against friends.' }}
            </p>
            <div v-if="!offline" class="font-ui mt-4 inline-flex items-center gap-1.5 text-[13px] font-semibold text-missile opacity-0 transition-opacity group-hover:opacity-100">
              Enter Lobby <svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="9 18 15 12 9 6"/></svg>
            </div>
          </div>
        </button>

        <!-- Logout button -->
        <button type="button" class="btn-danger font-ui mt-1 justify-start text-sm font-semibold" @click="$emit('logout')">
          <svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
          {{ offline ? 'Back to login' : 'Log out' }}
        </button>
      </div>

      <!-- Right: Leaderboard -->
      <div class="min-w-0">
        <Leaderboard :cloud="cloud" />
      </div>
    </div>
  </div>
</template>
