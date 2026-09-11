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
  <div class="flex w-full max-w-4xl flex-col items-center">
    <div class="label">Neon Strike — Command deck</div>
    <div class="mt-3 flex items-center gap-3">
      <img
        v-if="photo"
        :src="photo"
        alt="Pilot avatar"
        class="h-12 w-12 rounded-full border border-white/15 object-cover"
      />
      <div
        v-else
        class="flex h-12 w-12 items-center justify-center rounded-full border border-white/15 bg-white/5 text-xl font-semibold text-accent"
      >
        {{ (pilotName || 'P').trim().charAt(0).toUpperCase() }}
      </div>
      <div class="text-left">
        <h2 class="text-3xl font-semibold text-zinc-50">
          Welcome, <span class="text-accent">{{ pilotName }}</span>
        </h2>
      </div>
    </div>
    <p class="mt-2 text-[13px] text-zinc-500 tabular-nums">
      {{ offline ? 'Flying offline · local scores only' : email }}
      <span v-if="best > 0"> · Best {{ best.toLocaleString() }}</span>
    </p>

    <div class="mt-6 grid w-full items-start gap-6 md:grid-cols-[1fr_1.1fr]">
      <div>
        <div class="grid gap-3">
      <button
        type="button"
        class="panel group p-5 text-left transition-all hover:border-accent/50"
        @click="$emit('single')"
      >
        <div class="flex items-center gap-2 text-base font-semibold text-zinc-100 group-hover:text-accent"><UiIcon name="play" cls="h-4 w-4" />Single player</div>
        <p class="mt-1 text-[13px] text-zinc-500">Pick a ship, survive the waves, chase your best.</p>
      </button>

      <button
        type="button"
        class="panel group p-5 text-left transition-all"
        :class="offline ? 'opacity-50' : 'hover:border-missile/50'"
        :disabled="offline"
        title="Multiplayer needs an online account"
        @click="$emit('multi')"
      >
        <div class="flex items-center gap-2 text-base font-semibold text-zinc-100 group-hover:text-missile"><UiIcon name="swords" cls="h-4 w-4" />Multiplayer race</div>
        <p class="mt-1 text-[13px] text-zinc-500">
          {{ offline ? 'Log in to race friends in live score rooms.' : 'Create or join a room, race live scores.' }}
        </p>
      </button>

      <button
        type="button"
        class="panel group p-5 text-left transition-all hover:border-white/25"
        @click="$emit('profile')"
      >
        <div class="flex items-center gap-2 text-base font-semibold text-zinc-100"><UiIcon name="user" cls="h-4 w-4" />Profile</div>
        <p class="mt-1 text-[13px] text-zinc-500">Callsign, picture, ships, best score.</p>
      </button>

      <button
        type="button"
        class="panel group p-5 text-left transition-all hover:border-white/25"
        @click="$emit('settings')"
      >
        <div class="flex items-center gap-2 text-base font-semibold text-zinc-100"><UiIcon name="sliders" cls="h-4 w-4" />Settings</div>
        <p class="mt-1 text-[13px] text-zinc-500">Sound, shake, FPS meter, callsign.</p>
      </button>
        </div>

        <button
          type="button"
          class="mt-4 rounded-lg border border-danger/30 px-4 py-2 text-[12px] font-semibold text-danger transition-colors hover:bg-danger/10"
          @click="$emit('logout')"
        >
          {{ offline ? '← Back to login' : 'Log out' }}
        </button>
      </div>
      <div class="min-w-0">
        <Leaderboard :cloud="cloud" />
      </div>
    </div>
  </div>
</template>
