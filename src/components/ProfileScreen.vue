<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { useFriendList } from '../composables/useFriends.js';
import { useLeaderboard } from '../composables/useLeaderboard.js';
import { useProfile } from '../composables/useProfile.js';
import ShipPreview from './ShipPreview.vue';
import Avatar from './ui/Avatar.vue';
import PilotRow from './ui/PilotRow.vue';
import StatTile from './ui/StatTile.vue';
import UiIcon from './UiIcon.vue';

const props = defineProps({
  uid: { type: String, default: null },
  pilotName: { type: String, default: 'Pilot' },
  email: { type: String, default: '' },
  offline: { type: Boolean, default: false },
  best: { type: Number, default: 0 },
  online: { type: Array, default: () => [] },
});

const emit = defineEmits(['rename', 'friends', 'logout']);

const { profile, loading, load, savePhoto, fileToAvatarDataUrl, mostUsedShip, mostUsedCount } =
  useProfile();
const { entries } = useLeaderboard();
const friendListCtl = useFriendList();
const addedFriends = friendListCtl.friends;

const nameEdit = ref(props.pilotName);
const renameMsg = ref('');
const photoMsg = ref('');
const busyPhoto = ref(false);
const fileInput = ref(null);

watch(
  () => [props.uid, props.offline, props.pilotName],
  ([uid, off, fallback]) => {
    load(uid, off, fallback || 'Pilot');
    friendListCtl.watchUid(uid && !off ? uid : null);
  },
  { immediate: true },
);

onBeforeUnmount(() => {
  friendListCtl.watchUid(null);
});

watch(
  () => props.pilotName,
  (n) => {
    if (!renameMsg.value) nameEdit.value = n;
  },
);

const avatar = computed(() => profile.value.photo || '');

const localBest = computed(() => (entries.value.length ? entries.value[0].score : 0));
const highScore = computed(() =>
  Math.max(Number(props.best) || 0, Number(profile.value.bestScore) || 0, props.offline ? localBest.value : 0),
);
const gamesPlayed = computed(() => Number(profile.value.gamesPlayed) || 0);
const onlineUids = computed(() => new Set((props.online ?? []).map((o) => o.uid)));

function saveName() {
  const clean = nameEdit.value.trim().slice(0, 20);
  if (!clean) {
    renameMsg.value = 'Enter a callsign.';
    return;
  }
  renameMsg.value = 'Saving…';
  emit('rename', clean, (msg) => {
    renameMsg.value = msg;
  });
}

async function onFile(e) {
  const f = e.target.files?.[0];
  if (!f) return;
  photoMsg.value = '';
  if (!String(f.type || '').startsWith('image/')) {
    photoMsg.value = 'Choose an image file.';
    e.target.value = '';
    return;
  }
  if (f.size > 8 * 1024 * 1024) {
    photoMsg.value = 'Image too large (max 8 MB).';
    e.target.value = '';
    return;
  }
  busyPhoto.value = true;
  photoMsg.value = 'Processing…';
  try {
    const dataUrl = await fileToAvatarDataUrl(f);
    const res = await savePhoto(props.uid, props.offline, dataUrl);
    photoMsg.value = res.ok ? 'Saved' : (res.error ?? 'Could not save.');
  } catch {
    photoMsg.value = 'Could not read that image.';
  } finally {
    busyPhoto.value = false;
    e.target.value = '';
  }
}

async function removePhoto() {
  photoMsg.value = 'Removing…';
  const res = await savePhoto(props.uid, props.offline, '');
  photoMsg.value = res.ok ? 'Removed' : (res.error ?? 'Could not remove.');
}
</script>

<template>
  <div class="grid gap-4 short:grid-cols-2 short:gap-5">
    <!-- Left: identity, stats, callsign -->
    <div class="min-w-0 space-y-4">
      <div class="flex items-center gap-4">
        <Avatar :photo="avatar" :name="pilotName" size="xl" square />
        <div class="min-w-0 flex-1">
          <div class="font-display truncate text-xl font-bold text-zinc-100">{{ pilotName }}</div>
          <div class="truncate text-[13px] text-zinc-500">
            {{ offline ? 'Offline profile · stored in this browser' : email || 'Pilot account' }}
          </div>
          <div class="mt-2 flex flex-wrap gap-2">
            <button type="button" class="btn-ghost btn-sm" :disabled="busyPhoto" @click="fileInput?.click()">
              <UiIcon name="upload" cls="h-3.5 w-3.5" />
              {{ avatar ? 'Change picture' : 'Upload picture' }}
            </button>
            <button v-if="avatar" type="button" class="btn-danger btn-sm" :disabled="busyPhoto" @click="removePhoto">
              Remove
            </button>
          </div>
          <input ref="fileInput" type="file" accept="image/*" class="hidden" @change="onFile" />
        </div>
      </div>
      <p v-if="photoMsg" class="-mt-2 text-[13px] text-zinc-500">{{ photoMsg }}</p>
      <p v-if="loading" class="text-[13px] text-zinc-500">Loading profile…</p>

      <div class="grid grid-cols-3 gap-2">
        <StatTile label="Best" :value="highScore > 0 ? highScore.toLocaleString() : '—'" tone="accent" />
        <StatTile label="Runs" :value="gamesPlayed" />
        <StatTile label="Friends" :value="offline ? '—' : addedFriends.length" />
      </div>

      <div>
        <label class="label mb-1.5 block" for="profile-callsign">Callsign</label>
        <form class="flex gap-2" @submit.prevent="saveName">
          <input
            id="profile-callsign"
            v-model="nameEdit"
            type="text"
            maxlength="20"
            autocomplete="nickname"
            enterkeyhint="done"
            class="input-field flex-1"
          />
          <button type="submit" class="btn-primary px-5">Save</button>
        </form>
        <p v-if="renameMsg" class="mt-1.5 text-[13px] text-zinc-500">{{ renameMsg }}</p>
      </div>
    </div>

    <!-- Right: ship, friends, log out -->
    <div class="min-w-0 space-y-4">
      <div class="tile flex items-center gap-3 p-3">
        <template v-if="mostUsedShip">
          <ShipPreview :id="mostUsedShip.id" :color="mostUsedShip.color" />
          <div class="min-w-0 flex-1">
            <div class="label">Most used ship</div>
            <div class="font-ui truncate font-bold text-zinc-100">{{ mostUsedShip.name }}</div>
            <div class="truncate text-xs text-zinc-500">
              {{ mostUsedShip.title }} · {{ mostUsedCount }} {{ mostUsedCount === 1 ? 'run' : 'runs' }}
            </div>
          </div>
        </template>
        <template v-else>
          <div>
            <div class="label">Most used ship</div>
            <div class="text-[13px] text-zinc-500">No runs recorded yet — fly a mission.</div>
          </div>
        </template>
      </div>

      <div class="tile p-3">
        <div class="flex items-center justify-between gap-2">
          <div class="label">Friends ({{ offline ? 0 : addedFriends.length }})</div>
          <button
            v-if="!offline"
            type="button"
            class="inline-flex min-h-8 items-center gap-0.5 text-[13px] font-semibold text-accent"
            @click="emit('friends')"
          >
            {{ addedFriends.length > 3 ? `All ${addedFriends.length}` : 'Find pilots' }}
            <UiIcon name="chevron-right" cls="h-4 w-4" />
          </button>
        </div>
        <p v-if="offline" class="mt-1 text-[13px] text-zinc-500">Log in to add and see friends.</p>
        <p v-else-if="!addedFriends.length" class="mt-1 text-[13px] text-zinc-500">
          No friends yet — search a callsign to add one.
        </p>
        <div v-else class="mt-2 space-y-1.5">
          <PilotRow
            v-for="f in addedFriends.slice(0, 3)"
            :key="f.uid"
            :name="f.name"
            :photo="f.photo"
            :online="onlineUids.has(f.uid)"
            :sub="onlineUids.has(f.uid) ? 'Online' : 'Offline'"
            size="sm"
          />
        </div>
      </div>

      <button type="button" class="btn-danger w-full" @click="emit('logout')">
        <UiIcon name="logout" cls="h-4 w-4" />
        {{ offline ? 'Back to login' : 'Log out' }}
      </button>
    </div>
  </div>
</template>
