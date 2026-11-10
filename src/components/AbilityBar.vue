<script setup>
import { computed } from 'vue';
import { dash as DASH, missile as MISSILE, shock as SHOCK } from '../game/constants.js';
import AbilityIcon from './AbilityIcon.vue';

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
    icon: 'ult',
    color: 'text-shock',
    ready: props.hud.shockCooldown === 0,
    cooldown: props.hud.shockCooldown,
    cost: props.hud.ultimateCost ?? SHOCK.energyCost,
  },
]);
</script>

<template>
  <div class="flex gap-2">
    <div
      v-for="ability in abilities"
      :key="ability.key"
      class="relative w-26 overflow-hidden rounded-xl border border-white/10 bg-surface/70 px-3 py-2.5 transition-opacity duration-200"
      :class="ability.ready ? 'opacity-100' : 'opacity-70'"
    >
      <div class="relative z-10 flex items-center justify-between gap-2">
        <span :class="ability.ready ? ability.color : 'text-zinc-500'">
          <AbilityIcon :name="ability.icon" cls="h-4 w-4" />
        </span>
        <kbd>{{ ability.key }}</kbd>
      </div>

      <div class="label relative z-10 mt-2 truncate">{{ ability.name }}</div>
      <div class="relative z-10 mt-0.5 flex items-center gap-1 text-[11px] font-semibold text-accent tabular-nums">
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

      <div class="absolute inset-x-0 bottom-0 z-20 bg-surface/75" :style="{ height: ability.cooldown * 100 + '%' }" />
    </div>
  </div>
</template>
