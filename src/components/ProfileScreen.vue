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
  <div class="flex w-full max-w-lg flex-col items-center">
    <div class="flex w-full justify-start">
      <button
        type="button"
        class="btn-ghost gap-1.5 py-1.5 text-xs"
        @click="emit('back')"
      >
        <svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
        Back
      </button>
    </div>
    <div class="label">Pilot Profile</div>
    <h2 class="font-display mt-2 text-3xl font-bold text-zinc-50" style="letter-spacing: 0.08em;">PROFILE</h2>
    <p class="font-ui mt-1.5 text-center text-sm font-medium text-zinc-500">
      {{ offline ? 'Offline profile · stored in this browser' : email || 'Pilot account' }}
    </p>

    <div class="panel-elevated mt-6 w-full space-y-6 p-6 sm:p-7">
      <!-- Identity -->
      <div class="flex items-center gap-5">
        <div class="relative shrink-0">
          <img
            v-if="avatar"
            :src="avatar"
            alt="Pilot avatar"
            class="h-20 w-20 rounded-2xl object-cover"
            style="border: 2px solid rgba(56,189,248,0.3); box-shadow: 0 0 20px rgba(56,189,248,0.15);"
          />
          <div
            v-else
            class="flex h-20 w-20 items-center justify-center rounded-2xl text-3xl font-bold text-accent"
            style="background: rgba(56,189,248,0.1); border: 2px solid rgba(56,189,248,0.25); box-shadow: 0 0 20px rgba(56,189,248,0.1); font-family: 'Outfit', sans-serif;"
          >
            {{ initial }}
          </div>
        </div>
        <div class="min-w-0 flex-1">
          <div class="font-display text-xl font-bold text-zinc-100" style="letter-spacing: 0.04em;">{{ pilotName }}</div>
          <div class="font-ui mt-1 text-[12px] font-medium text-zinc-500 tabular-nums">
            <span v-if="highScore > 0">Best <span class="text-zinc-300 font-semibold">{{ highScore.toLocaleString() }}</span> · </span>
            <span>{{ gamesPlayed }} {{ gamesPlayed === 1 ? 'run' : 'runs' }}</span>
          </div>
          <div class="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              class="btn-ghost text-[12px] py-1.5"
              :disabled="busyPhoto"
              @click="fileInput?.click()"
            >
              <svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
              {{ avatar ? 'Change picture' : 'Upload picture' }}
            </button>
            <button
              v-if="avatar"
              type="button"
              class="btn-danger text-[12px] py-1.5"
              :disabled="busyPhoto"
              @click="removePhoto"
            >
              Remove
            </button>
          </div>
          <input ref="fileInput" type="file" accept="image/*" class="hidden" @change="onFile" />
          <p v-if="photoMsg" class="mt-1.5 text-[12px] text-zinc-500">{{ photoMsg }}</p>
          <p class="mt-1 text-[11px] text-zinc-700">Square JPEG, auto-resized · stored as base64.</p>
        </div>
      </div>

      <div v-if="loading" class="text-[13px] text-zinc-500">Loading profile…</div>

      <!-- Rename callsign -->
      <div>
        <label class="label mb-2 block" for="profile-callsign">Callsign</label>
        <div class="flex gap-2">
          <input
            id="profile-callsign"
            v-model="nameEdit"
            type="text"
            maxlength="20"
            class="input-field flex-1"
          />
          <button
            type="button"
            class="btn-primary px-5"
            @click="saveName"
          >
            Save
          </button>
        </div>
        <p v-if="renameMsg" class="mt-1.5 text-[12px] text-zinc-500">{{ renameMsg }}</p>
      </div>

      <!-- Stats grid -->
      <div class="grid grid-cols-2 gap-3">
        <div class="rounded-2xl p-4 text-center" style="background: rgba(56,189,248,0.06); border: 1px solid rgba(56,189,248,0.15);">
          <div class="label text-accent/60">High Score</div>
          <div class="font-display mt-1.5 text-2xl font-bold text-accent tabular-nums" style="letter-spacing: 0.02em;">
            {{ highScore > 0 ? highScore.toLocaleString() : '—' }}
          </div>
        </div>
        <div class="rounded-2xl border border-white/8 bg-white/3 p-4 text-center">
          <div class="label">Runs Flown</div>
          <div class="font-display mt-1.5 text-2xl font-bold text-zinc-100 tabular-nums" style="letter-spacing: 0.02em;">{{ gamesPlayed }}</div>
        </div>
      </div>

      <!-- Friends widget -->
      <div class="rounded-2xl border border-white/8 bg-white/3 p-4">
        <div class="flex items-center justify-between">
          <div class="label">Friends ({{ offline ? 0 : addedFriends.length }})</div>
          <button
            v-if="!offline"
            type="button"
            class="text-[12px] font-semibold text-accent hover:text-sky-300 transition-colors"
            @click="$emit('friends')"
          >
            Find pilots →
          </button>
        </div>
        <div v-if="offline" class="mt-2 text-[13px] text-zinc-600">Log in to add and see friends.</div>
        <div v-else-if="!addedFriends.length" class="mt-2 text-[13px] text-zinc-600">No friends yet — search a callsign to add one.</div>
        <div v-else class="mt-3 space-y-2">
          <div
            v-for="f in addedFriends.slice(0, 5)"
            :key="f.uid"
            class="flex items-center gap-3 rounded-xl border border-white/6 bg-white/3 p-2.5"
          >
            <span
              class="h-2 w-2 shrink-0 rounded-full"
              :class="onlineUids.has(f.uid) ? 'bg-repair' : 'bg-zinc-700'"
              :style="onlineUids.has(f.uid) ? 'box-shadow: 0 0 6px rgba(74,222,128,0.6)' : ''"
              :title="onlineUids.has(f.uid) ? 'Online' : 'Offline'"
            />
            <img v-if="f.photo" :src="f.photo" alt="" class="h-8 w-8 rounded-full object-cover" />
            <div v-else class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[13px] font-bold text-accent" style="background: rgba(56,189,248,0.1);">
              {{ (f.name || 'P').charAt(0).toUpperCase() }}
            </div>
            <div class="min-w-0 flex-1">
              <div class="truncate text-sm font-semibold text-zinc-100">{{ f.name }}</div>
              <div class="text-[11px]" :class="onlineUids.has(f.uid) ? 'text-repair' : 'text-zinc-600'">
                {{ onlineUids.has(f.uid) ? '● Online' : 'Offline' }}
              </div>
            </div>
          </div>
          <button
            v-if="addedFriends.length > 5"
            type="button"
            class="btn-ghost w-full text-[12px]"
            @click="$emit('friends')"
          >
            View all {{ addedFriends.length }} friends →
          </button>
        </div>
      </div>

      <!-- Most used ship -->
      <div class="rounded-2xl border border-white/8 bg-white/3 p-4">
        <div class="label mb-2">Most used ship</div>
        <div v-if="!mostUsedShip" class="text-[13px] text-zinc-600">No runs recorded yet — fly a mission.</div>
        <div v-else class="flex items-center gap-4">
          <ShipPreview :id="mostUsedShip.id" :color="mostUsedShip.color" />
          <div class="min-w-0">
            <div class="flex items-center gap-2">
              <span class="h-2.5 w-2.5 rounded-full" :style="{ background: mostUsedShip.color, boxShadow: `0 0 8px ${mostUsedShip.color}` }" />
              <span class="font-bold text-zinc-100" style="font-family: 'Outfit', sans-serif;">{{ mostUsedShip.name }}</span>
            </div>
            <div class="mt-0.5 text-[12px] text-zinc-500">
              {{ mostUsedShip.title }} · {{ mostUsedCount }} {{ mostUsedCount === 1 ? 'run' : 'runs' }}
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
