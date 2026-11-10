<script setup>
import Avatar from './ui/Avatar.vue';
import Leaderboard from './Leaderboard.vue';
import UiIcon from './UiIcon.vue';

defineProps({
  pilotName: { type: String, default: 'Pilot' },
  email: { type: String, default: '' },
  offline: { type: Boolean, default: false },
  best: { type: Number, default: 0 },
  cloud: { type: Boolean, default: false },
  photo: { type: String, default: '' },
  /** Phone layout: leaderboard lives in the Ranks tab; log out in Profile. */
  compact: { type: Boolean, default: false },
});

defineEmits(['single', 'multi', 'ranks', 'logout']);
</script>

<template>
  <div
    class="px-safe mx-auto grid h-full min-h-0 w-full max-w-6xl gap-3 py-3 short:grid-cols-[minmax(0,0.85fr)_minmax(0,1.4fr)] short:py-2.5 roomy:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] roomy:gap-6 roomy:py-8"
    :class="compact ? 'grid-rows-[minmax(0,1fr)_auto]' : ''"
  >
    <!-- ─── Pilot card ─────────────────────────────────────────────────── -->
    <div class="flex min-h-0 flex-col gap-3 short:contents roomy:gap-4">
      <div
        class="panel flex min-w-0 items-center gap-3 p-3 short:flex-col short:items-start short:justify-center short:gap-2 short:p-4 roomy:gap-4 roomy:p-5"
      >
        <div class="shrink-0 short:hidden"><Avatar :photo="photo" :name="pilotName" :size="compact ? 'lg' : 'xl'" /></div>
        <div class="hidden shrink-0 short:block"><Avatar :photo="photo" :name="pilotName" size="md" /></div>
        <div class="min-w-0 flex-1 short:w-full short:flex-none">
          <div class="label">Command deck</div>
          <h2 class="font-display truncate text-xl leading-tight font-bold text-zinc-50 roomy:text-3xl">
            {{ pilotName }}
          </h2>
          <p class="truncate text-[13px] text-zinc-500">
            {{ offline ? 'Flying offline · local scores only' : email }}
          </p>
        </div>
        <div class="shrink-0 text-right short:mt-1 short:text-left">
          <div class="label">Best</div>
          <div class="font-display text-lg font-bold text-accent tabular-nums roomy:text-xl">
            {{ best > 0 ? best.toLocaleString() : '—' }}
          </div>
        </div>
        <button
          v-if="compact"
          type="button"
          class="btn-ghost btn-sm mt-auto hidden w-full short:inline-flex"
          @click="$emit('ranks')"
        >
          <UiIcon name="trophy" cls="h-4 w-4" /> Leaderboard
        </button>
      </div>

      <!-- ─── Mode cards ───────────────────────────────────────────────── -->
      <div class="grid min-h-0 flex-1 grid-rows-2 gap-3 roomy:max-h-[30rem] roomy:gap-4">
        <button
          type="button"
          class="group panel relative flex min-h-0 items-center gap-4 overflow-hidden p-4 text-left transition-all duration-200 hover:border-accent/40 active:scale-[0.99] roomy:p-6"
          @click="$emit('single')"
        >
          <span
            class="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_15%_50%,var(--color-accent-glow),transparent_65%)] opacity-60 transition-opacity group-hover:opacity-100"
          />
          <span
            class="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-accent/25 bg-accent/15 text-accent roomy:h-14 roomy:w-14"
          >
            <UiIcon name="play" cls="h-5 w-5 roomy:h-6 roomy:w-6" />
          </span>
          <span class="relative min-w-0 flex-1">
            <span class="font-ui block text-base font-bold tracking-[0.08em] text-zinc-100 roomy:text-lg">SINGLE PLAYER</span>
            <span class="label block">Arcade mode</span>
            <span class="mt-1 line-clamp-2 block text-[13px] leading-snug text-zinc-500 [@media(max-height:620px)]:hidden roomy:text-sm">
              Pick a ship, survive the waves, chase your personal best. Works offline.
            </span>
          </span>
          <span class="relative flex shrink-0 items-center gap-1 text-[13px] font-semibold text-accent">
            <span class="hidden roomy:inline">Launch</span>
            <UiIcon name="chevron-right" cls="h-5 w-5 transition-transform group-hover:translate-x-0.5" />
          </span>
        </button>

        <button
          type="button"
          class="group panel relative flex min-h-0 items-center gap-4 overflow-hidden p-4 text-left transition-all duration-200 roomy:p-6"
          :class="offline ? 'cursor-not-allowed' : 'hover:border-missile/40 active:scale-[0.99]'"
          :disabled="offline"
          :aria-describedby="offline ? 'mp-offline' : undefined"
          @click="$emit('multi')"
        >
          <span
            v-if="!offline"
            class="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_15%_50%,color-mix(in_srgb,var(--color-missile)_18%,transparent),transparent_65%)] opacity-60 transition-opacity group-hover:opacity-100"
          />
          <span
            class="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-missile/25 bg-missile/15 text-missile roomy:h-14 roomy:w-14"
            :class="offline ? 'opacity-50' : ''"
          >
            <UiIcon name="swords" cls="h-5 w-5 roomy:h-6 roomy:w-6" />
          </span>
          <span class="relative min-w-0 flex-1" :class="offline ? 'opacity-60' : ''">
            <span class="font-ui block text-base font-bold tracking-[0.08em] text-zinc-100 roomy:text-lg">MULTIPLAYER</span>
            <span class="label block">Live score rooms</span>
            <span
              id="mp-offline"
              class="mt-1 line-clamp-2 block text-[13px] leading-snug text-zinc-500 roomy:text-sm"
              :class="offline ? '' : '[@media(max-height:620px)]:hidden'"
            >
              {{ offline ? 'Log in to race friends in live score rooms.' : 'Create or join a room and race friends live.' }}
            </span>
          </span>
          <span v-if="!offline" class="relative flex shrink-0 items-center gap-1 text-[13px] font-semibold text-missile">
            <span class="hidden roomy:inline">Enter lobby</span>
            <UiIcon name="chevron-right" cls="h-5 w-5 transition-transform group-hover:translate-x-0.5" />
          </span>
        </button>
      </div>

      <!-- Desktop footer: log out + keyboard hints -->
      <div class="mt-auto hidden items-center justify-between gap-3 roomy:flex">
        <button type="button" class="btn-danger btn-sm" @click="$emit('logout')">
          <UiIcon name="logout" cls="h-4 w-4" />
          {{ offline ? 'Back to login' : 'Log out' }}
        </button>
        <p class="truncate text-xs text-zinc-500 pointer-coarse:hidden">
          {{ cloud ? 'Scores sync to the global board' : 'Scores are stored in this browser' }} · <kbd>P</kbd> pause ·
          <kbd>M</kbd> mute
        </p>
      </div>
    </div>

    <!-- ─── Leaderboard: full column on roomy, top-3 preview on phones ──── -->
    <div class="hidden min-h-0 roomy:flex roomy:flex-col">
      <Leaderboard :cloud="cloud" class="flex-1" />
    </div>
    <div v-if="compact" class="min-h-0 short:hidden roomy:hidden">
      <Leaderboard :cloud="cloud" :limit="3" @more="$emit('ranks')" />
    </div>
  </div>
</template>
