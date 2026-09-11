<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { useFriendList } from '../composables/useFriends.js';
import { useLeaderboard } from '../composables/useLeaderboard.js';
import { useProfile } from '../composables/useProfile.js';
import ShipPreview from './ShipPreview.vue';

const props = defineProps({
  uid: { type: String, default: null },
  pilotName: { type: String, default: 'Pilot' },
  email: { type: String, default: '' },
  offline: { type: Boolean, default: false },
  best: { type: Number, default: 0 },
  online: { type: Array, default: () => [] },
});

const emit = defineEmits(['rename', 'friends', 'back']);

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
const initial = computed(() => (props.pilotName || 'P').trim().charAt(0).toUpperCase() || 'P');

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
  <div class="flex w-full max-w-md flex-col items-center">
    <div class="label">Neon Strike — Pilot profile</div>
    <h2 class="mt-1 text-3xl font-semibold text-zinc-50">Profile</h2>
    <p class="mt-2 text-center text-[13px] text-zinc-500">
      {{ offline ? 'Offline profile · stored in this browser' : email || 'Pilot account' }}
    </p>

    <div class="panel mt-6 w-full space-y-6 p-6 sm:p-7">
      <!-- Identity -->
      <div class="flex items-center gap-4">
        <div class="relative shrink-0">
          <img
            v-if="avatar"
            :src="avatar"
            alt="Pilot avatar"
            class="h-16 w-16 rounded-full border border-white/15 object-cover"
          />
          <div
            v-else
            class="flex h-16 w-16 items-center justify-center rounded-full border border-white/15 bg-white/5 text-2xl font-semibold text-accent"
          >
            {{ initial }}
          </div>
        </div>
        <div class="min-w-0 flex-1">
          <div class="truncate text-lg font-semibold text-zinc-100">{{ pilotName }}</div>
          <div class="text-[12px] text-zinc-500 tabular-nums">
            <span v-if="highScore > 0">Best {{ highScore.toLocaleString() }} · </span>
            <span>{{ gamesPlayed }} {{ gamesPlayed === 1 ? 'run' : 'runs' }}</span>
          </div>
          <div class="mt-2 flex gap-2">
            <button
              type="button"
              class="rounded-lg border border-white/12 px-3 py-1.5 text-[12px] font-medium text-zinc-300 transition-colors hover:border-white/30 hover:text-zinc-100 disabled:opacity-50"
              :disabled="busyPhoto"
              @click="fileInput?.click()"
            >
              {{ avatar ? 'Change picture' : 'Upload picture' }}
            </button>
            <button
              v-if="avatar"
              type="button"
              class="rounded-lg border border-danger/30 px-3 py-1.5 text-[12px] font-medium text-danger transition-colors hover:bg-danger/10 disabled:opacity-50"
              :disabled="busyPhoto"
              @click="removePhoto"
            >
              Remove
            </button>
          </div>
          <input ref="fileInput" type="file" accept="image/*" class="hidden" @change="onFile" />
          <p v-if="photoMsg" class="mt-1.5 text-[12px] text-zinc-500">{{ photoMsg }}</p>
          <p class="mt-1 text-[11px] text-zinc-600">Square JPEG, auto-resized · stored as base64.</p>
        </div>
      </div>

      <div v-if="loading" class="text-[13px] text-zinc-500">Loading profile…</div>

      <!-- Username -->
      <div>
        <label class="label block" for="profile-callsign">Username</label>
        <div class="mt-1.5 flex gap-2">
          <input
            id="profile-callsign"
            v-model="nameEdit"
            type="text"
            maxlength="20"
            class="flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-zinc-100 focus:border-accent/60 focus:outline-none"
          />
          <button
            type="button"
            class="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-surface hover:bg-sky-300"
            @click="saveName"
          >
            Save
          </button>
        </div>
        <p v-if="renameMsg" class="mt-1.5 text-[12px] text-zinc-500">{{ renameMsg }}</p>
      </div>

      <!-- Stats -->
      <div class="grid grid-cols-2 gap-2 text-center">
        <div class="panel px-2 py-3">
          <div class="label">High score</div>
          <div class="mt-1 text-lg font-semibold text-zinc-100 tabular-nums">
            {{ highScore > 0 ? highScore.toLocaleString() : '—' }}
          </div>
        </div>
        <div class="panel px-2 py-3">
          <div class="label">Runs flown</div>
          <div class="mt-1 text-lg font-semibold text-zinc-100 tabular-nums">{{ gamesPlayed }}</div>
        </div>
      </div>

      <div class="panel px-4 py-3">
        <div class="flex items-center justify-between gap-2">
          <div class="label">Added friends ({{ offline ? 0 : addedFriends.length }})</div>
          <button
            v-if="!offline"
            type="button"
            class="text-[11px] font-semibold text-accent hover:text-sky-300"
            @click="$emit('friends')"
          >
            Find pilots →
          </button>
        </div>
        <div v-if="offline" class="mt-1.5 text-[13px] text-zinc-600">
          Log in to add and see friends.
        </div>
        <div v-else-if="!addedFriends.length" class="mt-1.5 text-[13px] text-zinc-600">
          No friends yet — search a callsign to add one.
        </div>
        <div v-else class="mt-2 space-y-2">
          <div
            v-for="f in addedFriends.slice(0, 5)"
            :key="f.uid"
            class="flex items-center gap-3 rounded-lg border border-white/10 bg-white/5 px-3 py-2"
          >
            <span
              class="h-2 w-2 shrink-0 rounded-full"
              :class="onlineUids.has(f.uid) ? 'bg-repair' : 'bg-zinc-700'"
              :title="onlineUids.has(f.uid) ? 'Online' : 'Offline'"
            />
            <img
              v-if="f.photo"
              :src="f.photo"
              alt=""
              class="h-8 w-8 rounded-full object-cover"
            />
            <div
              v-else
              class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/10 text-[13px] font-semibold text-accent"
            >
              {{ (f.name || 'P').charAt(0).toUpperCase() }}
            </div>
            <div class="min-w-0 flex-1">
              <div class="truncate text-sm font-semibold text-zinc-100">{{ f.name }}</div>
              <div class="text-[11px]" :class="onlineUids.has(f.uid) ? 'text-repair' : 'text-zinc-600'">
                {{ onlineUids.has(f.uid) ? 'Online' : 'Offline' }}
              </div>
            </div>
          </div>
          <button
            v-if="addedFriends.length > 5"
            type="button"
            class="w-full rounded-lg border border-white/12 px-3 py-2 text-[12px] font-medium text-zinc-300 transition-colors hover:border-white/30 hover:text-zinc-100"
            @click="$emit('friends')"
          >
            View all {{ addedFriends.length }} friends →
          </button>
        </div>
      </div>

      <div class="panel px-4 py-3">
        <div class="label">Most used ship</div>
        <div v-if="!mostUsedShip" class="mt-1.5 text-[13px] text-zinc-600">
          No runs recorded yet — fly a mission.
        </div>
        <div v-else class="mt-2 flex items-center gap-3">
          <ShipPreview :id="mostUsedShip.id" :color="mostUsedShip.color" />
          <div class="min-w-0">
            <div class="flex items-center gap-2">
              <span class="h-2 w-2 rounded-full" :style="{ background: mostUsedShip.color }" />
              <span class="truncate text-sm font-semibold text-zinc-100">{{ mostUsedShip.name }}</span>
            </div>
            <div class="text-[12px] text-zinc-500">
              {{ mostUsedShip.title }} · {{ mostUsedCount }} {{ mostUsedCount === 1 ? 'run' : 'runs' }}
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
