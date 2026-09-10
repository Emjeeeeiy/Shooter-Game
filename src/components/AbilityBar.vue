<script setup>
import { computed } from 'vue';
import { dash as DASH, missile as MISSILE, shock as SHOCK } from '../game/constants.js';

const props = defineProps({
  hud: { type: Object, required: true },
});

const abilities = computed(() => [
  {
    key: 'Shift',
    name: 'Dash',
    icon: 'dash',
    color: 'text-zinc-100',
    ready: (props.hud.dashCharges ?? 0) > 0,
    cooldown: 0,
    charges: props.hud.dashCharges ?? 0,
    max: props.hud.dashMax ?? 2,
    cost: DASH.energyCost,
  },
  {
    key: 'C',
    name: 'Missiles',
    icon: 'missile',
    color: 'text-missile',
    ready: props.hud.missileCooldown === 0,
    cooldown: props.hud.missileCooldown,
    cost: MISSILE.energyCost,
  },
  {
    key: 'E',
    name: props.hud.ultimateName ?? 'Shock',
    icon: 'shock',
    color: 'text-shock',
    ready: props.hud.shockCooldown === 0,
    cooldown: props.hud.shockCooldown,
    cost: SHOCK.energyCost,
  },
]);
</script>

<template>
  <div class="flex gap-2">
    <div
      v-for="ability in abilities"
      :key="ability.name"
      class="panel relative w-[104px] overflow-hidden px-3 py-2.5 transition-opacity duration-200"
      :class="ability.ready ? 'opacity-100' : 'opacity-70'"
    >
      <div class="relative z-10 flex items-center justify-between gap-2">
        <span :class="ability.ready ? ability.color : 'text-zinc-500'">
          <svg
            class="h-4 w-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.7"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <template v-if="ability.icon === 'dash'">
              <path d="M5 5l6 7-6 7" />
              <path d="M13 5l6 7-6 7" />
            </template>
            <template v-else-if="ability.icon === 'missile'">
              <path d="M3 5h7m0 0-2.5-2.5M10 5 7.5 7.5" />
              <path d="M3 12h13m0 0-3-3M16 12l-3 3" />
              <path d="M3 19h7m0 0-2.5-2.5M10 19l-2.5 2.5" />
            </template>
            <template v-else>
              <circle cx="12" cy="12" r="2.5" />
              <circle cx="12" cy="12" r="6.5" opacity="0.65" />
              <circle cx="12" cy="12" r="10.5" opacity="0.35" />
            </template>
          </svg>
        </span>
        <kbd>{{ ability.key }}</kbd>
      </div>

      <div class="label relative z-10 mt-2">{{ ability.name }}</div>
      <div class="relative z-10 mt-0.5 flex items-center gap-1 text-[10px] font-semibold text-accent tabular-nums">
        <svg class="h-2.5 w-2.5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z" />
        </svg>
        {{ ability.cost }}
      </div>

      <div v-if="ability.charges !== undefined" class="relative z-10 mt-1 flex gap-1">
        <span
          v-for="i in ability.max"
          :key="i"
          class="h-1 flex-1 rounded-full"
          :class="i <= ability.charges ? 'bg-zinc-100' : 'bg-white/15'"
        />
      </div>

      <div
        class="absolute inset-x-0 bottom-0 z-20 bg-surface/75"
        :style="{ height: ability.cooldown * 100 + '%' }"
      />
    </div>
  </div>
</template>
