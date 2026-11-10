<script>
// Open sheets, innermost last — Escape closes only the top one.
const stack = [];
let seq = 0;
</script>

<script setup>
/**
 * Sheet: the one surface for secondary pages (profile, friends, settings,
 * ranks, pilot cards). Full screen on phones, a centered dialog on roomy
 * viewports. Separate backdrop element so tap-outside works.
 */
import { onBeforeUnmount, watch } from 'vue';
import UiIcon from '../UiIcon.vue';

const props = defineProps({
  open: { type: Boolean, default: false },
  title: { type: String, default: '' },
  eyebrow: { type: String, default: '' },
  /** Tailwind max-width for the roomy dialog. */
  width: { type: String, default: 'roomy:max-w-lg' },
  /** Body padding off — for content that manages its own (lists). */
  flush: { type: Boolean, default: false },
});
const emit = defineEmits(['close']);

const id = ++seq;

function onKey(e) {
  if (e.key !== 'Escape' || stack[stack.length - 1] !== id) return;
  e.stopImmediatePropagation();
  emit('close');
}

function push() {
  if (!stack.includes(id)) stack.push(id);
  window.addEventListener('keydown', onKey);
}

function pull() {
  const i = stack.indexOf(id);
  if (i >= 0) stack.splice(i, 1);
  window.removeEventListener('keydown', onKey);
}

watch(
  () => props.open,
  (v) => (v ? push() : pull()),
  { immediate: true },
);

onBeforeUnmount(pull);
</script>

<template>
  <Teleport to="body">
    <Transition name="sheet" appear>
      <div
        v-if="open"
        role="dialog"
        aria-modal="true"
        :aria-label="title || undefined"
        class="fixed inset-0 z-60 flex items-stretch justify-center roomy:items-center roomy:p-6"
      >
        <div class="absolute inset-0 bg-black/60 roomy:backdrop-blur-sm" aria-hidden="true" @click="emit('close')" />

        <div
          class="sheet-panel relative flex min-h-0 w-full flex-1 flex-col overflow-hidden bg-surface roomy:panel-elevated roomy:max-h-[min(780px,88dvh)] roomy:flex-none"
          :class="width"
        >
          <div
            class="px-safe flex shrink-0 items-center gap-3 border-b border-white/7 py-2 pt-[max(0.5rem,var(--sat))] roomy:pt-3 roomy:pb-3"
          >
            <div class="min-w-0 flex-1">
              <div v-if="eyebrow" class="label truncate">{{ eyebrow }}</div>
              <h2 class="font-display truncate text-base leading-tight font-bold text-zinc-50">{{ title }}</h2>
            </div>
            <slot name="header-actions" />
            <button type="button" class="btn-icon" aria-label="Close" @click="emit('close')">
              <UiIcon name="x" cls="h-4 w-4" />
            </button>
          </div>

          <div
            class="scroll-area flex min-h-0 flex-auto flex-col"
            :class="flush ? 'pb-safe roomy:pb-0' : 'px-safe py-4 pb-[max(1rem,var(--sab))] roomy:pb-4'"
          >
            <slot />
          </div>

          <div
            v-if="$slots.footer"
            class="px-safe flex shrink-0 items-center gap-2 border-t border-white/7 py-3 pb-[max(0.75rem,var(--sab))] roomy:pb-3"
          >
            <slot name="footer" />
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
