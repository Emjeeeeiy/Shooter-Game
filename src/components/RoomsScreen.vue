<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { CHARACTER_LIST, MAP_PICKS } from '../game/constants.js';
import {
  backToRoomLobby,
  createRoom,
  joinRoom,
  leaveRoom,
  setRoomMap,
  setRoomMode,
  setRoomPhoto,
  setRoomShip,
  showResults,
  startMatch,
  toggleReady,
  useRoom,
} from '../composables/useRoom.js';
import { usePresence } from '../composables/usePresence.js';
import {
  friendlyFriendError,
  loadSentMap,
  sendFriendRequest,
  storeSentMap,
  useFriendList,
  useFriendRequests,
} from '../composables/useFriends.js';
import MapPreview from './MapPreview.vue';
import UiIcon from './UiIcon.vue';

const props = defineProps({
  uid: { type: String, required: true },
  pilotName: { type: String, default: 'Pilot' },
  photo: { type: String, default: '' },
  rejoinCode: { type: String, default: '' },
});

const emit = defineEmits(['deploy', 'back']);

const code = ref('');
const joinInput = ref('');
const ship = ref('vanguard');
const busy = ref(false);
const error = ref('');
const deployed = ref(false);

const { room, missing } = useRoom(code);

const presence = usePresence();
const sentIds = ref(new Set());
let unsubOnline = null;

const friendReqCtl = useFriendRequests();
const friendListCtl = useFriendList();
const friendReqs = friendReqCtl.requests;
const friendList = friendListCtl.friends;
const sentMap = ref({});
const friendSending = ref(null);
const friendMsg = ref('');

const friendUids = computed(() => new Set(friendList.value.map((f) => f.uid)));
const incomingByUid = computed(() => {
  const map = new Map();
  for (const r of friendReqs.value) {
    if (r.fromUid && !map.has(r.fromUid)) map.set(r.fromUid, r);
  }
  return map;
});
const onlineIds = computed(() => new Set(presence.online.value.map((p) => p.uid)));
const friendsNotInRoom = computed(() => {
  const memberIds = new Set(members.value.map((m) => m.id));
  return friendList.value
    .filter((f) => !memberIds.has(f.uid))
    .sort(
      (a, b) =>
        Number(onlineIds.value.has(b.uid)) - Number(onlineIds.value.has(a.uid)) ||
        a.name.localeCompare(b.name),
    );
});

watch(
  () => props.uid,
  (uid) => {
    sentMap.value = loadSentMap(uid);
    friendReqCtl.watchUid(uid);
    friendListCtl.watchUid(uid);
  },
  { immediate: true },
);

async function onAddFriend(m) {
  if (friendSending.value) return;
  friendSending.value = m.id;
  friendMsg.value = '';
  try {
    const { id } = await sendFriendRequest(m.id, {
      fromUid: props.uid,
      fromName: props.pilotName,
      fromPhoto: props.photo,
    });
    sentMap.value = { ...sentMap.value, [m.id]: id };
    storeSentMap(props.uid, sentMap.value);
    friendMsg.value = `Request sent to ${m.name} — they need to accept.`;
  } catch (e) {
    friendMsg.value = friendlyFriendError(e);
  } finally {
    friendSending.value = null;
  }
}

async function onAcceptFriend(req) {
  friendMsg.value = '';
  try {
    await friendReqCtl.accept(props.uid, req);
    friendMsg.value = `${req.fromName} is now your friend.`;
  } catch (e) {
    friendMsg.value = friendlyFriendError(e);
  }
}

onMounted(() => {
  unsubOnline = presence.subscribe();
});
onBeforeUnmount(() => {
  if (unsubOnline) unsubOnline();
  friendReqCtl.watchUid(null);
  friendListCtl.watchUid(null);
});

const othersOnline = computed(() => {
  const memberIds = new Set(members.value.map((m) => m.id));
  return presence.online.value.filter((p) => p.uid !== props.uid && !memberIds.has(p.uid));
});

async function invite(p) {
  try {
    await presence.sendInvite(p.uid, {
      fromUid: props.uid,
      fromName: props.pilotName,
      roomCode: code.value,
      mode: room.value?.mode ?? 'arcade',
    });
    sentIds.value = new Set(sentIds.value).add(p.uid);
  } catch (e) {
    error.value = e?.message ?? 'Invite failed.';
  }
}

const members = computed(() => {
  const m = room.value?.members ?? {};
  return Object.entries(m)
    .map(([id, info]) => ({ id, ...info }))
    .sort((a, b) => (a.joinedAt ?? 0) - (b.joinedAt ?? 0));
});

const isHost = computed(() => room.value?.host === props.uid);
const me = computed(() => members.value.find((m) => m.id === props.uid));

// Adopt the room's stored ship when (re)joining so the picker stays in sync.
watch(me, (m) => {
  if (m?.ship && m.ship !== ship.value) ship.value = m.ship;
});

function shipDef(id) {
  return CHARACTER_LIST.find((c) => c.id === id) ?? CHARACTER_LIST[0];
}

function memberPhoto(id) {
  const m = members.value.find((x) => x.id === id);
  return m?.photo ?? '';
}

function initialOf(name) {
  return (String(name ?? 'P').trim().charAt(0) || 'P').toUpperCase();
}

const shownMap = computed(() => {
  const id =
    room.value?.status === 'playing'
      ? (room.value?.map ?? 'grid')
      : (room.value?.mapPick ?? 'grid');
  return MAP_PICKS.find((m) => m.id === id) ?? MAP_PICKS[0];
});
const allDone = computed(() => {
  const live = room.value?.live ?? {};
  const ids = Object.keys(room.value?.members ?? {});
  return ids.length > 0 && ids.every((id) => live[id]?.done);
});
const standings = computed(() => {
  const live = room.value?.live ?? {};
  return Object.entries(live)
    .map(([id, s]) => ({ id, name: s.name ?? 'Pilot', score: s.finalScore ?? s.score ?? 0, wave: s.finalWave ?? s.wave ?? 1, done: !!s.done }))
    .sort((a, b) => b.score - a.score);
});
const squadTotal = computed(() => standings.value.reduce((s, x) => s + (x.score || 0), 0));

watch(
  () => room.value?.status,
  (status) => {
    if (status === 'playing' && !deployed.value) {
      deployed.value = true;
      emit('deploy', code.value);
    }
    if (status === 'lobby') deployed.value = false;
  },
);

onMounted(() => {
  // Returning from a finished run — reattach to the same room subscription.
  if (props.rejoinCode && !code.value) code.value = props.rejoinCode.toUpperCase();
});

watch(missing, (gone) => {
  if (gone && code.value) {
    error.value = 'Room closed.';
    code.value = '';
  }
});

watch(ship, async (s) => {
  if (!code.value) return;
  try {
    await setRoomShip(code.value, props.uid, s);
  } catch {
    // ignore — will sync on next snapshot
  }
});

// Keep the lobby avatar in sync when the profile picture changes mid-room.
watch(
  () => props.photo,
  async (p) => {
    if (!code.value) return;
    try {
      await setRoomPhoto(code.value, props.uid, p);
    } catch {
      // ignore — will sync on next join
    }
  },
);

async function onCreate(mode) {
  if (busy.value) return;
  busy.value = true;
  error.value = '';
  try {
    code.value = await createRoom(props.uid, props.pilotName, ship.value, mode, props.photo);
  } catch (e) {
    error.value = e?.message ?? 'Could not create room (network / database rules?).';
  } finally {
    busy.value = false;
  }
}

async function onJoin() {
  if (busy.value || !joinInput.value.trim()) return;
  busy.value = true;
  error.value = '';
  try {
    code.value = await joinRoom(joinInput.value.trim(), props.uid, props.pilotName, ship.value, props.photo);
  } catch (e) {
    error.value = e?.message ?? 'Could not join room.';
  } finally {
    busy.value = false;
  }
}

async function onLeave() {
  try {
    if (code.value) await leaveRoom(code.value, props.uid);
  } catch {
    // ignore
  }
  code.value = '';
  emit('back');
}

// Header Back button: leave the room first when inside one.
function goBack() {
  if (code.value) onLeave();
  else emit('back');
}

defineExpose({ goBack });

async function onReady() {
  try {
    await toggleReady(code.value, props.uid, !me.value?.ready);
  } catch (e) {
    error.value = e?.message ?? 'Could not update ready state.';
  }
}

async function onStart() {
  try {
    await startMatch(code.value);
  } catch (e) {
    error.value = e?.message ?? 'Could not start match.';
  }
}

function copyCode() {
  try {
    navigator.clipboard.writeText(code.value);
  } catch {
    // clipboard unavailable
  }
}
</script>

<template>
  <div class="flex w-full max-w-xl flex-col items-center">
    <!-- Gate: create / join -->
    <template v-if="!code">
      <div class="label">Multiplayer race</div>
      <h2 class="mt-1 text-3xl font-semibold text-zinc-50">Squad up</h2>
      <p class="mt-2 text-center text-[13px] text-zinc-500">
        Same arena, same waves, live rival ships and skills — highest score wins.
      </p>

      <div class="panel mt-6 w-full p-6">
        <button
          type="button"
          :disabled="busy"
          class="mt-4 w-full rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-surface hover:bg-sky-300 disabled:opacity-60"
          @click="onCreate('arcade')"
        >
          <span v-if="busy">Working…</span>
          <span v-else class="inline-flex items-center justify-center gap-2"><UiIcon name="users" cls="h-4 w-4" />Host Arcade Co-op</span>
        </button>
        <p class="mt-1.5 text-[11px] text-zinc-600">Same battlefield with live rivals, squad total wins. Boss kills gift repairs to mates.</p>
        <button
          type="button"
          :disabled="busy"
          class="mt-2.5 w-full rounded-lg bg-missile px-4 py-2.5 text-sm font-semibold text-surface hover:brightness-110 disabled:opacity-60"
          @click="onCreate('versus')"
        >
          <span v-if="busy">Working…</span>
          <span v-else class="inline-flex items-center justify-center gap-2"><UiIcon name="swords" cls="h-4 w-4" />Host Versus Duel</span>
        </button>
        <p class="mt-1.5 text-[11px] text-zinc-600">Same-arena duel, rivals visible — every 5 kills sends chargers at them.</p>

        <div class="my-4 border-t border-white/10" />

        <label class="label block" for="room-code">Join with code</label>
        <div class="mt-1.5 flex gap-2">
          <input
            id="room-code"
            v-model="joinInput"
            type="text"
            maxlength="6"
            placeholder="ABC123"
            class="flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm tracking-[0.2em] text-zinc-100 uppercase placeholder-zinc-600 focus:border-accent/60 focus:outline-none"
            @keyup.enter="onJoin"
          />
          <button
            type="button"
            :disabled="busy"
            class="rounded-lg border border-white/12 px-4 py-2 text-sm font-medium text-zinc-200 hover:border-white/25 disabled:opacity-60"
            @click="onJoin"
          >
            Join
          </button>
        </div>

        <p v-if="error" class="mt-3 rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-[12px] text-danger">
          {{ error }}
        </p>

        <p class="mt-3 text-center text-[11px] text-zinc-600">
          Tip: anyone with the code can join — add them as a friend from the pilot list inside the room, or find pilots with the search icon up top.
        </p>
      </div>


    </template>

    <!-- Inside room -->
    <template v-else>
      <div class="label">Room {{ code }} · {{ room?.mode === 'versus' ? 'Versus Duel' : 'Arcade Co-op' }}</div>
      <div class="mt-1 flex items-center gap-3">
        <h2 class="text-3xl font-semibold tracking-[0.2em] text-zinc-50">{{ code }}</h2>
        <button
          type="button"
          class="rounded-md border border-white/12 px-2 py-1 text-[12px] text-zinc-400 transition-colors hover:border-white/30 hover:text-zinc-200"
          @click="copyCode"
        >
          Copy
        </button>
      </div>
      <div v-if="isHost && room?.status === 'lobby'" class="mt-3 flex gap-2">
        <button
          type="button"
          class="flex-1 rounded-lg border px-3 py-1.5 text-[12px] font-medium transition-all"
          :class="room?.mode !== 'versus' ? 'border-accent bg-accent/10 text-zinc-100' : 'border-white/10 text-zinc-500 hover:border-white/25'"
          @click="setRoomMode(code, 'arcade')"
        >
          <span class="inline-flex items-center gap-1.5"><UiIcon name="users" cls="h-3.5 w-3.5" />Arcade</span>
        </button>
        <button
          type="button"
          class="flex-1 rounded-lg border px-3 py-1.5 text-[12px] font-medium transition-all"
          :class="room?.mode === 'versus' ? 'border-missile bg-missile/10 text-zinc-100' : 'border-white/10 text-zinc-500 hover:border-white/25'"
          @click="setRoomMode(code, 'versus')"
        >
          <span class="inline-flex items-center gap-1.5"><UiIcon name="swords" cls="h-3.5 w-3.5" />Versus</span>
        </button>
      </div>
      <p class="mt-2 text-[13px] text-zinc-500">
        {{ room?.status === 'done' ? 'Match over — final standings.' : isHost ? 'You are the host. Start when the squad is ready.' : 'Waiting for the host to start.' }}
      </p>

      <div class="panel mt-5 w-full p-5">
        <div class="label">Pilots ({{ members.length }})</div>
        <ul class="mt-2 space-y-2">
          <li
            v-for="m in members"
            :key="m.id"
            class="flex flex-wrap items-center gap-2.5 rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2"
          >
            <img
              v-if="m.photo"
              :src="m.photo"
              alt=""
              class="h-8 w-8 shrink-0 rounded-full border border-white/10 object-cover"
            />
            <div
              v-else
              class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5 text-sm font-semibold text-accent"
            >
              {{ initialOf(m.name) }}
            </div>
            <span class="text-sm font-medium" :class="m.id === uid ? 'text-accent' : 'text-zinc-200'">
              {{ m.name }}{{ m.id === uid ? ' (you)' : '' }}
            </span>
            <span v-if="m.id === room?.host" class="rounded bg-skill/15 px-1.5 py-0.5 text-[10px] font-bold text-skill">HOST</span>
            <span class="ml-auto inline-flex items-center gap-1.5 text-[11px] text-zinc-500"><span class="h-2 w-2 rounded-full" :style="{ background: shipDef(m.ship).color }" />{{ shipDef(m.ship).name }}</span>
            <span
              class="rounded-full px-2 py-0.5 text-[10px] font-bold"
              :class="m.ready ? 'bg-shock/15 text-shock' : 'bg-white/5 text-zinc-500'"
            >
              {{ m.ready ? 'READY' : 'WAITING' }}
            </span>
            <template v-if="m.id !== uid">
              <span
                v-if="friendUids.has(m.id)"
                class="rounded-full border border-skill/30 px-2 py-0.5 text-[10px] font-medium text-skill"
              >
                FRIENDS
              </span>
              <button
                v-else-if="incomingByUid.has(m.id)"
                type="button"
                class="rounded-full bg-accent px-2 py-0.5 text-[10px] font-bold text-surface transition-colors hover:bg-sky-300"
                @click="onAcceptFriend(incomingByUid.get(m.id))"
              >
                ACCEPT
              </button>
              <span
                v-else-if="sentMap[m.id]"
                class="rounded-full bg-white/5 px-2 py-0.5 text-[10px] font-medium text-zinc-500"
              >
                SENT ✓
              </span>
              <button
                v-else
                type="button"
                :disabled="friendSending === m.id"
                class="rounded-full border border-accent/40 px-2 py-0.5 text-[10px] font-bold text-accent transition-colors hover:bg-accent/10 disabled:opacity-60"
                @click="onAddFriend(m)"
              >
                {{ friendSending === m.id ? '…' : '+ ADD' }}
              </button>
            </template>
          </li>
        </ul>
        <p v-if="friendMsg" class="mt-2 text-[12px] text-zinc-400">{{ friendMsg }}</p>

        <div class="mt-4">
          <div class="label">Friends — invite</div>
          <div v-if="!friendsNotInRoom.length" class="mt-1.5 text-[12px] text-zinc-600">
            No friends outside this room. Add pilots above, or find more via the search icon up top.
          </div>
          <ul v-else class="mt-2 space-y-1.5">
            <li v-for="f in friendsNotInRoom" :key="f.uid" class="flex items-center gap-2 text-sm">
              <span
                class="h-2 w-2 shrink-0 rounded-full"
                :class="onlineIds.has(f.uid) ? 'bg-repair' : 'bg-zinc-700'"
                :title="onlineIds.has(f.uid) ? 'Online' : 'Offline'"
              />
              <span class="font-medium text-zinc-200">{{ f.name }}</span>
              <button
                v-if="!sentIds.has(f.uid)"
                type="button"
                class="ml-auto rounded-md border border-accent/40 px-2.5 py-1 text-[11px] font-semibold text-accent transition-colors hover:bg-accent/10"
                @click="invite(f)"
              >
                Invite
              </button>
              <span v-else class="ml-auto inline-flex items-center gap-1 text-[11px] font-semibold text-shock">Invited<UiIcon name="check" cls="h-3 w-3" /></span>
            </li>
          </ul>
        </div>

        <div class="mt-4">
          <div class="label">Online pilots — invite</div>
          <div v-if="!othersOnline.length" class="mt-1.5 text-[12px] text-zinc-600">
            Nobody else online right now.
          </div>
          <ul v-else class="mt-2 space-y-1.5">
            <li v-for="p in othersOnline" :key="p.uid" class="flex items-center gap-2 text-sm">
              <span class="font-medium text-zinc-200">{{ p.name }}</span>
              <button
                v-if="!sentIds.has(p.uid)"
                type="button"
                class="ml-auto rounded-md border border-accent/40 px-2.5 py-1 text-[11px] font-semibold text-accent transition-colors hover:bg-accent/10"
                @click="invite(p)"
              >
                Invite
              </button>
              <span v-else class="ml-auto inline-flex items-center gap-1 text-[11px] font-semibold text-shock">Invited<UiIcon name="check" cls="h-3 w-3" /></span>
            </li>
          </ul>
        </div>

        <div class="mt-4">
          <div class="label">Your ship</div>
          <div class="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-5">
            <button
              v-for="c in CHARACTER_LIST"
              :key="c.id"
              type="button"
              class="rounded-lg border px-2 py-2 text-[12px] font-medium transition-all"
              :class="ship === c.id ? 'border-accent bg-accent/10 text-zinc-100' : 'border-white/10 text-zinc-500 hover:border-white/25'"
              @click="ship = c.id"
            >
              <span class="mx-auto mb-1 block h-2 w-2 rounded-full" :style="{ background: c.color }" />
              {{ c.name }}
            </button>
          </div>
        </div>

        <div class="mt-4">
          <div class="label">Arena map</div>
          <div
            v-if="isHost && room?.status === 'lobby'"
            class="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2"
          >
            <button
              v-for="mp in MAP_PICKS"
              :key="mp.id"
              type="button"
              class="rounded-lg border px-2 py-2 text-left transition-all"
              :class="(room?.mapPick ?? 'grid') === mp.id ? 'border-accent bg-accent/10' : 'border-white/10 hover:border-white/25'"
              @click="setRoomMap(code, mp.id)"
            >
              <MapPreview :map-id="mp.id" class="mb-1.5" />
              <div class="text-[12px] font-semibold text-zinc-100">{{ mp.name }}</div>
              <div class="text-[11px] text-zinc-500">{{ mp.desc }}</div>
            </button>
          </div>
          <div v-else class="mt-2 max-w-[320px]">
            <MapPreview :map-id="shownMap.id" />
            <p class="mt-1.5 text-[13px] text-zinc-300">
              {{ shownMap.name }} <span class="text-zinc-500">— {{ shownMap.desc }}</span>
            </p>
          </div>
        </div>

        <div v-if="room?.status === 'lobby'" class="mt-4 flex gap-2">
          <button
            type="button"
            class="flex-1 rounded-lg border border-white/12 px-4 py-2.5 text-sm font-medium text-zinc-200 hover:border-white/25"
            @click="onReady"
          >
            {{ me?.ready ? 'Unready' : 'Ready up' }}
          </button>
          <button
            v-if="isHost"
            type="button"
            :disabled="members.length < 1"
            class="flex-1 rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-surface hover:bg-sky-300 disabled:opacity-60"
            @click="onStart"
          >
            Start match
          </button>
        </div>

        <div v-if="room?.status === 'playing'" class="mt-4">
          <div class="label">Match in progress</div>
          <p class="mt-1 text-[12px] text-zinc-500">
            {{
              room?.mode === 'versus'
                ? 'Every 5 kills sends chargers at your rivals. Highest score wins.'
                : 'Same battlefield — squad total counts. Boss kills gift repairs to teammates.'
            }}
          </p>
          <ol class="mt-2 space-y-1.5">
            <li
              v-for="(s, i) in standings"
              :key="s.id"
              class="flex items-center gap-2 text-sm tabular-nums"
              :class="s.id === uid ? 'text-accent' : 'text-zinc-300'"
            >
              <span class="w-6 text-zinc-500">{{ i + 1 }}</span>
              <img
                v-if="memberPhoto(s.id)"
                :src="memberPhoto(s.id)"
                alt=""
                class="h-6 w-6 shrink-0 rounded-full border border-white/10 object-cover"
              />
              <div
                v-else
                class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/10 text-[10px] font-semibold text-accent"
              >
                {{ initialOf(s.name) }}
              </div>
              <span class="inline-flex items-center gap-1 font-medium">{{ s.name }}<UiIcon v-if="s.done" name="check" cls="h-3 w-3 text-shock" /></span>
              <span class="ml-auto">{{ s.score.toLocaleString() }}</span>
              <span class="w-14 text-right text-[12px] text-zinc-500">W{{ s.wave }}</span>
            </li>
          </ol>
          <div class="mt-4 flex gap-2">
            <button
              type="button"
              class="flex-1 rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-surface hover:bg-sky-300"
              @click="deployed = true; $emit('deploy', code)"
            >
              Back to run
            </button>
          </div>
        </div>

        <div v-if="room?.status === 'done'" class="mt-4">
          <div
            v-if="room?.mode !== 'versus'"
            class="mb-2 rounded-lg bg-accent/10 px-3 py-2 text-sm font-semibold text-accent tabular-nums"
          >
            Squad total: {{ squadTotal.toLocaleString() }}
          </div>
          <div class="label">Final standings</div>
          <ol class="mt-2 space-y-1.5">
            <li
              v-for="(s, i) in standings"
              :key="s.id"
              class="flex items-center gap-2 text-sm tabular-nums"
              :class="s.id === uid ? 'text-accent' : 'text-zinc-300'"
            >
              <span class="w-6 text-zinc-500">{{ i + 1 }}</span>
              <img
                v-if="memberPhoto(s.id)"
                :src="memberPhoto(s.id)"
                alt=""
                class="h-6 w-6 shrink-0 rounded-full border border-white/10 object-cover"
              />
              <div
                v-else
                class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/10 text-[10px] font-semibold text-accent"
              >
                {{ initialOf(s.name) }}
              </div>
              <span class="font-medium">{{ s.name }}</span>
              <span class="ml-auto">{{ s.score.toLocaleString() }}</span>
              <span class="w-14 text-right text-[12px] text-zinc-500">W{{ s.wave }}</span>
            </li>
          </ol>
          <div v-if="isHost" class="mt-4 flex gap-2">
            <button
              type="button"
              class="flex-1 rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-surface hover:bg-sky-300"
              @click="onStart"
            >
              Rematch
            </button>
            <button
              type="button"
              class="flex-1 rounded-lg border border-white/12 px-4 py-2.5 text-sm font-medium text-zinc-200 hover:border-white/25"
              @click="backToRoomLobby(code)"
            >
              To room lobby
            </button>
          </div>
        </div>

        <div v-if="allDone && room?.status === 'playing'" class="mt-4">
          <button
            type="button"
            class="w-full rounded-lg bg-skill px-4 py-2.5 text-sm font-semibold text-surface hover:brightness-110"
            @click="showResults(code)"
          >
            Everyone finished — show results
          </button>
        </div>

        <p v-if="error" class="mt-3 rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-[12px] text-danger">
          {{ error }}
        </p>
      </div>

      <p class="mt-4 text-[12px] text-zinc-600">Leaving? Use the Back button in the header — it checks you out of the room.</p>
    </template>
  </div>
</template>
