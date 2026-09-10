<script setup>
import { ref } from 'vue';
import { useAuth } from '../composables/useAuth.js';

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
  <div class="flex w-full max-w-md flex-col items-center">
    <div class="label">Neon Strike</div>
    <h2 class="mt-1 text-3xl font-semibold text-zinc-50">Pilot access</h2>
    <p class="mt-2 text-center text-[13px] text-zinc-500">
      Log in to race friends and post global scores — or fly offline.
    </p>

    <div class="panel mt-6 w-full p-6 sm:p-7">
      <div class="grid grid-cols-2 gap-2 rounded-lg bg-white/5 p-1">
        <button
          type="button"
          class="rounded-md px-3 py-2 text-sm font-medium transition-colors"
          :class="mode === 'login' ? 'bg-white/10 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'"
          @click="mode = 'login'"
        >
          Log in
        </button>
        <button
          type="button"
          class="rounded-md px-3 py-2 text-sm font-medium transition-colors"
          :class="mode === 'register' ? 'bg-white/10 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'"
          @click="mode = 'register'"
        >
          Register
        </button>
      </div>

      <form class="mt-5 space-y-3" @submit.prevent="submit">
        <div v-if="mode === 'register'">
          <label class="label block" for="auth-pilot">Pilot callsign</label>
          <input
            id="auth-pilot"
            v-model="pilot"
            type="text"
            maxlength="20"
            placeholder="e.g. Nova"
            class="mt-1.5 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:border-accent/60 focus:outline-none"
          />
        </div>
        <div>
          <label class="label block" for="auth-email">Email</label>
          <input
            id="auth-email"
            v-model="email"
            type="email"
            autocomplete="email"
            placeholder="pilot@example.com"
            class="mt-1.5 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:border-accent/60 focus:outline-none"
          />
        </div>
        <div>
          <label class="label block" for="auth-pass">Password</label>
          <div class="relative mt-1.5">
            <input
              id="auth-pass"
              v-model="password"
              :type="showPass ? 'text' : 'password'"
              :autocomplete="mode === 'register' ? 'new-password' : 'current-password'"
              placeholder="••••••••"
              class="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 pr-11 text-sm text-zinc-100 placeholder-zinc-600 focus:border-accent/60 focus:outline-none"
            />
            <button
              type="button"
              class="absolute top-1/2 right-2 -translate-y-1/2 rounded-md p-1.5 text-zinc-500 transition-colors hover:text-zinc-200"
              :aria-label="showPass ? 'Hide password' : 'Show password'"
              :title="showPass ? 'Hide password' : 'Show password'"
              @click="showPass = !showPass"
            >
              <svg
                v-if="showPass"
                class="h-4 w-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                aria-hidden="true"
              >
                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
                <line x1="1" y1="1" x2="23" y2="23" />
              </svg>
              <svg
                v-else
                class="h-4 w-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                aria-hidden="true"
              >
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            </button>
          </div>
        </div>

        <p v-if="error" class="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-[12px] text-danger">
          {{ error }}
        </p>

        <button
          type="submit"
          :disabled="busy"
          class="w-full rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-surface transition-colors hover:bg-sky-300 disabled:opacity-60"
        >
          {{ busy ? 'Working…' : mode === 'register' ? 'Create account' : 'Log in' }}
        </button>
      </form>

      <button
        type="button"
        class="mt-3 w-full rounded-lg border border-white/12 px-4 py-2.5 text-sm font-medium text-zinc-400 transition-colors hover:border-white/25 hover:text-zinc-100"
        @click="offline"
      >
        Continue offline
      </button>
      <p class="mt-3 text-center text-[11px] text-zinc-600">
        Offline mode: single player + local scores only.
      </p>
    </div>
  </div>
</template>
