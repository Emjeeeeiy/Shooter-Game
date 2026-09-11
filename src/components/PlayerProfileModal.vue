<script setup>
/**
 * PlayerProfileModal.vue
 *
 * Modal overlay to view another pilot's public profile.
 * Shows their stats, ships used, and provides Add Friend / Accept / Sent state.
 */
import { computed, ref, watch } from 'vue';
import ShipPreview from './ShipPreview.vue';

const props = defineProps({
  /** The target pilot object: { uid, name, photo, bestScore, gamesPlayed } */
  pilot: { type: Object, default: null },
  /** Current viewer's uid */
  viewerUid: { type: String, default: null },
  /** Set of uids already in the viewer's friend list */
  friendUids: { type: Object, default: () => new Set() },
  /** Map of uid -> incoming request object for pilots who sent viewer a request */
  incomingByUid: { type: Object, default: () => new Map() },
  /** Whether this uid already has a pending outgoing request from viewer */
  isSent: { type: Boolean, default: false },
  /** Whether the pilot is currently online */
  isOnline: { type: Boolean, default: false },
  /** Busy sending state */
  sendingId: { type: String, default: null },
});

const emit = defineEmits(['close', 'add', 'undo', 'accept']);

const isFriend = computed(() => props.viewerUid && props.friendUids?.has(props.pilot?.uid));
const hasIncoming = computed(() => props.pilot && props.incomingByUid?.has(props.pilot.uid));
const isSelf = computed(() => props.pilot?.uid === props.viewerUid);
const isBusy = computed(() => props.sendingId === props.pilot?.uid);

function onAdd() {
  if (isBusy.value) return;
  emit('add', props.pilot);
}
function onUndo() {
  emit('undo', props.pilot);
}
function onAccept() {
  emit('accept', props.incomingByUid.get(props.pilot.uid));
}

// Close on Escape
function onKey(e) {
  if (e.key === 'Escape') emit('close');
}
watch(() => props.pilot, (p) => {
  if (p) window.addEventListener('keydown', onKey);
  else window.removeEventListener('keydown', onKey);
}, { immediate: true });
</script>

<template>
  <!-- Backdrop -->
  <Teleport to="body">
    <div
      v-if="pilot"
      class="fixed inset-0 z-60 flex items-center justify-center p-4"
      style="background: rgba(0,0,0,0.7); backdrop-filter: blur(8px);"
      @click.self="$emit('close')"
    >
      <div
        class="panel-elevated w-full max-w-sm animate-slide-up overflow-hidden"
        role="dialog"
        aria-modal="true"
        :aria-label="`Profile: ${pilot.name}`"
      >
        <!-- Header bar -->
        <div class="flex items-center justify-between border-b border-white/6 px-5 py-4">
          <div class="label">Pilot Profile</div>
          <button
            type="button"
            class="btn-icon p-1.5"
            aria-label="Close profile"
            @click="$emit('close')"
          >
            <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <!-- Body -->
        <div class="space-y-5 p-5">
          <!-- Identity -->
          <div class="flex items-center gap-4">
            <div class="relative shrink-0">
              <img
                v-if="pilot.photo"
                :src="pilot.photo"
                alt="Pilot avatar"
                class="h-16 w-16 rounded-2xl object-cover"
                style="border: 2px solid rgba(56,189,248,0.3); box-shadow: 0 0 16px rgba(56,189,248,0.15);"
              />
              <div
                v-else
                class="flex h-16 w-16 items-center justify-center rounded-2xl font-display text-2xl font-bold text-accent"
                style="background: rgba(56,189,248,0.1); border: 2px solid rgba(56,189,248,0.25); box-shadow: 0 0 16px rgba(56,189,248,0.1);"
              >
                {{ (pilot.name || 'P').charAt(0).toUpperCase() }}
              </div>
              <!-- Online dot -->
              <span
                v-if="isOnline"
                class="absolute -bottom-1 -right-1 h-4 w-4 rounded-full border-2"
                style="background: #4ade80; border-color: #08080c; box-shadow: 0 0 8px rgba(74,222,128,0.7);"
                title="Online"
              />
            </div>
            <div class="min-w-0 flex-1">
              <div class="font-display text-xl font-bold text-zinc-100 truncate" style="letter-spacing: 0.04em;">
                {{ pilot.name }}
              </div>
              <div class="font-ui mt-1 flex items-center gap-1.5 text-[12px] font-medium text-zinc-500">
                <span v-if="isOnline" class="text-repair">● Online</span>
                <span v-else>Offline</span>
                <span v-if="isFriend" class="text-skill">· Friends ✓</span>
              </div>
            </div>
          </div>

          <!-- Stats grid -->
          <div class="grid grid-cols-2 gap-2.5">
            <div
              class="rounded-xl p-3.5 text-center"
              style="background: rgba(56,189,248,0.06); border: 1px solid rgba(56,189,248,0.15);"
            >
              <div class="label text-[9px] text-accent/60">Best Score</div>
              <div class="font-display mt-1.5 text-xl font-bold text-accent tabular-nums" style="letter-spacing: 0.02em;">
                {{ pilot.bestScore > 0 ? pilot.bestScore.toLocaleString() : '—' }}
              </div>
            </div>
            <div
              class="rounded-xl border border-white/8 bg-white/3 p-3.5 text-center"
            >
              <div class="label text-[9px]">Runs Flown</div>
              <div class="font-display mt-1.5 text-xl font-bold text-zinc-100 tabular-nums" style="letter-spacing: 0.02em;">
                {{ pilot.gamesPlayed ?? 0 }}
              </div>
            </div>
          </div>

          <!-- Action buttons -->
          <div v-if="!isSelf && viewerUid">
            <!-- Already friends -->
            <div
              v-if="isFriend"
              class="flex items-center justify-center gap-2 rounded-xl border border-repair/20 py-3 text-sm font-semibold text-repair"
              style="background: rgba(74,222,128,0.06);"
            >
              <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg>
              Already Friends
            </div>

            <!-- Incoming request from this pilot -->
            <button
              v-else-if="hasIncoming"
              type="button"
              class="btn-primary font-ui w-full py-3 text-sm font-bold tracking-wider"
              @click="onAccept"
            >
              Accept Friend Request
            </button>

            <!-- Outgoing request sent, pending accept -->
            <div v-else-if="isSent" class="flex items-center gap-2">
              <div class="flex flex-1 items-center justify-center gap-2 rounded-xl border border-white/10 py-3 text-sm font-semibold text-zinc-400">
                Request Sent ✓
              </div>
              <button
                type="button"
                class="btn-ghost font-ui py-3 px-4 text-sm"
                @click="onUndo"
              >
                Undo
              </button>
            </div>

            <!-- Add friend -->
            <button
              v-else
              type="button"
              :disabled="isBusy"
              class="btn-primary font-ui w-full py-3 text-sm font-bold tracking-wider"
              @click="onAdd"
            >
              <svg v-if="isBusy" class="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
              <svg v-else class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/></svg>
              {{ isBusy ? 'Sending…' : 'Add Friend' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>
