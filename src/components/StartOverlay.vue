<script setup>
defineEmits(['start']);

const controls = [
  { keys: ['W', 'A', 'S', 'D'], action: 'Move' },
  { keys: ['Mouse'], action: 'Aim' },
  { keys: ['Left Click'], action: 'Fire plasma' },
  { keys: ['Shift'], action: 'Dash — invincible, kills on contact' },
  { keys: ['C'], action: 'Missile volley — 10 homing, 5s' },
  { keys: ['E'], action: 'Shock wave — clears the field, 15s' },
];

// Shapes and colors match how these enemies are drawn on the canvas.
const targets = [
  {
    shape: '8,1 15,8 8,15 1,8',
    color: 'text-danger',
    name: 'Standard',
    effect: 'No buff',
  },
  {
    shape: '14,8 11,13.2 5,13.2 2,8 5,2.8 11,2.8',
    color: 'text-skill',
    name: 'Gold',
    effect: 'Skill Enhanced',
  },
  {
    shape: '2.5,2.5 13.5,2.5 13.5,13.5 2.5,13.5',
    color: 'text-accent',
    name: 'Cyan',
    effect: 'Infinite Ammo',
  },
];
</script>

<template>
  <div class="absolute inset-0 z-30 flex items-center justify-center bg-surface/70 backdrop-blur-md">
    <div class="panel w-full max-w-md p-6 sm:p-7">
      <div class="label">Neon Strike</div>
      <h2 class="mt-1 text-2xl font-semibold text-zinc-50">System ready</h2>

      <dl class="mt-6 space-y-2.5">
        <div v-for="control in controls" :key="control.action" class="flex items-center gap-3">
          <dt class="flex w-[112px] shrink-0 flex-wrap gap-1">
            <kbd v-for="key in control.keys" :key="key">{{ key }}</kbd>
          </dt>
          <dd class="text-[13px] text-zinc-400">{{ control.action }}</dd>
        </div>
      </dl>

      <div class="mt-6 border-t border-white/10 pt-4">
        <div class="label">Targets</div>
        <ul class="mt-2.5 space-y-2">
          <li v-for="target in targets" :key="target.name" class="flex items-center gap-2.5">
            <svg class="h-4 w-4 shrink-0" viewBox="0 0 16 16" :class="target.color">
              <polygon :points="target.shape" fill="currentColor" fill-opacity="0.9" />
            </svg>
            <span class="text-[13px] font-medium text-zinc-300">{{ target.name }}</span>
            <span class="text-[13px] text-zinc-500">{{ target.effect }}</span>
          </li>
        </ul>
      </div>

      <button
        type="button"
        class="mt-7 w-full rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-surface transition-colors hover:bg-sky-300 focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface focus-visible:outline-none"
        @click="$emit('start')"
      >
        Initialize
      </button>
    </div>
  </div>
</template>
