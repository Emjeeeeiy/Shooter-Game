<script setup>
/**
 * Everything that floats over the app: room invites, toasts, the
 * notification panel and the friend-request nudge. Rendered at the app root
 * (outside any stacking context) so it always sits above pages and sheets.
 * Pure view — App.vue owns the state.
 */
import UiIcon from './UiIcon.vue';

defineProps({
  invites: { type: Array, default: () => [] },
  inviteError: { type: String, default: '' },
  toasts: { type: Array, default: () => [] },
  notifs: { type: Array, default: () => [] },
  showPanel: { type: Boolean, default: false },
  showStack: { type: Boolean, default: true },
  nudgeCount: { type: Number, default: 0 },
});

defineEmits(['accept', 'decline', 'dismiss', 'go', 'clear', 'close', 'nudge']);

function modeLabel(mode) {
  return mode === 'versus' ? 'Versus Duel' : 'Arcade Co-op';
}
</script>

<template>
  <!-- Invites + toasts: one stack, never overlapping -->
  <div
    v-if="showStack && (invites.length || toasts.length)"
    class="px-safe pointer-events-none fixed inset-x-0 top-[calc(var(--header-h)+var(--sat)+0.5rem)] z-70 flex flex-col items-center gap-2 roomy:items-end"
    aria-live="polite"
  >
    <div
      v-for="inv in invites"
      :key="`inv-${inv.id}`"
      class="panel-elevated pointer-events-auto flex w-full max-w-sm animate-slide-up items-center gap-3 border-accent/25 p-3"
    >
      <span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent/15 text-accent">
        <UiIcon :name="inv.mode === 'versus' ? 'swords' : 'users'" cls="h-4 w-4" />
      </span>
      <div class="min-w-0 flex-1">
        <div class="truncate text-sm font-semibold text-zinc-100">{{ inv.fromName }} invited you</div>
        <div class="truncate text-xs text-zinc-500">Room {{ inv.roomCode }} · {{ modeLabel(inv.mode) }}</div>
      </div>
      <button type="button" class="btn-primary btn-sm" @click="$emit('accept', inv)">Join</button>
      <button type="button" class="btn-icon" aria-label="Decline invite" @click="$emit('decline', inv)">
        <UiIcon name="x" cls="h-4 w-4" />
      </button>
    </div>

    <p
      v-if="inviteError"
      class="pointer-events-auto w-full max-w-sm rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-[13px] text-danger"
    >
      {{ inviteError }}
    </p>

    <div
      v-for="n in toasts"
      :key="`toast-${n.id}`"
      class="panel-elevated pointer-events-auto flex w-full max-w-sm animate-slide-up items-start gap-3 border-l-2 p-3"
      :class="n.kind === 'best' ? 'border-l-accent' : 'border-l-repair'"
    >
      <span
        class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
        :class="n.kind === 'best' ? 'bg-accent/15 text-accent' : 'bg-repair/15 text-repair'"
      >
        <UiIcon :name="n.kind === 'best' ? 'star' : 'heart'" cls="h-4 w-4" />
      </span>
      <div class="min-w-0 flex-1">
        <div class="truncate text-sm font-semibold text-zinc-100">{{ n.title }}</div>
        <div class="text-[13px] text-zinc-400">{{ n.body }}</div>
        <button
          v-if="n.target"
          type="button"
          class="mt-1 inline-flex min-h-8 items-center gap-1 text-[13px] font-semibold text-accent"
          @click="$emit('go', n)"
        >
          View <UiIcon name="chevron-right" cls="h-3.5 w-3.5" />
        </button>
      </div>
      <button type="button" class="btn-icon -my-1 -mr-1 border-transparent" aria-label="Dismiss" @click="$emit('dismiss', n.id)">
        <UiIcon name="x" cls="h-4 w-4" />
      </button>
    </div>
  </div>

  <!-- Notification panel (outside tap closes) -->
  <template v-if="showPanel">
    <div class="fixed inset-0 z-[65]" aria-hidden="true" @click="$emit('close')" />
    <div
      class="fixed inset-x-2 top-[calc(var(--header-h)+var(--sat)+0.5rem)] z-70 roomy:inset-x-auto roomy:right-4 roomy:w-96"
      role="dialog"
      aria-label="Notifications"
    >
      <div
        class="panel-elevated flex max-h-[min(34rem,calc(100dvh-var(--header-h)-var(--sat)-6rem))] flex-col overflow-hidden"
      >
        <div class="flex shrink-0 items-center justify-between gap-2 border-b border-white/7 py-2 pr-2 pl-4">
          <span class="text-sm font-semibold text-zinc-100">Notifications</span>
          <div class="flex items-center gap-1">
            <button
              v-if="notifs.length"
              type="button"
              class="btn-sm rounded-lg px-2 text-xs font-semibold text-zinc-500 hover:text-zinc-200"
              @click="$emit('clear')"
            >
              Clear all
            </button>
            <button type="button" aria-label="Close" class="btn-icon border-transparent" @click="$emit('close')">
              <UiIcon name="x" cls="h-4 w-4" />
            </button>
          </div>
        </div>

        <div class="scroll-area flex-1 space-y-3 p-3">
          <div v-if="!notifs.length && !invites.length" class="py-8 text-center text-[13px] text-zinc-500">
            Nothing here yet.
          </div>

          <div v-if="invites.length" class="space-y-2">
            <div class="label">Room invites ({{ invites.length }})</div>
            <div
              v-for="inv in invites"
              :key="`pinv-${inv.id}`"
              class="flex items-center gap-2 rounded-xl border border-accent/20 bg-accent/5 p-2.5"
            >
              <div class="min-w-0 flex-1">
                <div class="truncate text-sm font-semibold text-zinc-100">{{ inv.fromName }} invited you</div>
                <div class="truncate text-xs text-zinc-500">{{ modeLabel(inv.mode) }} · Room {{ inv.roomCode }}</div>
              </div>
              <button type="button" class="btn-primary btn-sm" @click="$emit('accept', inv)">Join</button>
              <button type="button" class="btn-icon" aria-label="Decline invite" @click="$emit('decline', inv)">
                <UiIcon name="x" cls="h-4 w-4" />
              </button>
            </div>
          </div>

          <div v-if="notifs.length" class="space-y-2">
            <div
              v-for="n in [...notifs].reverse()"
              :key="`pn-${n.id}`"
              class="flex items-start gap-3 rounded-xl border border-white/6 bg-white/3 p-2.5"
            >
              <span
                class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full"
                :class="n.kind === 'best' ? 'bg-accent/15 text-accent' : 'bg-repair/15 text-repair'"
              >
                <UiIcon :name="n.kind === 'best' ? 'star' : 'heart'" cls="h-3.5 w-3.5" />
              </span>
              <div class="min-w-0 flex-1">
                <div class="truncate text-sm font-semibold text-zinc-100">{{ n.title }}</div>
                <div class="text-[13px] text-zinc-400">{{ n.body }}</div>
                <button
                  v-if="n.target"
                  type="button"
                  class="mt-0.5 inline-flex min-h-8 items-center gap-1 text-[13px] font-semibold text-accent"
                  @click="$emit('go', n)"
                >
                  View <UiIcon name="chevron-right" cls="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </template>

  <!-- Friend request nudge (roomy only — phones get a tab badge) -->
  <div
    v-if="nudgeCount > 0"
    class="fixed right-4 bottom-[max(1rem,var(--sab))] z-50 w-full max-w-xs"
  >
    <button
      type="button"
      class="panel-elevated flex w-full items-center gap-3 p-3 text-left transition-colors hover:border-accent/50"
      @click="$emit('nudge')"
    >
      <span class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent/15 text-sm font-bold text-accent">
        {{ nudgeCount }}
      </span>
      <span class="min-w-0 flex-1 text-sm font-semibold text-zinc-100">
        {{ nudgeCount === 1 ? '1 pilot wants to be friends' : `${nudgeCount} pilots want to be friends` }}
      </span>
      <UiIcon name="chevron-right" cls="h-4 w-4 text-accent" />
    </button>
  </div>
</template>
