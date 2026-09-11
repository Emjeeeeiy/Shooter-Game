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
    <!-- Logo / branding -->
    <div class="mb-2 flex items-center justify-center">
      <div
        class="flex h-12 w-12 items-center justify-center rounded-2xl"
        style="background: rgba(56,189,248,0.12); border: 1px solid rgba(56,189,248,0.25); box-shadow: 0 0 30px rgba(56,189,248,0.15);"
      >
        <span class="h-3 w-3 rounded-full bg-accent" style="box-shadow: 0 0 12px 3px rgba(56,189,248,0.7);" />
      </div>
    </div>
    <div class="label mt-1">Neon Strike</div>
    <h2 class="font-display mt-2 text-3xl font-bold text-zinc-50" style="letter-spacing: 0.08em;">PILOT ACCESS</h2>
    <p class="font-ui mt-2 text-center text-sm font-medium text-zinc-500">
      Log in to race friends and post global scores — or fly offline.
    </p>

    <!-- Card -->
    <div class="panel-elevated mt-7 w-full p-7">
      <!-- Mode tabs -->
      <div class="grid grid-cols-2 gap-1 rounded-xl p-1" style="background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.06);">
        <button
          type="button"
          class="rounded-lg px-3 py-2.5 text-sm font-semibold transition-all duration-200"
          :class="mode === 'login' ? 'bg-white/10 text-zinc-100 shadow-sm' : 'text-zinc-500 hover:text-zinc-300'"
          @click="mode = 'login'"
        >
          Log in
        </button>
        <button
          type="button"
          class="rounded-lg px-3 py-2.5 text-sm font-semibold transition-all duration-200"
          :class="mode === 'register' ? 'bg-white/10 text-zinc-100 shadow-sm' : 'text-zinc-500 hover:text-zinc-300'"
          @click="mode = 'register'"
        >
          Register
        </button>
      </div>

      <form class="mt-5 space-y-4" @submit.prevent="submit">
        <div v-if="mode === 'register'">
          <label class="label mb-2 block" for="auth-pilot">Pilot Callsign</label>
          <input
            id="auth-pilot"
            v-model="pilot"
            type="text"
            maxlength="20"
            placeholder="e.g. Nova"
            class="input-field"
          />
        </div>
        <div>
          <label class="label mb-2 block" for="auth-email">Email Address</label>
          <input
            id="auth-email"
            v-model="email"
            type="email"
            autocomplete="email"
            placeholder="pilot@example.com"
            class="input-field"
          />
        </div>
        <div>
          <label class="label mb-2 block" for="auth-pass">Password</label>
          <div class="relative">
            <input
              id="auth-pass"
              v-model="password"
              :type="showPass ? 'text' : 'password'"
              :autocomplete="mode === 'register' ? 'new-password' : 'current-password'"
              placeholder="••••••••"
              class="input-field pr-11"
            />
            <button
              type="button"
              class="absolute top-1/2 right-3 -translate-y-1/2 rounded-lg p-1 text-zinc-500 transition-colors hover:text-zinc-300"
              :aria-label="showPass ? 'Hide password' : 'Show password'"
              @click="showPass = !showPass"
            >
              <svg v-if="showPass" class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" /><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" /><path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" /><line x1="1" y1="1" x2="23" y2="23" />
              </svg>
              <svg v-else class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
              </svg>
            </button>
          </div>
        </div>

        <p v-if="error" class="rounded-xl border border-danger/30 bg-danger/10 px-3.5 py-2.5 text-[12px] text-danger">
          {{ error }}
        </p>

        <button
          type="submit"
          :disabled="busy"
          class="btn-primary font-ui w-full py-3 text-sm font-bold tracking-widest"
        >
          <svg v-if="busy" class="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
          {{ busy ? 'Working…' : mode === 'register' ? 'Create account' : 'Log in' }}
        </button>
      </form>

      <div class="mt-3 flex flex-col gap-2">
        <button
          type="button"
          class="btn-ghost w-full py-3 text-sm"
          @click="offline"
        >
          <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 12h.01"/><path d="M17 5H7a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2z"/></svg>
          Continue offline
        </button>
        <p class="text-center text-[11px] text-zinc-700">Single player + local scores only.</p>
      </div>
    </div>
  </div>
</template>
