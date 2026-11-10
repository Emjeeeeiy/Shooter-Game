<script setup>
// Template: Scrolls internally only when the on-screen keyboard leaves too little room.
import { ref } from 'vue';
import { useAuth } from '../composables/useAuth.js';
import InlineNotice from './ui/InlineNotice.vue';
import SegTabs from './ui/SegTabs.vue';
import UiIcon from './UiIcon.vue';

const MODES = [
  { value: 'login', label: 'Log in' },
  { value: 'register', label: 'Register' },
];

const emit = defineEmits(['authed']);

const { register, login, continueOffline, friendlyError } = useAuth();

const mode = ref('login'); // 'login' | 'register'
const email = ref('');
const password = ref('');
const pilot = ref('');
const busy = ref(false);
const error = ref('');
const showPass = ref(false);

async function submit() {
  if (busy.value) return;
  error.value = '';
  if (!email.value || !password.value) {
    error.value = 'Enter an email and password.';
    return;
  }
  if (mode.value === 'register' && password.value.length < 6) {
    error.value = 'Password must be at least 6 characters.';
    return;
  }
  busy.value = true;
  try {
    if (mode.value === 'register') await register(email.value, password.value, pilot.value || 'Pilot');
    else await login(email.value, password.value);
    emit('authed');
  } catch (e) {
    error.value = friendlyError(e);
  } finally {
    busy.value = false;
  }
}

function offline() {
  continueOffline();
  emit('authed');
}
</script>

<template>
  <div class="scroll-area h-full">
    <div
      class="px-safe mx-auto flex min-h-full w-full max-w-4xl flex-col items-center justify-center gap-5 py-6 short:flex-row short:gap-10 short:py-3"
    >
      <!-- Brand -->
      <div class="flex flex-col items-center text-center short:flex-1 short:items-start short:text-left">
        <div
          class="flex h-12 w-12 items-center justify-center rounded-2xl border border-accent/25 bg-accent/12 shadow-[0_0_30px_var(--color-accent-glow)] short:h-10 short:w-10"
        >
          <span class="h-3 w-3 rounded-full bg-accent shadow-[0_0_12px_3px_var(--color-accent-glow)]" />
        </div>
        <div class="label mt-3">Neon Strike</div>
        <h2 class="font-display mt-1 text-2xl font-bold text-zinc-50 roomy:text-3xl" style="letter-spacing: 0.08em">
          PILOT ACCESS
        </h2>
        <p class="font-ui mt-1.5 max-w-xs text-sm font-medium text-zinc-500">
          Log in to race friends and post global scores — or fly offline.
        </p>
      </div>

      <!-- Card -->
      <div class="panel-elevated w-full max-w-md p-5 short:max-w-sm short:p-4 roomy:p-7">
        <SegTabs v-model="mode" :options="MODES" label="Account mode" />

        <form class="mt-4 space-y-3 short:mt-3 short:space-y-2" novalidate @submit.prevent="submit">
          <div v-if="mode === 'register'">
            <label class="label mb-1.5 block short:sr-only" for="auth-pilot">Pilot callsign</label>
            <input
              id="auth-pilot"
              v-model="pilot"
              type="text"
              maxlength="20"
              placeholder="Callsign, e.g. Nova"
              autocomplete="nickname"
              autocapitalize="words"
              enterkeyhint="next"
              class="input-field"
            />
          </div>
          <div>
            <label class="label mb-1.5 block short:sr-only" for="auth-email">Email address</label>
            <input
              id="auth-email"
              v-model="email"
              type="email"
              inputmode="email"
              autocomplete="email"
              autocapitalize="none"
              autocorrect="off"
              spellcheck="false"
              enterkeyhint="next"
              placeholder="pilot@example.com"
              class="input-field"
            />
          </div>
          <div>
            <label class="label mb-1.5 block short:sr-only" for="auth-pass">Password</label>
            <div class="relative">
              <input
                id="auth-pass"
                v-model="password"
                :type="showPass ? 'text' : 'password'"
                :autocomplete="mode === 'register' ? 'new-password' : 'current-password'"
                enterkeyhint="go"
                placeholder="Password"
                class="input-field pr-12"
              />
              <button
                type="button"
                class="absolute top-1/2 right-1 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-lg text-zinc-500 transition-colors hover:text-zinc-300"
                :aria-label="showPass ? 'Hide password' : 'Show password'"
                :aria-pressed="showPass"
                @click="showPass = !showPass"
              >
                <UiIcon :name="showPass ? 'eye-off' : 'eye'" cls="h-4 w-4" />
              </button>
            </div>
          </div>

          <InlineNotice v-if="error" tone="danger">{{ error }}</InlineNotice>

          <button type="submit" :disabled="busy" class="btn-primary font-ui w-full font-bold tracking-widest">
            <UiIcon v-if="busy" name="spinner" cls="h-4 w-4" />
            {{ busy ? 'Working…' : mode === 'register' ? 'Create account' : 'Log in' }}
          </button>
        </form>

        <div class="my-3 flex items-center gap-3 text-xs text-zinc-500 short:my-2">
          <span class="h-px flex-1 bg-white/10" />or<span class="h-px flex-1 bg-white/10" />
        </div>

        <button type="button" class="btn-ghost w-full" @click="offline">
          <UiIcon name="gamepad" cls="h-4 w-4" />
          Continue offline
        </button>
        <p class="mt-2 text-center text-xs text-zinc-500 short:hidden">Single player and local scores only.</p>
      </div>
    </div>
  </div>
</template>
