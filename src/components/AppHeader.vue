<script setup>
import Avatar from './ui/Avatar.vue';
import UiIcon from './UiIcon.vue';

defineProps({
  theme: { type: String, default: 'dark' },
  authed: { type: Boolean, default: false },
  canCloud: { type: Boolean, default: false },
  bellCount: { type: Number, default: 0 },
  friendPending: { type: Number, default: 0 },
  showNotifs: { type: Boolean, default: false },
  overlay: { type: String, default: null },
  photo: { type: String, default: '' },
  pilotName: { type: String, default: 'Pilot' },
  showName: { type: Boolean, default: false },
  /** Phone layout: theme moves into Settings, the name chip is dropped. */
  compact: { type: Boolean, default: false },
});

defineEmits(['theme', 'bell', 'open']);
</script>

<template>
  <header
    class="pt-safe relative z-40 w-full shrink-0 border-b border-white/8 bg-panel/85 backdrop-blur-xl pointer-coarse:bg-panel/95 pointer-coarse:backdrop-blur-none"
  >
    <div class="px-safe mx-auto flex h-(--header-h) max-w-[1600px] items-center justify-between gap-3">
      <!-- Logo -->
      <div class="flex min-w-0 items-center gap-2.5">
        <div
          class="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-accent/25 bg-accent/15"
        >
          <span class="h-2 w-2 rounded-full bg-accent shadow-[0_0_8px_2px_var(--color-accent-glow)]" />
        </div>
        <h1 class="font-display truncate text-sm font-bold tracking-[0.22em] text-zinc-100 uppercase">
          Neon Strike
        </h1>
        <span class="hidden truncate text-xs text-zinc-500 roomy:lg:block">Top-down arena shooter</span>
      </div>

      <!-- Actions -->
      <div class="flex shrink-0 items-center gap-1.5">
        <!-- Theme (roomy only — phones switch theme in Settings) -->
        <button
          v-if="!compact"
          type="button"
          :title="theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'"
          :aria-label="theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'"
          class="btn-icon"
          @click="$emit('theme', theme === 'light' ? 'dark' : 'light')"
        >
          <UiIcon :name="theme === 'light' ? 'sun' : 'moon'" cls="h-4 w-4" />
        </button>

        <template v-if="authed">
          <button
            id="notif-btn"
            type="button"
            title="Notifications"
            :aria-label="bellCount ? `Notifications (${bellCount} new)` : 'Notifications'"
            :aria-expanded="showNotifs"
            class="btn-icon"
            :class="showNotifs ? 'btn-icon-active' : ''"
            @click="$emit('bell')"
          >
            <UiIcon name="bell" cls="h-4 w-4" />
            <span
              v-if="bellCount > 0"
              class="absolute -top-1 -right-1 flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-danger px-1 text-[10px] leading-none font-bold text-white tabular-nums"
            >
              {{ bellCount }}
            </span>
          </button>

          <button
            v-if="canCloud"
            id="friends-btn"
            type="button"
            title="Friends"
            :aria-label="friendPending ? `Friends (${friendPending} requests)` : 'Friends'"
            class="btn-icon"
            :class="overlay === 'friends' ? 'btn-icon-active' : ''"
            @click="$emit('open', 'friends')"
          >
            <UiIcon name="users" cls="h-4 w-4" />
            <span
              v-if="friendPending > 0"
              class="absolute -top-1 -right-1 flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-accent px-1 text-[10px] leading-none font-bold text-ink tabular-nums"
            >
              {{ friendPending }}
            </span>
          </button>

          <div v-if="!compact" class="mx-0.5 h-5 w-px bg-white/10" />

          <button
            id="profile-btn"
            type="button"
            title="Profile"
            aria-label="Profile"
            class="btn-icon overflow-hidden"
            :class="overlay === 'profile' ? 'btn-icon-active' : ''"
            @click="$emit('open', 'profile')"
          >
            <Avatar v-if="photo" :photo="photo" :name="pilotName" size="xs" />
            <UiIcon v-else name="user" cls="h-4 w-4" />
          </button>

          <button
            id="settings-btn"
            type="button"
            title="Settings"
            aria-label="Settings"
            class="btn-icon"
            :class="overlay === 'settings' ? 'btn-icon-active' : ''"
            @click="$emit('open', 'settings')"
          >
            <UiIcon name="gear" cls="h-4 w-4" />
          </button>

          <div
            v-if="showName && !compact"
            class="hidden max-w-36 items-center rounded-xl border border-white/8 bg-white/4 px-3 py-1.5 text-[13px] font-semibold text-zinc-300 lg:flex"
          >
            <span class="truncate">{{ pilotName }}</span>
          </div>
        </template>
      </div>
    </div>
  </header>
</template>
