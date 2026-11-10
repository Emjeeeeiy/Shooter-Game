<script setup>
defineProps({
  bare: { type: Boolean, default: false },
  /** 'keyboard' | 'touch' — which control scheme to explain. */
  mode: { type: String, default: 'keyboard' },
});

const touchControls = [
  { badge: 'Left', action: 'Move — touch and drag anywhere on the left side' },
  { badge: 'Aim', action: 'Aim and fire — drag the right stick; tap its centre to shoot ahead' },
  { badge: 'Dash', action: 'Dash — invincible, kills on contact (10 energy)' },
  { badge: 'MSL', action: 'Missiles — homing volley (25 energy)' },
  { badge: 'Ult', action: 'Ship ultimate — varies by hull' },
  { badge: '❚❚', action: 'Pause — top-right button' },
];

const controls = [
  { keys: ['W', 'A', 'S', 'D'], action: 'Move' },
  { keys: ['Mouse'], action: 'Aim' },
  { keys: ['Click', 'Space'], action: 'Fire (hold)' },
  { keys: ['Shift'], action: 'Dash — invincible (10 energy)' },
  { keys: ['C'], action: 'Missiles — homing volley, no cooldown (25 energy)' },
  { keys: ['E'], action: 'Ship ultimate — varies by hull (energy + 5s)' },
  { keys: ['P', 'Esc'], action: 'Pause' },
  { keys: ['M'], action: 'Mute' },
];

const targets = [
  { shape: '8,1 15,8 8,15 1,8', color: 'text-danger', name: 'Standard', effect: 'No buff' },
  { shape: '14,8 11,13.2 5,13.2 2,8 5,2.8 11,2.8', color: 'text-skill', name: 'Gold', effect: 'Skill Enhanced' },
  { shape: '2.5,2.5 13.5,2.5 13.5,13.5 2.5,13.5', color: 'text-accent', name: 'Cyan', effect: 'Overcharge: fast regen' },
  { shape: '8,1 15,14 1,14', color: 'text-danger', name: 'Charger', effect: 'Lunges — dodge sideways' },
  { shape: '8,1 8,15 1,8 15,8', color: 'text-fuchsia-400', name: 'Sniper', effect: 'Strafes at range' },
  { shape: '8,1 14,6 12,13 4,13 2,6', color: 'text-yellow-300', name: 'Splitter', effect: 'Splits in two' },
  { shape: '5,1 11,1 11,5 15,5 15,11 11,11 11,15 5,15 5,11 1,11 1,5 5,5', color: 'text-repair', name: 'Repair', effect: '+30 integrity' },
];

const tips = [
  'Chain kills for a combo multiplier (up to x5) — taking damage resets it.',
  'Dash is invincible and kills on contact. It only chips bosses.',
  'Every 10 waves the threat tier rises: faster, tougher, new breeds.',
  'A boss lands every 20 waves — Dreadnought, Star-Wyrm, Hydra, Carrier.',
  'Green crosses heal, bolts restore energy, violet orbs grant Magnet.',
  'Multiplayer lobbies choose ship, map and mode before deploy.',
  'Each hull dashes and shoots differently — check the hangar.',
];
</script>

<template>
  <aside :class="bare ? 'w-full' : 'panel w-full p-5'">
    <div class="label">How to play</div>
    <h2 class="font-display mt-1 text-base font-bold text-zinc-100">Briefing</h2>

    <div class="mt-3 space-y-2">
      <template v-if="mode === 'touch'">
        <div v-for="c in touchControls" :key="c.badge" class="flex items-start gap-2.5">
          <span
            class="inline-flex min-w-11 shrink-0 justify-center rounded-md border border-white/12 bg-white/6 px-1.5 py-0.5 text-[11px] font-bold text-zinc-300"
          >
            {{ c.badge }}
          </span>
          <span class="text-[13px] leading-snug text-zinc-400">{{ c.action }}</span>
        </div>
      </template>
      <template v-else>
        <div v-for="c in controls" :key="c.action" class="flex items-center gap-2.5">
          <span class="flex w-26 shrink-0 flex-wrap gap-1">
            <kbd v-for="k in c.keys" :key="k">{{ k }}</kbd>
          </span>
          <span class="text-[13px] leading-snug text-zinc-400">{{ c.action }}</span>
        </div>
      </template>
    </div>

    <div class="mt-4 border-t border-white/10 pt-3">
      <div class="label">Targets</div>
      <ul class="mt-2 grid gap-1.5 sm:grid-cols-2">
        <li v-for="t in targets" :key="t.name" class="flex min-w-0 items-center gap-2">
          <svg class="h-3.5 w-3.5 shrink-0" viewBox="0 0 16 16" :class="t.color">
            <polygon :points="t.shape" fill="currentColor" fill-opacity="0.9" />
          </svg>
          <span class="shrink-0 text-[13px] font-medium text-zinc-300">{{ t.name }}</span>
          <span class="truncate text-[13px] text-zinc-500">{{ t.effect }}</span>
        </li>
      </ul>
    </div>

    <div class="mt-4 border-t border-white/10 pt-3">
      <div class="label">Tips</div>
      <ul class="mt-2 list-disc space-y-1 pl-4 text-[13px] leading-relaxed text-zinc-400">
        <li v-for="tip in tips" :key="tip">{{ tip }}</li>
      </ul>
    </div>
  </aside>
</template>
