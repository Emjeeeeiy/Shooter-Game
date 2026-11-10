<script setup>
/**
 * Twin-stick touch controls (Pointer Events, multi-touch).
 *   Move — floating stick: touch anywhere in the move zone, the base appears
 *          under your thumb.
 *   Aim  — fixed stick measured from its centre: deflect to aim + fire; a tap
 *          on the centre fires straight ahead.
 *   Abilities sit in an arc around the aim stick and show cooldown, dash
 *   charges and energy lock.
 * Held state is released on unmount (pause / game over), so input never sticks.
 */
import { computed, onBeforeUnmount, reactive, ref } from 'vue';
import { dash as DASH, missile as MISSILE } from '../game/constants.js';
import AbilityIcon from './AbilityIcon.vue';

const props = defineProps({
  hud: { type: Object, required: true },
  size: { type: String, default: 'm' }, // 's' | 'm' | 'l'
  leftHanded: { type: Boolean, default: false },
  portrait: { type: Boolean, default: false },
});

const emit = defineEmits(['move', 'aim', 'fire', 'dash', 'missiles', 'ult']);

const SIZES = {
  s: { stick: 104, btn: 46, dash: 54 },
  m: { stick: 120, btn: 52, dash: 60 },
  l: { stick: 138, btn: 58, dash: 66 },
};
const DEAD = 0.14; // dead zone, fraction of the stick radius

const dims = computed(() => SIZES[props.size] ?? SIZES.m);
const R = computed(() => dims.value.stick / 2);

// Edge offsets that clear notches / home indicator.
const EDGE_X = 'max(20px, calc(var(--sar) + 12px))';
const EDGE_X_L = 'max(20px, calc(var(--sal) + 12px))';
const EDGE_Y = 'max(20px, calc(var(--sab) + 12px))';

function vec(dx, dy) {
  const len = Math.hypot(dx, dy);
  const n = len / R.value;
  if (!(n > DEAD)) return { x: 0, y: 0, on: false };
  const m = Math.min(1, (n - DEAD) / (1 - DEAD));
  return { x: (dx / len) * m, y: (dy / len) * m, on: true };
}

function knob(dx, dy) {
  const len = Math.hypot(dx, dy) || 1;
  const k = Math.min(1, R.value / len);
  return { x: dx * k, y: dy * k };
}

// ─── Move stick (floating) ────────────────────────────────────────────────
const zoneRef = ref(null);
const move = reactive({ id: null, bx: 0, by: 0, kx: 0, ky: 0 });

function onMoveDown(e) {
  if (move.id !== null) return; // a second finger never steals the stick
  const rect = zoneRef.value.getBoundingClientRect();
  move.id = e.pointerId;
  move.bx = Math.min(Math.max(e.clientX - rect.left, R.value), rect.width - R.value);
  move.by = Math.min(Math.max(e.clientY - rect.top, R.value), rect.height - R.value);
  move.kx = 0;
  move.ky = 0;
  e.currentTarget.setPointerCapture?.(e.pointerId);
  // Thumb landed off the clamped centre: start moving that way at once.
  onMoveMove(e);
}

function onMoveMove(e) {
  if (e.pointerId !== move.id) return;
  const rect = zoneRef.value.getBoundingClientRect();
  const dx = e.clientX - rect.left - move.bx;
  const dy = e.clientY - rect.top - move.by;
  const k = knob(dx, dy);
  move.kx = k.x;
  move.ky = k.y;
  const v = vec(dx, dy);
  emit('move', v.x, v.y);
}

function onMoveUp(e) {
  if (e.pointerId !== move.id) return;
  move.id = null;
  move.kx = 0;
  move.ky = 0;
  emit('move', 0, 0);
}

const moveBaseStyle = computed(() => {
  const d = dims.value.stick;
  if (move.id !== null) return { width: `${d}px`, height: `${d}px`, left: `${move.bx - R.value}px`, top: `${move.by - R.value}px` };
  // Resting hint position in the corner.
  return props.leftHanded
    ? { width: `${d}px`, height: `${d}px`, right: EDGE_X, bottom: EDGE_Y }
    : { width: `${d}px`, height: `${d}px`, left: EDGE_X_L, bottom: EDGE_Y };
});

// ─── Aim stick (fixed) ────────────────────────────────────────────────────
const aimRef = ref(null);
const aim = reactive({ id: null, kx: 0, ky: 0 });

function aimDelta(e) {
  const r = aimRef.value.getBoundingClientRect();
  return { dx: e.clientX - (r.left + r.width / 2), dy: e.clientY - (r.top + r.height / 2) };
}

function onAimDown(e) {
  if (aim.id !== null) return;
  aim.id = e.pointerId;
  e.currentTarget.setPointerCapture?.(e.pointerId);
  const { dx, dy } = aimDelta(e);
  const v = vec(dx, dy);
  const k = knob(dx, dy);
  aim.kx = k.x;
  aim.ky = k.y;
  if (v.on) emit('aim', v.x, v.y);
  emit('fire', true); // centre tap: shoot straight ahead
}

function onAimMove(e) {
  if (e.pointerId !== aim.id) return;
  const { dx, dy } = aimDelta(e);
  const k = knob(dx, dy);
  aim.kx = k.x;
  aim.ky = k.y;
  const v = vec(dx, dy);
  if (v.on) emit('aim', v.x, v.y);
}

function onAimUp(e) {
  if (e.pointerId !== aim.id) return;
  aim.id = null;
  aim.kx = 0;
  aim.ky = 0;
  emit('fire', false);
}

const aimAnchorStyle = computed(() => {
  const d = `${dims.value.stick}px`;
  return props.leftHanded
    ? { width: d, height: d, left: EDGE_X_L, bottom: EDGE_Y }
    : { width: d, height: d, right: EDGE_X, bottom: EDGE_Y };
});

// ─── Ability buttons ──────────────────────────────────────────────────────
const shortUlt = computed(() => {
  const name = String(props.hud.ultimateName ?? 'Ult').split(/\s+/)[0];
  return name.length > 7 ? `${name.slice(0, 6)}.` : name;
});

const buttons = computed(() => {
  const h = props.hud;
  const energy = h.energy ?? 0;
  // Angles (deg, screen coords: 0 = right, 90 = down) for ult → missiles → dash.
  let angles = props.portrait ? [205, 245, 285] : [180, 225, 270];
  if (props.leftHanded) angles = angles.map((a) => 180 - a);
  const { btn, dash } = dims.value;
  const defs = [
    {
      id: 'ult',
      label: shortUlt.value,
      aria: `${h.ultimateName ?? 'Ultimate'} (ultimate)`,
      icon: 'ult',
      tone: 'text-shock',
      cd: h.shockCooldown ?? 0,
      locked: energy < (h.ultimateCost ?? 0),
      size: btn,
    },
    {
      id: 'missiles',
      label: 'MSL',
      aria: 'Missiles',
      icon: 'missile',
      tone: 'text-missile',
      cd: h.missileCooldown ?? 0,
      locked: energy < MISSILE.energyCost,
      size: btn,
    },
    {
      id: 'dash',
      label: 'Dash',
      aria: 'Dash',
      icon: 'dash',
      tone: 'text-zinc-100',
      cd: (h.dashCharges ?? 0) > 0 ? 0 : 1 - (h.dashRecharge ?? 0),
      locked: energy < DASH.energyCost,
      charges: h.dashCharges ?? 0,
      max: h.dashMax ?? 2,
      size: dash,
    },
  ];
  return defs.map((d, i) => {
    const r = R.value + Math.max(btn, dash) / 2 + 10;
    const a = (angles[i] * Math.PI) / 180;
    const cx = R.value + Math.cos(a) * r;
    const cy = R.value + Math.sin(a) * r;
    return {
      ...d,
      style: { width: `${d.size}px`, height: `${d.size}px`, left: `${cx - d.size / 2}px`, top: `${cy - d.size / 2}px` },
      ready: d.cd <= 0 && !d.locked,
    };
  });
});

const pressed = ref('');
function press(b) {
  pressed.value = b.id;
  setTimeout(() => {
    if (pressed.value === b.id) pressed.value = '';
  }, 140);
  try {
    navigator.vibrate?.(8);
  } catch {
    // no haptics
  }
  emit(b.id);
}

onBeforeUnmount(() => {
  emit('move', 0, 0);
  emit('fire', false);
});
</script>

<template>
  <div class="pointer-events-none absolute inset-0 z-20 select-none">
    <!-- Move zone (floating stick) -->
    <div
      ref="zoneRef"
      class="pointer-events-auto absolute bottom-0 touch-none"
      :class="leftHanded ? 'right-0' : 'left-0'"
      :style="{ width: portrait ? '46%' : '45%', height: '64%' }"
      @pointerdown="onMoveDown"
      @pointermove="onMoveMove"
      @pointerup="onMoveUp"
      @pointercancel="onMoveUp"
      @lostpointercapture="onMoveUp"
    >
      <div
        class="absolute rounded-full border transition-opacity duration-150"
        :class="move.id !== null ? 'border-white/30 bg-white/7 opacity-100' : 'border-white/15 bg-white/4 opacity-60'"
        :style="moveBaseStyle"
        aria-hidden="true"
      >
        <div
          class="absolute top-1/2 left-1/2 rounded-full bg-white/25"
          :style="{
            width: `${dims.stick * 0.4}px`,
            height: `${dims.stick * 0.4}px`,
            transform: `translate(calc(-50% + ${move.kx}px), calc(-50% + ${move.ky}px))`,
          }"
        />
      </div>
    </div>

    <!-- Aim stick + abilities -->
    <div class="pointer-events-none absolute" :style="aimAnchorStyle">
      <div
        ref="aimRef"
        class="pointer-events-auto absolute inset-0 touch-none rounded-full border transition-colors"
        :class="aim.id !== null ? 'border-accent/55 bg-accent/12' : 'border-white/15 bg-white/5'"
        role="presentation"
        @pointerdown="onAimDown"
        @pointermove="onAimMove"
        @pointerup="onAimUp"
        @pointercancel="onAimUp"
        @lostpointercapture="onAimUp"
      >
        <div
          class="absolute top-1/2 left-1/2 rounded-full"
          :class="aim.id !== null ? 'bg-accent/45' : 'bg-white/20'"
          :style="{
            width: `${dims.stick * 0.4}px`,
            height: `${dims.stick * 0.4}px`,
            transform: `translate(calc(-50% + ${aim.kx}px), calc(-50% + ${aim.ky}px))`,
          }"
        />
        <span class="pointer-events-none absolute inset-x-0 bottom-2 text-center text-[10px] font-bold tracking-widest text-zinc-500">
          AIM
        </span>
      </div>

      <button
        v-for="b in buttons"
        :key="b.id"
        type="button"
        class="pointer-events-auto absolute flex touch-none flex-col items-center justify-center overflow-hidden rounded-full border bg-surface/60 transition-transform duration-100"
        :class="[
          b.ready ? 'border-white/25' : 'border-white/10',
          pressed === b.id ? 'scale-90' : '',
          b.locked ? 'opacity-50' : '',
        ]"
        :style="b.style"
        :aria-label="b.aria"
        @pointerdown.prevent="press(b)"
        @contextmenu.prevent
      >
        <!-- Cooldown wedge -->
        <span
          v-if="b.cd > 0"
          class="pointer-events-none absolute inset-0 rounded-full"
          :style="{ background: `conic-gradient(color-mix(in srgb, var(--color-surface) 72%, transparent) ${b.cd * 360}deg, transparent 0deg)` }"
        />
        <span class="relative" :class="b.ready ? b.tone : 'text-zinc-500'">
          <AbilityIcon :name="b.icon" cls="h-5 w-5" />
        </span>
        <span class="relative mt-0.5 max-w-full truncate px-1 text-[10px] leading-none font-bold tracking-wide text-zinc-300 uppercase">
          {{ b.label }}
        </span>
        <span v-if="b.max" class="relative mt-1 flex gap-0.5">
          <span
            v-for="i in b.max"
            :key="i"
            class="h-1 w-1.5 rounded-full"
            :class="i <= b.charges ? 'bg-zinc-100' : 'bg-white/20'"
          />
        </span>
      </button>
    </div>
  </div>
</template>
