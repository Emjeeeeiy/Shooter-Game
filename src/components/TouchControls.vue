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
</script>

<template>
  <div class="pointer-events-none absolute inset-0 z-20 md:hidden">
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
      <button
        class="h-16 w-16 rounded-full bg-accent text-[12px] font-bold text-surface"
        @touchstart.prevent="emit('fire', true)"
        @touchend.prevent="emit('fire', false)"
      >
        FIRE
      </button>
    </div>
  </div>
</template>
