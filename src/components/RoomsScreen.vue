<script setup>
// Template: ─── Gate: host or join ────────────────────────────────────────────
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { CHARACTERS, CHARACTER_LIST, MAP_PICKS } from '../game/constants.js';
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
import ShipPreview from './ShipPreview.vue';
import UiIcon from './UiIcon.vue';
import Avatar from './ui/Avatar.vue';
import InlineNotice from './ui/InlineNotice.vue';
import PilotRow from './ui/PilotRow.vue';
import ScreenFrame from './ui/ScreenFrame.vue';
import SegTabs from './ui/SegTabs.vue';
import { useViewport } from '../composables/useViewport.js';

const props = defineProps({
  uid: { type: String, required: true },
  pilotName: { type: String, default: 'Pilot' },
  photo: { type: String, default: '' },
  initialShip: { type: String, default: 'vanguard' },
  rejoinCode: { type: String, default: '' },
});

const emit = defineEmits(['deploy', 'back']);

const code = ref('');
const joinInput = ref('');
// Start from the solo hangar pick; the room doc wins once joined.
const ship = ref(CHARACTERS[props.initialShip]?.id ?? 'vanguard');
const busy = ref(false);
const error = ref('');
const deployed = ref(false);

const { room, missing } = useRoom(code);
const vp = useViewport();

// Phones show one section at a time; roomy shows squad + a tabbed side panel.
const tab = ref('squad'); // 'squad' | 'loadout' | 'invite'
const sideTab = ref('loadout'); // 'loadout' | 'invite'
const paneTab = computed(() => (vp.compact ? tab.value : sideTab.value));
const copied = ref(false);
const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

const MODE_TABS = [
  { value: 'arcade', label: 'Arcade', icon: 'users' },
  { value: 'versus', label: 'Versus', icon: 'swords' },
];

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
  // Friends already appear in the "Friends — invite" list above; skip them here.
  return presence.online.value.filter(
    (p) => p.uid !== props.uid && !memberIds.has(p.uid) && !friendUids.value.has(p.uid),
  );
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
const status = computed(() => room.value?.status ?? 'lobby');
const modeLabel = computed(() => (room.value?.mode === 'versus' ? 'Versus Duel' : 'Arcade Co-op'));
const statusText = computed(() => {
  if (!room.value) return 'Connecting to room…';
  if (status.value === 'done') return 'Match over — final standings.';
  if (status.value === 'playing') return allDone.value ? 'Everyone finished.' : 'Match in progress.';
  return isHost.value ? 'You are the host. Start when the squad is ready.' : 'Waiting for the host to start.';
});
const compactTabs = computed(() => [
  { value: 'squad', label: status.value === 'lobby' ? `Squad (${members.value.length})` : 'Standings' },
  { value: 'loadout', label: 'Loadout' },
  { value: 'invite', label: 'Invite' },
]);
const sideTabs = [
  { value: 'loadout', label: 'Loadout' },
  { value: 'invite', label: 'Invite' },
];
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

let copiedTimer = 0;
async function copyCode() {
  try {
    await navigator.clipboard.writeText(code.value);
    copied.value = true;
    clearTimeout(copiedTimer);
    copiedTimer = setTimeout(() => (copied.value = false), 1500);
  } catch {
    // clipboard unavailable
  }
}

async function shareCode() {
  try {
    await navigator.share({ title: 'Neon Strike room', text: `Join my Neon Strike room: ${code.value}` });
  } catch {
    // dismissed / unsupported
  }
}
</script>

<template>
  <ScreenFrame
    v-if="!code"
    eyebrow="Multiplayer"
    title="Squad up"
    subtitle="One shared swarm, same waves, live rival ships — highest score wins."
    back
    width="max-w-xl"
    @back="goBack"
  >
    <div class="scroll-area min-h-0 flex-1">
      <div class="flex min-h-full flex-col justify-center gap-3 py-2">
        <div class="panel space-y-4 p-4 roomy:p-6">
          <div class="label">Host a room</div>
          <div class="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              :disabled="busy"
              class="group flex min-w-0 flex-col items-start gap-2 rounded-xl border border-accent/25 bg-accent/7 p-3 text-left transition-all hover:border-accent/50 active:scale-[0.98] disabled:opacity-60"
              @click="onCreate('arcade')"
            >
              <span class="flex h-9 w-9 items-center justify-center rounded-lg bg-accent/15 text-accent">
                <UiIcon :name="busy ? 'spinner' : 'users'" cls="h-4 w-4" />
              </span>
              <span class="font-ui text-[15px] font-bold text-zinc-100">Arcade Co-op</span>
              <span class="line-clamp-2 text-xs leading-snug text-zinc-500">Shared battlefield. Squad total wins.</span>
            </button>
            <button
              type="button"
              :disabled="busy"
              class="group flex min-w-0 flex-col items-start gap-2 rounded-xl border border-missile/25 bg-missile/7 p-3 text-left transition-all hover:border-missile/50 active:scale-[0.98] disabled:opacity-60"
              @click="onCreate('versus')"
            >
              <span class="flex h-9 w-9 items-center justify-center rounded-lg bg-missile/15 text-missile">
                <UiIcon :name="busy ? 'spinner' : 'swords'" cls="h-4 w-4" />
              </span>
              <span class="font-ui text-[15px] font-bold text-zinc-100">Versus Duel</span>
              <span class="line-clamp-2 text-xs leading-snug text-zinc-500">Same arena. Every 5 kills sends chargers.</span>
            </button>
          </div>

          <div class="flex items-center gap-3 text-xs text-zinc-500">
            <span class="h-px flex-1 bg-white/10" />or join with a code<span class="h-px flex-1 bg-white/10" />
          </div>

          <form class="flex gap-2" @submit.prevent="onJoin">
            <label class="sr-only" for="room-code">Room code</label>
            <input
              id="room-code"
              v-model="joinInput"
              type="text"
              maxlength="6"
              placeholder="ABC123"
              autocomplete="off"
              autocapitalize="characters"
              autocorrect="off"
              spellcheck="false"
              enterkeyhint="go"
              class="input-field font-display flex-1 text-center tracking-[0.3em] uppercase"
            />
            <button type="submit" :disabled="busy || !joinInput.trim()" class="btn-ghost px-5">Join</button>
          </form>

          <InlineNotice v-if="error" tone="danger">{{ error }}</InlineNotice>
        </div>
        <p class="text-center text-xs text-zinc-500 short:hidden">
          Anyone with the code can join. Invite friends from inside the room.
        </p>
      </div>
    </div>
  </ScreenFrame>

  <!-- ─── Inside a room ────────────────────────────────────────────────── -->
  <ScreenFrame
    v-else
    :eyebrow="`Room · ${modeLabel}`"
    :title="code"
    back
    back-label="Leave"
    width="max-w-6xl"
    @back="goBack"
  >
    <template #header>
      <button type="button" class="btn-ghost btn-sm" :aria-label="copied ? 'Room code copied' : 'Copy room code'" @click="copyCode">
        <UiIcon :name="copied ? 'check' : 'copy'" cls="h-4 w-4" />
        <span class="hidden sm:inline">{{ copied ? 'Copied' : 'Copy' }}</span>
      </button>
      <button v-if="canShare" type="button" class="btn-icon" aria-label="Share room code" @click="shareCode">
        <UiIcon name="share" cls="h-4 w-4" />
      </button>
    </template>

    <!-- Status strip -->
    <div class="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-2 pb-3 short:pb-2">
      <SegTabs
        v-if="isHost && status === 'lobby'"
        :model-value="room?.mode === 'versus' ? 'versus' : 'arcade'"
        :options="MODE_TABS"
        label="Room mode"
        size="sm"
        class="w-60"
        @update:model-value="(m) => setRoomMode(code, m)"
      />
      <span
        v-else
        class="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold"
        :class="room?.mode === 'versus' ? 'bg-missile/12 text-missile' : 'bg-accent/12 text-accent'"
      >
        <UiIcon :name="room?.mode === 'versus' ? 'swords' : 'users'" cls="h-3.5 w-3.5" />{{ modeLabel }}
      </span>
      <p class="min-w-0 flex-1 text-[13px] leading-snug text-zinc-500">{{ statusText }}</p>
    </div>

    <InlineNotice v-if="error" tone="danger" class="mb-3 shrink-0">{{ error }}</InlineNotice>

    <!-- Phone: one section at a time -->
    <SegTabs v-if="vp.compact" v-model="tab" :options="compactTabs" label="Room sections" class="mb-3 shrink-0 short:mb-2" />

    <div
      class="grid min-h-0 flex-1 gap-4 roomy:grid-rows-[minmax(0,1fr)_minmax(0,1fr)] roomy:lg:grid-cols-[minmax(0,1fr)_minmax(20rem,26rem)] roomy:lg:grid-rows-1"
    >
      <!-- Squad: members + live / final standings -->
      <section v-if="!vp.compact || tab === 'squad'" class="panel flex min-h-0 flex-col overflow-hidden">
        <div class="flex shrink-0 items-center justify-between gap-2 px-4 pt-3">
          <div class="label">{{ status === 'lobby' ? `Pilots (${members.length})` : status === 'done' ? 'Final standings' : 'Live standings' }}</div>
          <div
            v-if="status !== 'lobby' && room?.mode !== 'versus'"
            class="rounded-lg bg-accent/10 px-2 py-0.5 text-xs font-semibold text-accent tabular-nums"
          >
            Squad {{ squadTotal.toLocaleString() }}
          </div>
        </div>

        <div class="scroll-area flex-1 space-y-1.5 p-3">
          <!-- Lobby: who's here + ready state + friend actions -->
          <template v-if="status === 'lobby'">
            <PilotRow
              v-for="m in members"
              :key="m.id"
              :name="m.name"
              :photo="m.photo"
              :you="m.id === uid"
              size="sm"
            >
              <template #badges>
                <span v-if="m.id === room?.host" class="shrink-0 rounded bg-skill/15 px-1.5 py-0.5 text-[10px] font-bold text-skill">HOST</span>
              </template>
              <template #sub>
                <span class="inline-flex items-center gap-1.5">
                  <span class="h-2 w-2 rounded-full" :style="{ background: shipDef(m.ship).color }" />{{ shipDef(m.ship).name }}
                </span>
              </template>
              <template #actions>
                <template v-if="m.id !== uid">
                  <span v-if="friendUids.has(m.id)" class="hidden rounded-full border border-skill/30 px-2 py-0.5 text-[10px] font-semibold text-skill sm:inline">FRIEND</span>
                  <button
                    v-else-if="incomingByUid.has(m.id)"
                    type="button"
                    class="btn-primary btn-sm"
                    @click="onAcceptFriend(incomingByUid.get(m.id))"
                  >
                    Accept
                  </button>
                  <span v-else-if="sentMap[m.id]" class="px-1 text-[11px] font-medium text-zinc-500">Sent</span>
                  <button
                    v-else
                    type="button"
                    :disabled="friendSending === m.id"
                    class="btn-ghost btn-sm px-2"
                    :aria-label="`Add ${m.name} as friend`"
                    @click="onAddFriend(m)"
                  >
                    <UiIcon :name="friendSending === m.id ? 'spinner' : 'user-plus'" cls="h-3.5 w-3.5" />
                  </button>
                </template>
                <span
                  class="rounded-full px-2 py-1 text-[10px] font-bold"
                  :class="m.ready ? 'bg-shock/15 text-shock' : 'bg-white/5 text-zinc-500'"
                >
                  {{ m.ready ? 'READY' : 'WAITING' }}
                </span>
              </template>
            </PilotRow>
          </template>

          <!-- Playing / done: standings -->
          <ol v-else class="space-y-1.5">
            <li
              v-for="(s, i) in standings"
              :key="s.id"
              class="flex items-center gap-2.5 rounded-xl border px-2.5 py-2 text-sm tabular-nums"
              :class="s.id === uid ? 'border-accent/25 bg-accent/5' : 'border-white/6 bg-white/3'"
            >
              <span class="w-5 text-center font-bold" :class="i === 0 ? 'text-skill' : 'text-zinc-500'">{{ i + 1 }}</span>
              <Avatar :photo="memberPhoto(s.id)" :name="s.name" size="xs" />
              <span class="flex min-w-0 flex-1 items-center gap-1 font-semibold" :class="s.id === uid ? 'text-accent' : 'text-zinc-200'">
                <span class="truncate">{{ s.name }}</span>
                <UiIcon v-if="s.done && status === 'playing'" name="check" cls="h-3.5 w-3.5 shrink-0 text-shock" />
              </span>
              <span class="font-bold text-zinc-100">{{ s.score.toLocaleString() }}</span>
              <span class="w-10 text-right text-xs text-zinc-500">W{{ s.wave }}</span>
            </li>
          </ol>

          <p v-if="status === 'playing'" class="pt-1 text-xs leading-snug text-zinc-500">
            {{
              room?.mode === 'versus'
                ? 'Every 5 kills sends chargers at your rivals. Highest score wins.'
                : 'Shared swarm — what you kill dies on every screen. Boss kills gift repairs to teammates.'
            }}
          </p>
          <p v-if="friendMsg" class="pt-1 text-[13px] text-zinc-400">{{ friendMsg }}</p>
        </div>
      </section>

      <!-- Loadout / invite -->
      <section v-if="!vp.compact || tab !== 'squad'" class="panel flex min-h-0 flex-col overflow-hidden">
        <SegTabs v-if="!vp.compact" v-model="sideTab" :options="sideTabs" label="Room options" size="sm" class="m-3 mb-0 shrink-0" />

        <div class="scroll-area flex-1 p-3">
          <!-- Loadout -->
          <div v-if="paneTab === 'loadout'" class="grid gap-4 short:grid-cols-2">
            <div class="min-w-0">
              <div class="label mb-2">Your ship</div>
              <div class="grid grid-cols-5 gap-1.5" role="radiogroup" aria-label="Your ship">
                <button
                  v-for="c in CHARACTER_LIST"
                  :key="c.id"
                  type="button"
                  role="radio"
                  :aria-checked="ship === c.id"
                  :aria-label="c.name"
                  :title="c.title"
                  class="flex min-w-0 flex-col items-center gap-1 rounded-xl border px-1 py-1.5 text-center transition-all"
                  :class="ship === c.id ? 'border-accent bg-accent/10' : 'border-white/10 hover:border-white/25'"
                  @click="ship = c.id"
                >
                  <ShipPreview :id="c.id" :color="c.color" cls="w-full max-w-12" />
                  <span class="w-full truncate text-[10px] font-semibold" :class="ship === c.id ? 'text-zinc-100' : 'text-zinc-500'">{{ c.name }}</span>
                </button>
              </div>
              <p class="mt-2 text-xs leading-snug text-zinc-500">
                <span class="font-semibold text-zinc-300">{{ shipDef(ship).title }}</span> — {{ shipDef(ship).desc }}
              </p>
            </div>

            <div class="min-w-0">
              <div class="label mb-2">Arena map</div>
              <div v-if="isHost && status === 'lobby'" class="space-y-1.5" role="radiogroup" aria-label="Arena map">
                <button
                  v-for="mp in MAP_PICKS"
                  :key="mp.id"
                  type="button"
                  role="radio"
                  :aria-checked="(room?.mapPick ?? 'grid') === mp.id"
                  class="flex w-full items-center gap-3 rounded-xl border p-1.5 text-left transition-all"
                  :class="(room?.mapPick ?? 'grid') === mp.id ? 'border-accent bg-accent/10' : 'border-white/10 hover:border-white/25'"
                  @click="setRoomMap(code, mp.id)"
                >
                  <div class="w-16 shrink-0"><MapPreview :map-id="mp.id" /></div>
                  <div class="min-w-0">
                    <div class="truncate text-[13px] font-semibold text-zinc-100">{{ mp.name }}</div>
                    <div class="line-clamp-1 text-xs text-zinc-500">{{ mp.desc }}</div>
                  </div>
                </button>
              </div>
              <div v-else class="flex items-center gap-3">
                <div class="w-28 shrink-0"><MapPreview :map-id="shownMap.id" /></div>
                <p class="min-w-0 text-[13px] text-zinc-300">
                  {{ shownMap.name }}<span class="block text-xs text-zinc-500">{{ shownMap.desc }}</span>
                  <span v-if="!isHost" class="mt-1 block text-xs text-zinc-500">The host picks the arena.</span>
                </p>
              </div>
            </div>
          </div>

          <!-- Invite -->
          <div v-else class="space-y-4">
            <div>
              <div class="label mb-2">Friends</div>
              <p v-if="!friendsNotInRoom.length" class="text-[13px] text-zinc-500">
                No friends outside this room. Add pilots from the squad list or the Friends page.
              </p>
              <div v-else class="space-y-1.5">
                <PilotRow
                  v-for="f in friendsNotInRoom"
                  :key="f.uid"
                  :name="f.name"
                  :photo="f.photo"
                  :online="onlineIds.has(f.uid)"
                  :sub="onlineIds.has(f.uid) ? 'Online' : 'Offline'"
                  size="sm"
                >
                  <template #actions>
                    <button v-if="!sentIds.has(f.uid)" type="button" class="btn-ghost btn-sm border-accent/40 text-accent" @click="invite(f)">
                      Invite
                    </button>
                    <span v-else class="inline-flex items-center gap-1 px-1 text-xs font-semibold text-shock">
                      Invited <UiIcon name="check" cls="h-3.5 w-3.5" />
                    </span>
                  </template>
                </PilotRow>
              </div>
            </div>
            <div>
              <div class="label mb-2">Online pilots</div>
              <p v-if="!othersOnline.length" class="text-[13px] text-zinc-500">Nobody else online right now.</p>
              <div v-else class="space-y-1.5">
                <PilotRow v-for="p in othersOnline" :key="p.uid" :name="p.name" :online="true" size="sm">
                  <template #actions>
                    <button v-if="!sentIds.has(p.uid)" type="button" class="btn-ghost btn-sm border-accent/40 text-accent" @click="invite(p)">
                      Invite
                    </button>
                    <span v-else class="inline-flex items-center gap-1 px-1 text-xs font-semibold text-shock">
                      Invited <UiIcon name="check" cls="h-3.5 w-3.5" />
                    </span>
                  </template>
                </PilotRow>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>

    <!-- ─── Pinned, state-based actions ─────────────────────────────────── -->
    <template #actions>
      <template v-if="status === 'lobby'">
        <button type="button" class="btn-ghost flex-1 roomy:flex-none roomy:min-w-40" :class="me?.ready ? 'border-shock/40 text-shock' : ''" @click="onReady">
          <UiIcon v-if="me?.ready" name="check" cls="h-4 w-4" />
          {{ me?.ready ? 'Ready' : 'Ready up' }}
        </button>
        <button
          v-if="isHost"
          type="button"
          :disabled="members.length < 1"
          class="btn-primary font-ui flex-1 font-bold tracking-wider roomy:ml-auto roomy:flex-none roomy:min-w-56"
          @click="onStart"
        >
          <UiIcon name="rocket" cls="h-4 w-4" /> Start match
        </button>
        <p v-else class="flex-1 text-right text-xs text-zinc-500">Host starts the match</p>
      </template>

      <template v-else-if="status === 'playing'">
        <button v-if="allDone" type="button" class="btn flex-1 bg-skill text-ink hover:brightness-110 roomy:flex-none" @click="showResults(code)">
          <UiIcon name="trophy" cls="h-4 w-4" /> Show results
        </button>
        <button
          type="button"
          class="btn-primary font-ui flex-1 font-bold tracking-wider roomy:ml-auto roomy:flex-none roomy:min-w-56"
          @click="deployed = true; $emit('deploy', code)"
        >
          Back to run <UiIcon name="chevron-right" cls="h-4 w-4" />
        </button>
      </template>

      <template v-else-if="status === 'done'">
        <template v-if="isHost">
          <button type="button" class="btn-ghost flex-1 roomy:flex-none roomy:min-w-40" @click="backToRoomLobby(code)">To room lobby</button>
          <button type="button" class="btn-primary font-ui flex-1 font-bold tracking-wider roomy:ml-auto roomy:flex-none roomy:min-w-56" @click="onStart">
            <UiIcon name="refresh" cls="h-4 w-4" /> Rematch
          </button>
        </template>
        <p v-else class="flex-1 text-center text-[13px] text-zinc-500">Waiting for the host — rematch or back to the lobby.</p>
      </template>
    </template>
  </ScreenFrame>
</template>
