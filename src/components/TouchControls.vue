<script setup>
import { ref } from 'vue';

const emit = defineEmits(['move', 'aim-fire', 'fire', 'dash', 'missiles', 'shock']);

const stick = ref({ x: 0, y: 0 });
const stickActive = ref(false);
let stickId = null;
let stickOrigin = null;

function onStickStart(e) {
  const t = e.changedTouches[0];
  stickId = t.identifier;
  stickOrigin = { x: t.clientX, y: t.clientY };
  stickActive.value = true;
  e.preventDefault();
}
function onStickMove(e) {
  if (!stickActive.value) return;
  for (const t of e.changedTouches) {
    if (t.identifier !== stickId) continue;
    const dx = (t.clientX - stickOrigin.x) / 48;
    const dy = (t.clientY - stickOrigin.y) / 48;
    const len = Math.hypot(dx, dy) || 1;
    const cl = Math.min(1, len);
    stick.value = { x: (dx / len) * cl, y: (dy / len) * cl };
    emit('move', stick.value.x, stick.value.y);
    e.preventDefault();
  }
}
function onStickEnd(e) {
  for (const t of e.changedTouches) {
    if (t.identifier !== stickId) continue;
    stickActive.value = false;
    stick.value = { x: 0, y: 0 };
    emit('move', 0, 0);
  }
}

// Right virtual stick: aim + auto-fire. Touching it down starts firing
// (toward wherever it's aimed, keeping the last heading if untouched);
// dragging steers the aim while held; lifting stops firing.
const aimStick = ref({ x: 0, y: 0 });
const aimActive = ref(false);
let aimId = null;
let aimOrigin = null;

function onAimStart(e) {
  const t = e.changedTouches[0];
  aimId = t.identifier;
  aimOrigin = { x: t.clientX, y: t.clientY };
  aimActive.value = true;
  emit('fire', true);
  e.preventDefault();
}
function onAimMove(e) {
  if (!aimActive.value) return;
  for (const t of e.changedTouches) {
    if (t.identifier !== aimId) continue;
    const dx = (t.clientX - aimOrigin.x) / 48;
    const dy = (t.clientY - aimOrigin.y) / 48;
    const len = Math.hypot(dx, dy) || 1;
    const cl = Math.min(1, len);
    aimStick.value = { x: (dx / len) * cl, y: (dy / len) * cl };
    emit('aim-fire', dx, dy);
    e.preventDefault();
  }
}
function onAimEnd(e) {
  for (const t of e.changedTouches) {
    if (t.identifier !== aimId) continue;
    aimActive.value = false;
    aimStick.value = { x: 0, y: 0 };
    emit('fire', false);
  }
}
</script>

<template>
  <!-- Shown whenever the parent detects a touch device (phones + tablets). -->
  <div class="pointer-events-none absolute inset-0 z-20">
    <!-- Left virtual stick -->
    <div
      class="pointer-events-auto absolute bottom-16 left-4 h-28 w-28 rounded-full border border-white/15 bg-white/5 backdrop-blur-sm"
      @touchstart="onStickStart"
      @touchmove="onStickMove"
      @touchend="onStickEnd"
      @touchcancel="onStickEnd"
    >
      <div
        class="absolute h-12 w-12 rounded-full bg-white/20"
        :style="{
          left: `calc(50% - 24px + ${stick.x * 32}px)`,
          top: `calc(50% - 24px + ${stick.y * 32}px)`,
        }"
      />
    </div>

    <!-- Right buttons -->
    <div class="pointer-events-auto absolute right-3 bottom-16 flex items-end gap-2">
      <button
        class="h-12 w-12 rounded-full border border-white/15 bg-white/5 text-[11px] font-bold text-zinc-200"
        @touchstart.prevent="emit('missiles')"
      >
        MSL
      </button>
      <button
        class="h-12 w-12 rounded-full border border-white/15 bg-white/5 text-[11px] font-bold text-zinc-200"
        @touchstart.prevent="emit('shock')"
      >
        SHK
      </button>
      <button
        class="h-14 w-14 rounded-full border border-white/15 bg-white/5 text-[11px] font-bold text-zinc-100"
        @touchstart.prevent="emit('dash')"
      >
        DSH
      </button>

      <!-- Right virtual stick: aim + fire -->
      <div
        class="relative h-28 w-28 rounded-full border backdrop-blur-sm transition-colors"
        :class="aimActive ? 'border-accent/50 bg-accent/10' : 'border-white/15 bg-white/5'"
        @touchstart="onAimStart"
        @touchmove="onAimMove"
        @touchend="onAimEnd"
        @touchcancel="onAimEnd"
      >
        <div
          class="absolute h-12 w-12 rounded-full"
          :class="aimActive ? 'bg-accent/40' : 'bg-white/20'"
          :style="{
            left: `calc(50% - 24px + ${aimStick.x * 32}px)`,
            top: `calc(50% - 24px + ${aimStick.y * 32}px)`,
          }"
        />
      </div>
    </div>
  </div>
</template>
