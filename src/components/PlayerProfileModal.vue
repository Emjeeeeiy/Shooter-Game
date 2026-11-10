<script setup>
// Template: Nested sheet: full screen on phones, small dialog elsewhere. Sheet handles Escape.
/**
 * PlayerProfileModal.vue
 *
 * Modal overlay to view another pilot's public profile.
 * Shows their stats, ships used, and provides Add Friend / Accept / Sent state.
 */
import { computed } from 'vue';
import Avatar from './ui/Avatar.vue';
import Sheet from './ui/Sheet.vue';
import StatTile from './ui/StatTile.vue';
import UiIcon from './UiIcon.vue';

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
</script>

<template>
  <Sheet :open="!!pilot" eyebrow="Pilot profile" :title="pilot?.name ?? ''" width="roomy:max-w-sm" @close="emit('close')">
    <div v-if="pilot" class="space-y-4">
      <div class="flex items-center gap-4">
        <Avatar :photo="pilot.photo" :name="pilot.name" size="lg" square :online="isOnline" />
        <div class="min-w-0 flex-1">
          <div class="font-display truncate text-xl font-bold text-zinc-100">{{ pilot.name }}</div>
          <div class="font-ui mt-0.5 flex items-center gap-1.5 text-[13px] font-medium text-zinc-500">
            <span :class="isOnline ? 'text-repair' : ''">{{ isOnline ? 'Online' : 'Offline' }}</span>
            <span v-if="isFriend" class="text-skill">· Friends</span>
          </div>
        </div>
      </div>

      <div class="grid grid-cols-2 gap-2">
        <StatTile label="Best score" :value="pilot.bestScore > 0 ? pilot.bestScore.toLocaleString() : '—'" tone="accent" />
        <StatTile label="Runs flown" :value="pilot.gamesPlayed ?? '—'" />
      </div>

      <div v-if="!isSelf && viewerUid">
        <div
          v-if="isFriend"
          class="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-repair/25 bg-repair/6 text-sm font-semibold text-repair"
        >
          <UiIcon name="check" cls="h-4 w-4" /> Already friends
        </div>
        <button v-else-if="hasIncoming" type="button" class="btn-primary font-ui w-full font-bold tracking-wider" @click="onAccept">
          Accept friend request
        </button>
        <div v-else-if="isSent" class="flex items-center gap-2">
          <div class="flex min-h-11 flex-1 items-center justify-center rounded-xl border border-white/10 text-sm font-semibold text-zinc-400">
            Request sent
          </div>
          <button type="button" class="btn-ghost" @click="onUndo">Undo</button>
        </div>
        <button v-else type="button" :disabled="isBusy" class="btn-primary font-ui w-full font-bold tracking-wider" @click="onAdd">
          <UiIcon :name="isBusy ? 'spinner' : 'user-plus'" cls="h-4 w-4" />
          {{ isBusy ? 'Sending…' : 'Add friend' }}
        </button>
      </div>
    </div>
  </Sheet>
</template>
