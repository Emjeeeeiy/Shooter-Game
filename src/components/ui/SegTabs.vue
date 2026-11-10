<script setup>
import UiIcon from '../UiIcon.vue';

/**
 * Segmented tabs. options: [{ value, label, icon?, badge?, disabled?, title? }]
 */
defineProps({
  modelValue: { type: [String, Number], default: '' },
  options: { type: Array, required: true },
  label: { type: String, default: '' },
  size: { type: String, default: 'md' }, // 'sm' | 'md'
});
defineEmits(['update:modelValue']);
</script>

<template>
  <div class="seg-wrap" role="tablist" :aria-label="label || undefined">
    <button
      v-for="o in options"
      :key="o.value"
      type="button"
      role="tab"
      class="seg-btn"
      :class="[modelValue === o.value ? 'seg-btn-active' : '', size === 'sm' ? 'text-xs' : '']"
      :aria-selected="modelValue === o.value"
      :disabled="o.disabled"
      :title="o.title || undefined"
      @click="$emit('update:modelValue', o.value)"
    >
      <UiIcon v-if="o.icon" :name="o.icon" cls="h-3.5 w-3.5" />
      <span class="truncate">{{ o.label }}</span>
      <span
        v-if="o.badge"
        class="inline-flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-accent px-1 text-[10px] leading-none font-bold text-ink tabular-nums"
      >
        {{ o.badge }}
      </span>
    </button>
  </div>
</template>
