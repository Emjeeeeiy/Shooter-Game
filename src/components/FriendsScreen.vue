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
import InlineNotice from './ui/InlineNotice.vue';
import PilotRow from './ui/PilotRow.vue';
import SegTabs from './ui/SegTabs.vue';
import UiIcon from './UiIcon.vue';

const props = defineProps({
  uid: { type: String, default: null },
  pilotName: { type: String, default: 'Pilot' },
  photo: { type: String, default: '' },
  offline: { type: Boolean, default: false },
  online: { type: Array, default: () => [] },
});


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
const tab = ref(requests.value.length ? 'requests' : 'friends');
let debounce = null;

const tabs = computed(() => [
  { value: 'friends', label: `Friends${friends.value.length ? ` (${friends.value.length})` : ''}` },
  { value: 'requests', label: 'Requests', badge: requests.value.length || 0 },
  { value: 'find', label: 'Find', icon: 'search' },
]);

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
  if (!window.confirm(`Remove ${f.name} from your friends?`)) return;
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
  <div v-if="offline" class="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-10 text-center">
    <UiIcon name="users" cls="h-8 w-8 text-zinc-600" />
    <p class="max-w-60 text-[13px] text-zinc-500">Friends need an online account. Log in to search pilots and add friends.</p>
  </div>

  <div v-else class="flex min-h-0 flex-1 flex-col">
    <div class="px-safe shrink-0 pt-3 pb-2">
      <SegTabs v-model="tab" :options="tabs" label="Friends sections" />
    </div>

    <!-- Find: the search field stays put, results scroll -->
    <div v-if="tab === 'find'" class="px-safe shrink-0 pb-2">
      <form class="flex gap-2" role="search" @submit.prevent="runSearch">
        <label class="sr-only" for="friend-search">Search pilots by callsign</label>
        <input
          id="friend-search"
          v-model="term"
          type="search"
          maxlength="20"
          autocomplete="off"
          autocapitalize="none"
          enterkeyhint="search"
          placeholder="Callsign (min 2 letters)"
          class="input-field flex-1"
          @input="scheduleSearch"
        />
        <button type="submit" :disabled="searching" class="btn-primary w-12 px-0" aria-label="Search">
          <UiIcon :name="searching ? 'spinner' : 'search'" cls="h-4 w-4" />
        </button>
      </form>
      <p class="mt-1.5 text-xs text-zinc-500">
        {{ searchMsg || 'Add sends a request — you become friends once they accept.' }}
      </p>
    </div>

    <div class="scroll-area px-safe flex-1 space-y-2 pt-1 pb-[max(1rem,var(--sab-c))] roomy:pb-4">
      <InlineNotice v-if="actionMsg">{{ actionMsg }}</InlineNotice>

      <!-- Find results -->
      <template v-if="tab === 'find'">
        <PilotRow
          v-for="r in results"
          :key="r.uid"
          :name="r.name"
          :photo="r.photo"
          :online="onlineUids.has(r.uid)"
          :sub="`${r.bestScore > 0 ? `Best ${r.bestScore.toLocaleString()} · ` : ''}${r.gamesPlayed ?? 0} runs`"
          clickable
          @open="viewedPilot = r"
        >
          <template #actions>
            <span v-if="friendUids.has(r.uid)" class="inline-flex items-center gap-1 px-2 text-xs font-semibold text-repair">
              <UiIcon name="check" cls="h-3.5 w-3.5" /> Friends
            </span>
            <button
              v-else-if="incomingByUid.has(r.uid)"
              type="button"
              class="btn-primary btn-sm"
              @click="onAccept(incomingByUid.get(r.uid))"
            >
              Accept
            </button>
            <template v-else-if="isSent(r.uid)">
              <span class="px-1 text-xs font-medium text-zinc-500">Sent</span>
              <button type="button" class="btn-ghost btn-sm" @click="onUndo(r)">Undo</button>
            </template>
            <button v-else type="button" :disabled="sendingId === r.uid" class="btn-primary btn-sm" @click="onAdd(r)">
              <UiIcon :name="sendingId === r.uid ? 'spinner' : 'user-plus'" cls="h-3.5 w-3.5" />
              Add
            </button>
          </template>
        </PilotRow>
      </template>

      <!-- Incoming requests -->
      <template v-else-if="tab === 'requests'">
        <p v-if="!requests.length" class="py-8 text-center text-[13px] text-zinc-500">No pending requests.</p>
        <PilotRow
          v-for="req in requests"
          :key="req.id"
          :name="req.fromName"
          :photo="req.fromPhoto"
          sub="Wants to be friends"
          highlight
        >
          <template #actions>
            <button type="button" class="btn-primary btn-sm" @click="onAccept(req)">Accept</button>
            <button type="button" class="btn-icon" :aria-label="`Decline ${req.fromName}`" @click="onDecline(req)">
              <UiIcon name="x" cls="h-4 w-4" />
            </button>
          </template>
        </PilotRow>
      </template>

      <!-- Friend list -->
      <template v-else>
        <div v-if="!friends.length" class="flex flex-col items-center gap-3 py-8 text-center">
          <p class="text-[13px] text-zinc-500">No friends yet.</p>
          <button type="button" class="btn-ghost btn-sm" @click="tab = 'find'">
            <UiIcon name="search" cls="h-3.5 w-3.5" /> Find pilots
          </button>
        </div>
        <PilotRow
          v-for="f in friends"
          :key="f.uid"
          :name="f.name"
          :photo="f.photo"
          :online="onlineUids.has(f.uid)"
          :sub="onlineUids.has(f.uid) ? 'Online' : 'Offline'"
          clickable
          @open="viewedPilot = f"
        >
          <template #actions>
            <button
              type="button"
              class="btn-ghost btn-sm hover:border-danger/40 hover:text-danger"
              :aria-label="`Remove ${f.name}`"
              @click="onRemove(f)"
            >
              Remove
            </button>
          </template>
        </PilotRow>
      </template>
    </div>

    <PlayerProfileModal
      :pilot="viewedPilot"
      :viewer-uid="uid"
      :friend-uids="friendUids"
      :incoming-by-uid="incomingByUid"
      :is-sent="!!viewedPilot && isSent(viewedPilot.uid)"
      :is-online="!!viewedPilot && onlineUids.has(viewedPilot.uid)"
      :sending-id="sendingId"
      @close="viewedPilot = null"
      @add="onAdd"
      @undo="onUndo"
      @accept="onAccept"
    />
  </div>
</template>
