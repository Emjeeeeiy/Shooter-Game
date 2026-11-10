<script setup>
import Avatar from './Avatar.vue';

defineProps({
  name: { type: String, default: 'Pilot' },
  photo: { type: String, default: '' },
  sub: { type: String, default: '' },
  online: { type: Boolean, default: null },
  /** Accent outline (incoming request, you, etc). */
  highlight: { type: Boolean, default: false },
  you: { type: Boolean, default: false },
  size: { type: String, default: 'md' },
  clickable: { type: Boolean, default: false },
});
defineEmits(['open']);
</script>

<template>
  <div
    class="flex min-w-0 items-center gap-3 rounded-xl border p-2.5"
    :class="highlight ? 'border-accent/25 bg-accent/5' : 'border-white/6 bg-white/3'"
  >
    <component
      :is="clickable ? 'button' : 'div'"
      :type="clickable ? 'button' : undefined"
      class="flex min-w-0 flex-1 items-center gap-3 text-left"
      @click="clickable && $emit('open')"
    >
      <Avatar :photo="photo" :name="name" :size="size" :online="online" />
      <span class="min-w-0 flex-1">
        <span class="flex min-w-0 items-center gap-1.5">
          <span class="truncate text-sm font-semibold" :class="you ? 'text-accent' : 'text-zinc-100'">{{ name }}</span>
          <slot name="badges" />
        </span>
        <span v-if="sub || $slots.sub" class="block truncate text-xs text-zinc-500 tabular-nums">
          <slot name="sub">{{ sub }}</slot>
        </span>
      </span>
    </component>
    <div v-if="$slots.actions" class="flex shrink-0 items-center gap-1.5">
      <slot name="actions" />
    </div>
  </div>
</template>
