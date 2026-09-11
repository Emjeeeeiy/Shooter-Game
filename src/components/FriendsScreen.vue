<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import {
  cancelFriendRequest,
  friendlyFriendError,
  loadSentMap,
  searchPilots,
  sendFriendRequest,
  storeSentMap,
  useFriendList,
  useFriendRequests,
} from '../composables/useFriends.js';
import PlayerProfileModal from './PlayerProfileModal.vue';

const props = defineProps({
  uid: { type: String, default: null },
  pilotName: { type: String, default: 'Pilot' },
  photo: { type: String, default: '' },
  offline: { type: Boolean, default: false },
  online: { type: Array, default: () => [] },
});

defineEmits(['back']);

const reqCtl = useFriendRequests();
const listCtl = useFriendList();
const requests = reqCtl.requests;
const friends = listCtl.friends;

const term = ref('');
const results = ref([]);
const searching = ref(false);
const searchMsg = ref('');
const sentMap = ref({});
const sendingId = ref(null);
const actionMsg = ref('');
const viewedPilot = ref(null); // currently-viewed pilot in the profile modal
let debounce = null;

function loadSent() {
  sentMap.value = loadSentMap(props.uid);
}
function storeSent() {
  storeSentMap(props.uid, sentMap.value);
}

const friendUids = computed(() => new Set(friends.value.map((f) => f.uid)));
const incomingByUid = computed(() => {
  const map = new Map();
  for (const r of requests.value) {
    if (r.fromUid && !map.has(r.fromUid)) map.set(r.fromUid, r);
  }
  return map;
});
const onlineUids = computed(() => new Set((props.online ?? []).map((o) => o.uid)));

watch(
  () => [props.uid, props.offline],
  ([uid, off]) => {
    loadSent();
    results.value = [];
    searchMsg.value = '';
    if (uid && !off) {
      reqCtl.watchUid(uid);
      listCtl.watchUid(uid);
    } else {
      reqCtl.watchUid(null);
      listCtl.watchUid(null);
    }
  },
  { immediate: true },
);

onBeforeUnmount(() => {
  if (debounce) clearTimeout(debounce);
  reqCtl.watchUid(null);
  listCtl.watchUid(null);
});

function scheduleSearch() {
  if (debounce) clearTimeout(debounce);
  debounce = setTimeout(() => runSearch(), 400);
}

async function runSearch() {
  const t = term.value.trim();
  results.value = [];
  if (t.length < 2) {
    searchMsg.value = t ? 'Type at least 2 letters.' : '';
    return;
  }
  searching.value = true;
  searchMsg.value = '';
  try {
    results.value = await searchPilots(t, props.uid);
    if (!results.value.length) searchMsg.value = `No pilots found for "${t}".`;
  } catch (e) {
    searchMsg.value = e?.message ?? 'Search failed.';
  } finally {
    searching.value = false;
  }
}

async function onAdd(target) {
  if (sendingId.value) return;
  sendingId.value = target.uid;
  actionMsg.value = '';
  try {
    const { id } = await sendFriendRequest(target.uid, {
      fromUid: props.uid,
      fromName: props.pilotName,
      fromPhoto: props.photo,
    });
    sentMap.value = { ...sentMap.value, [target.uid]: id };
    storeSent();
    actionMsg.value = `Request sent to ${target.name} — they need to accept.`;
  } catch (e) {
    actionMsg.value = friendlyFriendError(e);
  } finally {
    sendingId.value = null;
  }
}

async function onUndo(target) {
  const reqId = sentMap.value[target.uid];
  if (!reqId) return;
  actionMsg.value = '';
  try {
    await cancelFriendRequest(target.uid, reqId);
    const next = { ...sentMap.value };
    delete next[target.uid];
    sentMap.value = next;
    storeSent();
    actionMsg.value = `Request to ${target.name} withdrawn.`;
  } catch (e) {
    actionMsg.value = friendlyFriendError(e);
  }
}

async function onAccept(req) {
  actionMsg.value = '';
  try {
    await reqCtl.accept(props.uid, req);
    const mine = sentMap.value[req.fromUid];
    if (mine) {
      await cancelFriendRequest(req.fromUid, mine).catch(() => {});
      const next = { ...sentMap.value };
      delete next[req.fromUid];
      sentMap.value = next;
      storeSent();
    }
    actionMsg.value = `${req.fromName} is now your friend.`;
  } catch (e) {
    actionMsg.value = friendlyFriendError(e);
  }
}

async function onDecline(req) {
  try {
    await reqCtl.decline(props.uid, req.id);
  } catch {
    // ignore
  }
}

async function onRemove(f) {
  try {
    await listCtl.remove(props.uid, f.uid);
    actionMsg.value = `${f.name} removed.`;
  } catch {
    actionMsg.value = 'Could not remove.';
  }
}

function isSent(uid) {
  return !!sentMap.value[uid];
}
</script>

<template>
  <div class="flex w-full max-w-md flex-col items-center">
    <div class="label">Squadron</div>
    <h2 class="font-display mt-2 text-3xl font-bold text-zinc-50" style="letter-spacing: 0.08em;">FRIENDS</h2>
    <p class="font-ui mt-1.5 text-center text-sm font-medium text-zinc-500">
      {{ offline ? 'Log in to find pilots and add friends.' : `${friends.length} ${friends.length === 1 ? 'friend' : 'friends'} · ${requests.length} pending` }}
    </p>

    <div v-if="offline" class="panel-elevated mt-6 w-full p-8 text-center">
      <div class="mb-3 text-4xl">👥</div>
      <p class="text-[13px] text-zinc-500">Friends need an online account.<br/>Log in to search pilots.</p>
    </div>

    <div v-else class="panel-elevated mt-6 w-full space-y-6 p-6 sm:p-7">

      <!-- Search -->
      <div>
        <label class="label mb-2 block" for="friend-search">Search pilots</label>
        <form class="flex gap-2" @submit.prevent="runSearch">
          <input
            id="friend-search"
            v-model="term"
            type="text"
            maxlength="20"
            placeholder="Callsign (min 2 letters)…"
            class="input-field flex-1"
            @input="scheduleSearch"
          />
          <button
            type="submit"
            :disabled="searching"
            class="btn-primary px-4"
          >
            <svg v-if="searching" class="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
            <svg v-else class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          </button>
        </form>
        <p v-if="searchMsg" class="mt-2 text-[12px] text-zinc-500">{{ searchMsg }}</p>
        <p v-else class="mt-2 text-[11px] text-zinc-700">Add sends a request — you become friends once they accept.</p>

        <div v-if="results.length" class="mt-3 space-y-2">
          <div
            v-for="r in results"
            :key="r.uid"
            class="flex items-center gap-3 rounded-xl p-3 transition-colors"
            style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06);"
          >
            <img v-if="r.photo" :src="r.photo" alt="" class="h-9 w-9 rounded-full object-cover" />
            <div v-else class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold text-accent" style="background: rgba(56,189,248,0.1);">
              {{ (r.name || 'P').charAt(0).toUpperCase() }}
            </div>
            <div class="min-w-0 flex-1">
              <div class="truncate text-sm font-semibold text-zinc-100">{{ r.name }}</div>
              <div class="text-[11px] text-zinc-500 tabular-nums">
                {{ r.bestScore > 0 ? `Best ${r.bestScore.toLocaleString()} · ` : '' }}{{ r.gamesPlayed }} runs
              </div>
            </div>
            <button v-if="friendUids.has(r.uid)" type="button" disabled class="rounded-xl border border-repair/30 px-3 py-1.5 text-[12px] font-medium text-repair opacity-70">✓ Friends</button>
            <button v-else-if="incomingByUid.has(r.uid)" type="button" class="btn-primary py-1.5 px-3 text-xs" @click="onAccept(incomingByUid.get(r.uid))">Accept</button>
            <span v-else-if="isSent(r.uid)" class="flex items-center gap-1.5">
              <span class="rounded-xl border border-white/10 px-3 py-1.5 text-[12px] font-medium text-zinc-500">Sent ✓</span>
              <button type="button" class="text-[11px] font-medium text-zinc-500 hover:text-zinc-300 underline-offset-2 hover:underline" @click="onUndo(r)">Undo</button>
            </span>
            <button v-else type="button" :disabled="sendingId === r.uid" class="btn-primary py-1.5 px-3 text-xs" @click="onAdd(r)">
              {{ sendingId === r.uid ? '…' : 'Add' }}
            </button>
          </div>
        </div>
      </div>

      <!-- Incoming requests -->
      <div>
        <div class="mb-2 flex items-center justify-between">
          <div class="label">Incoming requests</div>
          <span v-if="requests.length" class="rounded-full px-2 py-0.5 text-[10px] font-bold text-danger" style="background: rgba(251,113,133,0.15);">{{ requests.length }}</span>
        </div>
        <div v-if="!requests.length" class="text-[13px] text-zinc-600">No pending requests.</div>
        <div v-else class="space-y-2">
          <div
            v-for="req in requests"
            :key="req.id"
            class="flex items-center gap-3 rounded-xl p-3"
            style="background: rgba(56,189,248,0.04); border: 1px solid rgba(56,189,248,0.15);"
          >
            <img v-if="req.fromPhoto" :src="req.fromPhoto" alt="" class="h-9 w-9 rounded-full object-cover" />
            <div v-else class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold text-accent" style="background: rgba(56,189,248,0.1);">
              {{ (req.fromName || 'P').charAt(0).toUpperCase() }}
            </div>
            <div class="min-w-0 flex-1 truncate text-sm font-semibold text-zinc-100">{{ req.fromName }}</div>
            <button type="button" class="btn-primary py-1.5 px-3 text-xs" @click="onAccept(req)">Accept</button>
            <button type="button" class="btn-ghost py-1.5 px-2 text-xs" @click="onDecline(req)">✕</button>
          </div>
        </div>
      </div>

      <!-- Friend list -->
      <div>
        <div class="label mb-2">My friends ({{ friends.length }})</div>
        <div v-if="!friends.length" class="text-[13px] text-zinc-600">No friends yet — search a callsign above.</div>
        <div v-else class="space-y-2">
          <div
            v-for="f in friends"
            :key="f.uid"
            class="flex items-center gap-3 rounded-xl p-3 transition-colors"
            style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06);"
          >
            <span
              class="h-2 w-2 shrink-0 rounded-full"
              :class="onlineUids.has(f.uid) ? 'bg-repair' : 'bg-zinc-700'"
              :style="onlineUids.has(f.uid) ? 'box-shadow: 0 0 6px rgba(74,222,128,0.6)' : ''"
            />
            <img v-if="f.photo" :src="f.photo" alt="" class="h-9 w-9 rounded-full object-cover" />
            <div v-else class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold text-accent" style="background: rgba(56,189,248,0.1);">
              {{ (f.name || 'P').charAt(0).toUpperCase() }}
            </div>
            <div class="min-w-0 flex-1">
              <div class="truncate text-sm font-semibold text-zinc-100">{{ f.name }}</div>
              <div class="text-[11px]" :class="onlineUids.has(f.uid) ? 'text-repair' : 'text-zinc-600'">
                {{ onlineUids.has(f.uid) ? '● Online' : 'Offline' }}
              </div>
            </div>
            <button type="button" class="btn-ghost py-1.5 px-3 text-[12px] hover:border-danger/40 hover:text-danger" @click="onRemove(f)">Remove</button>
          </div>
        </div>
      </div>

      <p v-if="actionMsg" class="rounded-xl border border-white/8 bg-white/3 px-3.5 py-2.5 text-[12px] text-zinc-400">{{ actionMsg }}</p>
    </div>
  </div>
</template>
