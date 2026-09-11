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
const sentMap = ref({}); // uid -> request doc id (outgoing, request-first)
const sendingId = ref(null);
const actionMsg = ref('');
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
    if (!results.value.length) searchMsg.value = `No pilots found for “${t}”.`;
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
    // Mutual case: withdraw my own outgoing request to them if one exists.
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
    <div class="label">Neon Strike — Squadron</div>
    <h2 class="mt-1 text-3xl font-semibold text-zinc-50">Friends</h2>
    <p class="mt-2 text-center text-[13px] text-zinc-500">
      {{ offline ? 'Log in to find pilots and add friends.' : `${friends.length} ${friends.length === 1 ? 'friend' : 'friends'} · ${requests.length} pending` }}
    </p>

    <div v-if="offline" class="panel mt-6 w-full p-6 text-center text-[13px] text-zinc-500">
      Friends need an online account. Log in to search pilots.
    </div>

    <div v-else class="panel mt-6 w-full space-y-6 p-6 sm:p-7">
      <!-- Search -->
      <div>
        <label class="label block" for="friend-search">Search pilots</label>
        <form class="mt-1.5 flex gap-2" @submit.prevent="runSearch">
          <input
            id="friend-search"
            v-model="term"
            type="text"
            maxlength="20"
            placeholder="Callsign (min 2 letters)…"
            class="flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:border-accent/60 focus:outline-none"
            @input="scheduleSearch"
          />
          <button
            type="submit"
            :disabled="searching"
            class="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-surface hover:bg-sky-300 disabled:opacity-60"
          >
            {{ searching ? '…' : 'Search' }}
          </button>
        </form>
        <p v-if="searchMsg" class="mt-1.5 text-[12px] text-zinc-500">{{ searchMsg }}</p>
        <p v-else class="mt-1.5 text-[11px] text-zinc-600">Add sends a request — you become friends once they accept.</p>

        <div v-if="results.length" class="mt-3 space-y-2">
          <div
            v-for="r in results"
            :key="r.uid"
            class="flex items-center gap-3 rounded-lg border border-white/10 bg-white/5 px-3 py-2"
          >
            <img
              v-if="r.photo"
              :src="r.photo"
              alt=""
              class="h-9 w-9 rounded-full object-cover"
            />
            <div
              v-else
              class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/10 text-sm font-semibold text-accent"
            >
              {{ (r.name || 'P').charAt(0).toUpperCase() }}
            </div>
            <div class="min-w-0 flex-1">
              <div class="truncate text-sm font-semibold text-zinc-100">{{ r.name }}</div>
              <div class="text-[11px] text-zinc-500 tabular-nums">
                {{ r.bestScore > 0 ? `Best ${r.bestScore.toLocaleString()} · ` : '' }}{{ r.gamesPlayed }} runs
              </div>
            </div>
            <button
              v-if="friendUids.has(r.uid)"
              type="button"
              disabled
              class="rounded-lg border border-skill/30 px-3 py-1.5 text-[12px] font-medium text-skill opacity-70"
            >
              Friends
            </button>
            <button
              v-else-if="incomingByUid.has(r.uid)"
              type="button"
              class="rounded-lg bg-accent px-3 py-1.5 text-[12px] font-semibold text-surface hover:bg-sky-300"
              @click="onAccept(incomingByUid.get(r.uid))"
            >
              Accept
            </button>
            <span v-else-if="isSent(r.uid)" class="flex items-center gap-1.5">
              <span
                class="rounded-lg border border-white/12 px-3 py-1.5 text-[12px] font-medium text-zinc-500"
              >
                Sent ✓
              </span>
              <button
                type="button"
                class="text-[11px] font-medium text-zinc-500 underline-offset-2 hover:text-zinc-300 hover:underline"
                @click="onUndo(r)"
              >
                Undo
              </button>
            </span>
            <button
              v-else
              type="button"
              :disabled="sendingId === r.uid"
              class="rounded-lg bg-accent px-3 py-1.5 text-[12px] font-semibold text-surface hover:bg-sky-300 disabled:opacity-60"
              @click="onAdd(r)"
            >
              {{ sendingId === r.uid ? 'Sending…' : 'Add' }}
            </button>
          </div>
        </div>
      </div>

      <!-- Requests -->
      <div>
        <div class="label">Incoming requests ({{ requests.length }})</div>
        <div v-if="!requests.length" class="mt-1.5 text-[13px] text-zinc-600">No pending requests.</div>
        <div v-else class="mt-2 space-y-2">
          <div
            v-for="req in requests"
            :key="req.id"
            class="flex items-center gap-3 rounded-lg border border-white/10 bg-white/5 px-3 py-2"
          >
            <img
              v-if="req.fromPhoto"
              :src="req.fromPhoto"
              alt=""
              class="h-9 w-9 rounded-full object-cover"
            />
            <div
              v-else
              class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/10 text-sm font-semibold text-accent"
            >
              {{ (req.fromName || 'P').charAt(0).toUpperCase() }}
            </div>
            <div class="min-w-0 flex-1 truncate text-sm font-semibold text-zinc-100">
              {{ req.fromName }}
            </div>
            <button
              type="button"
              class="rounded-lg bg-accent px-3 py-1.5 text-[12px] font-semibold text-surface hover:bg-sky-300"
              @click="onAccept(req)"
            >
              Accept
            </button>
            <button
              type="button"
              class="rounded-lg border border-white/12 px-2.5 py-1.5 text-[12px] text-zinc-400 hover:border-white/30"
              @click="onDecline(req)"
            >
              ✕
            </button>
          </div>
        </div>
      </div>

      <!-- Friend list -->
      <div>
        <div class="label">My friends ({{ friends.length }})</div>
        <div v-if="!friends.length" class="mt-1.5 text-[13px] text-zinc-600">
          No friends yet — search a callsign above.
        </div>
        <div v-else class="mt-2 space-y-2">
          <div
            v-for="f in friends"
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
              class="h-9 w-9 rounded-full object-cover"
            />
            <div
              v-else
              class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/10 text-sm font-semibold text-accent"
            >
              {{ (f.name || 'P').charAt(0).toUpperCase() }}
            </div>
            <div class="min-w-0 flex-1">
              <div class="truncate text-sm font-semibold text-zinc-100">{{ f.name }}</div>
              <div class="text-[11px]" :class="onlineUids.has(f.uid) ? 'text-repair' : 'text-zinc-600'">
                {{ onlineUids.has(f.uid) ? 'Online' : 'Offline' }}
              </div>
            </div>
            <button
              type="button"
              class="rounded-lg border border-white/12 px-2.5 py-1.5 text-[12px] text-zinc-400 hover:border-danger/40 hover:text-danger"
              @click="onRemove(f)"
            >
              Remove
            </button>
          </div>
        </div>
      </div>

      <p v-if="actionMsg" class="text-[12px] text-zinc-400">{{ actionMsg }}</p>
    </div>
  </div>
</template>
