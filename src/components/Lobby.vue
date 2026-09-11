<script setup>
import { computed, ref } from 'vue';
import { CHARACTER_LIST, MAP_PICKS } from '../game/constants.js';
import MapPreview from './MapPreview.vue';
import ShipPreview from './ShipPreview.vue';

const props = defineProps({
  selectedId: { type: String, default: 'vanguard' },
  mapPick: { type: String, default: 'grid' },
});
defineEmits(['select', 'map-pick', 'launch', 'back']);

const step = ref('ship'); // 'ship' → 'map'

const STAT_ROWS = [
  { key: 'speed', label: 'Speed' },
  { key: 'hull', label: 'Hull' },
  { key: 'fire', label: 'Fire Rate' },
  { key: 'dash', label: 'Dash' },
];

const current = computed(
  () => CHARACTER_LIST.find((c) => c.id === props.selectedId) ?? CHARACTER_LIST[0],
);
</script>

<template>
  <div class="w-full max-w-5xl">
    <div class="flex w-full justify-start">
      <button
        type="button"
        class="btn-ghost gap-1.5 py-1.5 text-xs"
        @click="$emit('back')"
      >
        <svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
        Back
      </button>
    </div>
    <!-- Header -->
    <div class="text-center">
      <div class="label">Neon Strike — Hangar</div>
      <h2 class="font-display mt-2 text-3xl font-bold text-zinc-50" style="letter-spacing: 0.06em;">
        {{ step === 'ship' ? 'CHOOSE YOUR SHIP' : 'CHOOSE ARENA' }}
      </h2>
      <p class="font-ui mt-2 text-sm font-medium text-zinc-500">
        {{
          step === 'ship'
            ? 'Each hull flies differently. You can switch after every run.'
            : 'Tap an arena to launch immediately.'
        }}
      </p>
    </div>

    <!-- Ship selection -->
    <div v-if="step === 'ship'" class="mt-7 grid items-start gap-5 md:grid-cols-[360px_minmax(0,1fr)]">
      <!-- Ship grid -->
      <div class="grid grid-cols-2 gap-2.5">
        <button
          v-for="c in CHARACTER_LIST"
          :key="c.id"
          type="button"
          class="group relative flex flex-col items-center gap-2 rounded-2xl border border-white/[0.06] bg-panel/80 p-4 text-center transition-all duration-200 focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
          :style="c.id === selectedId
            ? `background: color-mix(in srgb, ${c.color} 14%, var(--color-panel)); border-color: ${c.color}50; box-shadow: 0 0 20px ${c.color}20;`
            : ''"
          @click="$emit('select', c.id)"
        >
          <!-- Selected ring pulse -->
          <div v-if="c.id === selectedId"
            class="pointer-events-none absolute inset-0 rounded-2xl"
            :style="`box-shadow: inset 0 0 0 1px ${c.color}40;`"
          />
          <ShipPreview :id="c.id" :color="c.color" />
          <span class="w-full truncate text-[13px] font-semibold"
            :class="c.id === selectedId ? 'text-zinc-100' : 'text-zinc-400 group-hover:text-zinc-200'"
          >{{ c.name }}</span>
          <div v-if="c.id === selectedId" class="h-1 w-6 rounded-full" :style="`background: ${c.color}; box-shadow: 0 0 8px ${c.color};`" />
        </button>
      </div>

      <!-- Ship details card -->
      <div class="panel-elevated p-6 sm:p-7">
        <div class="flex flex-wrap items-center gap-4 border-b border-white/[0.06] pb-5">
          <div class="relative">
            <div class="rounded-2xl p-3" :style="`background: ${current.color}18; border: 1px solid ${current.color}30;`">
              <ShipPreview :id="current.id" :color="current.color" />
            </div>
          </div>
          <div>
            <div class="font-display text-2xl font-bold text-zinc-100" style="letter-spacing: 0.04em;">{{ current.name }}</div>
            <div class="label mt-1" :style="`color: ${current.color};`">{{ current.title }}</div>
          </div>
        </div>

        <p class="mt-4 text-[13px] leading-relaxed text-zinc-400">{{ current.desc }}</p>

        <!-- Abilities -->
        <div class="mt-4 space-y-2.5 border-t border-white/[0.06] pt-4">
          <div class="flex gap-2 items-start">
            <span class="mt-0.5 shrink-0 rounded-md bg-white/[0.06] px-2 py-0.5 text-[10px] font-bold text-zinc-400 uppercase">Passive</span>
            <div>
              <span class="text-[13px] font-semibold text-zinc-200">{{ current.passive.name }}</span>
              <span class="ml-1.5 text-[12px] text-zinc-500">{{ current.passive.desc }}</span>
            </div>
          </div>
          <div class="flex gap-2 items-start">
            <kbd class="mt-0.5 shrink-0">E</kbd>
            <div>
              <span class="text-[13px] font-semibold text-zinc-200">{{ current.ultimate.name }}</span>
              <span class="ml-1.5 text-[11px] text-zinc-600">{{ current.ultimate.cooldownTicks / 60 }}s cd</span>
              <p class="text-[12px] text-zinc-500">{{ current.ultimate.desc }}</p>
            </div>
          </div>
          <div class="flex gap-2 items-start">
            <span class="mt-0.5 shrink-0 rounded-md bg-white/[0.06] px-2 py-0.5 text-[10px] font-bold text-zinc-400 uppercase">Kit</span>
            <span class="text-[12px] text-zinc-500">{{ current.kit }}</span>
          </div>
        </div>

        <!-- Stats bars -->
        <div class="mt-4 space-y-2.5 border-t border-white/[0.06] pt-4">
          <div v-for="s in STAT_ROWS" :key="s.key" class="flex items-center gap-3">
            <span class="label w-18 shrink-0 text-right">{{ s.label }}</span>
            <div class="flex flex-1 gap-1">
              <div
                v-for="i in 5"
                :key="i"
                class="h-1.5 flex-1 rounded-full transition-all duration-300"
                :style="i <= current.stats[s.key]
                  ? `background: ${current.color}; box-shadow: 0 0 4px ${current.color}80;`
                  : ''"
                :class="i <= current.stats[s.key] ? '' : 'bg-white/[0.08]'"
              />
            </div>
            <span class="w-4 text-right text-[11px] text-zinc-600 tabular-nums">{{ current.stats[s.key] }}/5</span>
          </div>
        </div>

        <button
          type="button"
          class="btn-primary font-ui mt-6 w-full py-3.5 font-bold tracking-wider"
          @click="step = 'map'"
        >
          Continue with {{ current.name }}
          <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="9 18 15 12 9 6"/></svg>
        </button>
      </div>
    </div>

    <!-- Map selection -->
    <div v-else class="mt-7">
      <div class="mb-5 flex items-center gap-3">
        <button
          type="button"
          class="btn-ghost text-[13px]"
          @click="step = 'ship'"
        >
          <svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="15 18 9 12 15 6"/></svg>
          Back to ships
        </button>
        <div class="flex items-center gap-2 text-[13px] text-zinc-400">
          <div class="rounded-xl p-1.5" :style="`background: ${current.color}18; border: 1px solid ${current.color}30;`">
            <ShipPreview :id="current.id" :color="current.color" />
          </div>
          <span class="font-semibold text-zinc-200">{{ current.name }}</span> locked in
        </div>
      </div>

      <div class="grid max-w-4xl grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 mx-auto">
        <button
          v-for="mp in MAP_PICKS"
          :key="mp.id"
          type="button"
          class="group relative overflow-hidden rounded-2xl border border-white/[0.06] p-1 text-left transition-all duration-200 focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
          :style="mapPick === mp.id
            ? 'border-color: rgba(56,189,248,0.4); box-shadow: 0 0 20px rgba(56,189,248,0.1);'
            : ''"
          @click="$emit('map-pick', mp.id); $emit('launch')"
        >
          <MapPreview :map-id="mp.id" />
          <div class="p-3">
            <div class="flex items-center gap-2">
              <div v-if="mapPick === mp.id" class="h-1.5 w-1.5 rounded-full bg-accent" style="box-shadow: 0 0 6px rgba(56,189,248,0.8);" />
              <div class="text-[13px] font-bold text-zinc-100" style="font-family: 'Outfit', sans-serif;">{{ mp.name }}</div>
            </div>
            <div class="mt-0.5 text-[11px] leading-snug text-zinc-500">{{ mp.desc }}</div>
          </div>
          <!-- Hover overlay -->
          <div class="pointer-events-none absolute inset-0 rounded-2xl opacity-0 transition-opacity duration-200 group-hover:opacity-100" style="background: linear-gradient(to bottom, transparent 40%, rgba(56,189,248,0.06));"/>
        </button>
      </div>
    </div>
  </div>
</template>
