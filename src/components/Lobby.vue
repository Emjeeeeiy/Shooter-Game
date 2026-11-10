<script setup>
import { computed, ref } from 'vue';
import { CHARACTER_LIST, MAP_PICKS } from '../game/constants.js';
import MapPreview from './MapPreview.vue';
import ShipPreview from './ShipPreview.vue';
import ScreenFrame from './ui/ScreenFrame.vue';
import UiIcon from './UiIcon.vue';

const props = defineProps({
  selectedId: { type: String, default: 'vanguard' },
  mapPick: { type: String, default: 'grid' },
});
const emit = defineEmits(['select', 'map-pick', 'launch', 'back']);

const step = ref('ship'); // 'ship' → 'map'
const showKit = ref(false);

const STAT_ROWS = [
  { key: 'speed', label: 'Speed' },
  { key: 'hull', label: 'Hull' },
  { key: 'fire', label: 'Fire rate' },
  { key: 'dash', label: 'Dash' },
];

const current = computed(() => CHARACTER_LIST.find((c) => c.id === props.selectedId) ?? CHARACTER_LIST[0]);
const currentMap = computed(() => MAP_PICKS.find((m) => m.id === props.mapPick) ?? MAP_PICKS[0]);

function onBack() {
  if (step.value === 'map') step.value = 'ship';
  else emit('back');
}
</script>

<template>
  <ScreenFrame
    :eyebrow="`Hangar · Step ${step === 'ship' ? 1 : 2} of 2`"
    :title="step === 'ship' ? 'Choose your ship' : 'Choose arena'"
    :subtitle="step === 'ship' ? 'Each hull flies differently. Switch after every run.' : 'Pick where you fight, then launch.'"
    back
    :back-label="step === 'map' ? 'Ships' : 'Back'"
    width="max-w-6xl"
    @back="onBack"
  >
    <!-- ─── Step 1: ship ───────────────────────────────────────────────── -->
    <div
      v-if="step === 'ship'"
      class="grid min-h-0 flex-1 grid-rows-[minmax(0,auto)_minmax(8.5rem,1fr)] gap-3 short:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] short:grid-rows-1 roomy:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] roomy:grid-rows-1 roomy:gap-5"
    >
      <!-- Picker: 5×2 on phones, 2-column cards on roomy -->
      <div
        class="order-2 grid min-h-0 auto-rows-fr grid-cols-5 gap-1.5 short:order-1 short:auto-rows-auto short:content-center roomy:order-1 roomy:scroll-area roomy:auto-rows-auto roomy:grid-cols-2 roomy:content-start roomy:gap-2.5"
        role="radiogroup"
        aria-label="Ship"
      >
        <button
          v-for="c in CHARACTER_LIST"
          :key="c.id"
          type="button"
          role="radio"
          :aria-checked="c.id === selectedId"
          :aria-label="`${c.name} — ${c.title}`"
          class="group relative flex min-w-0 flex-col items-center justify-center gap-1 rounded-xl border border-white/7 bg-panel/80 px-1 py-2 text-center transition-all duration-200 focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none roomy:gap-2 roomy:rounded-2xl roomy:p-3"
          :style="
            c.id === selectedId
              ? `background: color-mix(in srgb, ${c.color} 14%, var(--color-panel)); border-color: color-mix(in srgb, ${c.color} 45%, transparent); box-shadow: 0 0 18px color-mix(in srgb, ${c.color} 18%, transparent);`
              : ''
          "
          @click="$emit('select', c.id)"
        >
          <ShipPreview :id="c.id" :color="c.color" cls="w-full max-w-16 short:max-w-12" />
          <span
            class="w-full truncate text-[11px] font-semibold roomy:text-[13px]"
            :class="c.id === selectedId ? 'text-zinc-100' : 'text-zinc-500 group-hover:text-zinc-300'"
          >
            {{ c.name }}
          </span>
        </button>
      </div>

      <!-- Details: always visible, updates on every pick -->
      <div class="panel-elevated order-1 flex min-h-0 flex-col overflow-hidden short:order-2 roomy:order-2">
        <div class="scroll-area flex-1 p-4 short:p-3 roomy:p-7">
          <div class="flex items-center gap-4 border-b border-white/7 pb-3 roomy:pb-5">
            <div
              class="shrink-0 rounded-2xl p-2.5 short:p-1.5"
              :style="`background: color-mix(in srgb, ${current.color} 12%, transparent); border: 1px solid color-mix(in srgb, ${current.color} 25%, transparent);`"
            >
              <ShipPreview :id="current.id" :color="current.color" cls="w-16 short:w-11 roomy:w-20" />
            </div>
            <div class="min-w-0">
              <div class="font-display truncate text-xl font-bold text-zinc-100 roomy:text-2xl">{{ current.name }}</div>
              <div class="label mt-0.5 truncate" :style="{ color: current.color }">{{ current.title }}</div>
            </div>
          </div>

          <p class="mt-3 line-clamp-2 text-[13px] leading-relaxed text-zinc-400 roomy:line-clamp-none">{{ current.desc }}</p>

          <div class="mt-3 space-y-2 roomy:mt-5">
            <div v-for="s in STAT_ROWS" :key="s.key" class="flex items-center gap-3">
              <span class="label w-16 shrink-0">{{ s.label }}</span>
              <div class="flex flex-1 gap-1">
                <div
                  v-for="i in 5"
                  :key="i"
                  class="h-1.5 flex-1 rounded-full transition-all duration-300"
                  :class="i <= current.stats[s.key] ? '' : 'bg-white/8'"
                  :style="i <= current.stats[s.key] ? `background: ${current.color};` : ''"
                />
              </div>
            </div>
          </div>

          <div class="mt-3 space-y-2 border-t border-white/7 pt-3 roomy:mt-5 roomy:pt-5">
            <div class="flex items-start gap-2">
              <span class="mt-0.5 shrink-0 rounded-md bg-white/6 px-1.5 py-0.5 text-[10px] font-bold text-zinc-400 uppercase">
                Passive
              </span>
              <p class="min-w-0 text-[13px] leading-snug">
                <span class="font-semibold text-zinc-200">{{ current.passive.name }}</span>
                <span class="text-zinc-500"> — {{ current.passive.desc }}</span>
              </p>
            </div>
            <div class="flex items-start gap-2">
              <span class="mt-0.5 shrink-0 rounded-md bg-accent/12 px-1.5 py-0.5 text-[10px] font-bold text-accent uppercase">
                Ultimate
              </span>
              <p class="min-w-0 text-[13px] leading-snug">
                <span class="font-semibold text-zinc-200">{{ current.ultimate.name }}</span>
                <span class="text-zinc-500"> · {{ current.ultimate.cooldownTicks / 60 }}s — {{ current.ultimate.desc }}</span>
              </p>
            </div>
            <div class="flex items-start gap-2" :class="showKit ? '' : 'compact:hidden'">
              <span class="mt-0.5 shrink-0 rounded-md bg-white/6 px-1.5 py-0.5 text-[10px] font-bold text-zinc-400 uppercase">Kit</span>
              <p class="min-w-0 text-[13px] leading-snug text-zinc-500">{{ current.kit }}</p>
            </div>
            <button
              v-if="!showKit"
              type="button"
              class="hidden min-h-8 items-center gap-1 text-[13px] font-semibold text-accent compact:inline-flex"
              @click="showKit = true"
            >
              Full loadout <UiIcon name="chevron-down" cls="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- ─── Step 2: arena ─────────────────────────────────────────────── -->
    <div v-else class="scroll-area -mx-1 min-h-0 flex-1 px-1">
      <div
        class="mx-auto grid max-w-5xl grid-cols-2 gap-2.5 short:grid-cols-5 roomy:grid-cols-3 roomy:gap-4 roomy:xl:grid-cols-5"
        role="radiogroup"
        aria-label="Arena"
      >
        <button
          v-for="mp in MAP_PICKS"
          :key="mp.id"
          type="button"
          role="radio"
          :aria-checked="mapPick === mp.id"
          class="group relative overflow-hidden rounded-2xl border bg-panel/80 p-1 text-left transition-all duration-200 focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
          :class="mapPick === mp.id ? 'border-accent/50 glow-accent' : 'border-white/7 hover:border-white/20'"
          @click="$emit('map-pick', mp.id)"
          @dblclick="$emit('map-pick', mp.id); $emit('launch')"
        >
          <MapPreview :map-id="mp.id" />
          <div class="px-2 pt-1.5 pb-1.5 roomy:p-3">
            <div class="flex items-center gap-1.5">
              <span v-if="mapPick === mp.id" class="h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
              <span class="font-ui truncate text-[13px] font-bold text-zinc-100">{{ mp.name }}</span>
            </div>
            <div class="mt-0.5 line-clamp-1 text-[11px] leading-snug text-zinc-500 short:hidden roomy:line-clamp-2">
              {{ mp.desc }}
            </div>
          </div>
        </button>
      </div>
    </div>

    <!-- ─── Pinned actions ─────────────────────────────────────────────── -->
    <template #actions>
      <template v-if="step === 'ship'">
        <div class="hidden min-w-0 flex-1 items-center gap-2 text-[13px] text-zinc-500 roomy:flex">
          <span class="h-2 w-2 rounded-full" :style="{ background: current.color }" />
          <span class="truncate"><span class="font-semibold text-zinc-200">{{ current.name }}</span> selected</span>
        </div>
        <button
          type="button"
          class="btn-primary font-ui w-full font-bold tracking-wider roomy:w-auto roomy:min-w-64"
          @click="step = 'map'"
        >
          Continue with {{ current.name }}
          <UiIcon name="chevron-right" cls="h-4 w-4" />
        </button>
      </template>
      <template v-else>
        <div class="flex min-w-0 flex-1 items-center gap-2 text-[13px] text-zinc-500">
          <ShipPreview :id="current.id" :color="current.color" cls="w-9" />
          <span class="truncate">
            <span class="font-semibold text-zinc-200">{{ current.name }}</span> · {{ currentMap.name }}
          </span>
        </div>
        <button type="button" class="btn-primary font-ui shrink-0 px-6 font-bold tracking-wider roomy:min-w-48" @click="$emit('launch')">
          <UiIcon name="rocket" cls="h-4 w-4" />
          Launch
        </button>
      </template>
    </template>
  </ScreenFrame>
</template>
