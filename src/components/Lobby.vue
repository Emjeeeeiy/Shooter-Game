<script setup>
import { computed, ref } from 'vue';
import { CHARACTER_LIST, MAP_PICKS } from '../game/constants.js';
import ShipIcon from './ShipIcon.vue';

const props = defineProps({
  selectedId: { type: String, default: 'vanguard' },
  mapPick: { type: String, default: 'grid' },
});
defineEmits(['select', 'map-pick', 'launch', 'back']);

const step = ref('ship'); // 'ship' → 'map': pick a hull, deploy, then pick an arena

const STAT_ROWS = [
  { key: 'speed', label: 'SPD' },
  { key: 'hull', label: 'HULL' },
  { key: 'fire', label: 'FIRE' },
  { key: 'dash', label: 'DASH' },
];

const current = computed(
  () => CHARACTER_LIST.find((c) => c.id === props.selectedId) ?? CHARACTER_LIST[0],
);
</script>

<template>
  <div class="w-full max-w-5xl">
    <div class="text-center">
      <div class="label">Neon Strike — Hangar</div>
      <h2 class="mt-1 text-3xl font-semibold text-zinc-50">
        {{ step === 'ship' ? 'Choose your ship' : 'Choose your arena' }}
      </h2>
      <p class="mt-2 text-[13px] text-zinc-500">
        {{
          step === 'ship'
            ? 'Each hull flies differently. You can switch ships after every run.'
            : 'Deploy first, fight second — where to?'
        }}
      </p>
    </div>

    <div v-if="step === 'ship'" class="mt-6 grid gap-4 sm:grid-cols-2">
      <button
        v-for="c in CHARACTER_LIST"
        :key="c.id"
        type="button"
        class="panel p-5 text-left transition-all focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
        :class="c.id === selectedId ? 'border-accent ring-2 ring-accent/40' : 'hover:border-white/25'"
        @click="$emit('select', c.id)"
      >
        <div class="flex items-center gap-2.5">
          <ShipIcon :id="c.id" :color="c.color" />
          <span class="text-base font-semibold text-zinc-100">{{ c.name }}</span>
          <span
            v-if="c.id === selectedId"
            class="ml-auto rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-bold tracking-widest text-accent uppercase"
          >
            Selected
          </span>
        </div>
        <div class="mt-0.5 text-[12px] font-medium tracking-wide text-zinc-500 uppercase">
          {{ c.title }}
        </div>
        <p class="mt-2 text-[13px] text-zinc-400">{{ c.desc }}</p>

        <div class="mt-3 space-y-1 border-t border-white/5 pt-3 text-[12px] leading-relaxed">
          <div class="flex gap-1.5">
            <span class="shrink-0 font-semibold text-zinc-200">Passive · {{ c.passive.name }}</span>
            <span class="text-zinc-500">{{ c.passive.desc }}</span>
          </div>
          <div class="flex gap-1.5">
            <span class="shrink-0 font-semibold text-zinc-200"><kbd class="mr-1">E</kbd>{{ c.ultimate.name }}</span>
            <span class="text-zinc-500">{{ c.ultimate.desc }}</span>
          </div>
          <div class="flex gap-1.5">
            <span class="shrink-0 font-semibold text-zinc-200">Kit</span>
            <span class="text-zinc-500">{{ c.kit }}</span>
          </div>
        </div>

        <div class="mt-4 space-y-1.5">
          <div v-for="s in STAT_ROWS" :key="s.key" class="flex items-center gap-2">
            <span class="label w-10 shrink-0">{{ s.label }}</span>
            <span class="flex gap-1">
              <span
                v-for="i in 5"
                :key="i"
                class="h-1.5 w-5 rounded-full"
                :style="i <= c.stats[s.key] ? { background: c.color } : {}"
                :class="i <= c.stats[s.key] ? '' : 'bg-white/15'"
              />
            </span>
          </div>
        </div>
      </button>
    </div>

    <div v-else class="mt-6">
      <div class="flex items-center justify-center gap-2.5 text-[13px] text-zinc-400">
        <ShipIcon :id="current.id" :color="current.color" />
        <span><span class="font-semibold text-zinc-100">{{ current.name }}</span> locked in</span>
      </div>
      <div class="mx-auto mt-4 grid max-w-3xl grid-cols-2 gap-2 sm:grid-cols-5">
        <button
          v-for="mp in MAP_PICKS"
          :key="mp.id"
          type="button"
          class="rounded-lg border px-2 py-2.5 text-left transition-all focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
          :class="mapPick === mp.id ? 'border-accent bg-accent/10' : 'border-white/10 hover:border-white/25'"
          @click="$emit('map-pick', mp.id)"
        >
          <div class="text-[12px] font-semibold text-zinc-100">{{ mp.name }}</div>
          <div class="mt-0.5 text-[11px] leading-snug text-zinc-500">{{ mp.desc }}</div>
        </button>
      </div>
    </div>

    <button
      v-if="step === 'ship'"
      type="button"
      class="mt-6 w-full rounded-lg bg-accent px-4 py-3 text-sm font-semibold text-surface transition-colors hover:bg-sky-300 focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface focus-visible:outline-none"
      @click="step = 'map'"
    >
      Continue with {{ current.name }} →
    </button>
    <template v-else>
      <button
        type="button"
        class="mt-6 w-full rounded-lg bg-accent px-4 py-3 text-sm font-semibold text-surface transition-colors hover:bg-sky-300 focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface focus-visible:outline-none"
        @click="$emit('launch')"
      >
        Deploy {{ current.name }} →
      </button>
      <button
        type="button"
        class="mt-3 w-full rounded-lg border border-white/12 px-4 py-2 text-center text-[12px] font-medium text-zinc-400 transition-colors hover:border-white/30 hover:text-zinc-100"
        @click="step = 'ship'"
      >
        ← Back to ships
      </button>
    </template>
    <button
      type="button"
      class="mt-3 w-full rounded-lg border border-white/12 px-4 py-2 text-center text-[12px] font-medium text-zinc-400 transition-colors hover:border-white/30 hover:text-zinc-100"
      @click="$emit('back')"
    >
      ← Back to menu
    </button>
  </div>
</template>
