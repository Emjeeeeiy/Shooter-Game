import { reactive, watch } from 'vue';

const STORAGE_KEY = 'neonStrike_settings_v1';

const defaults = {
  volume: 0.7,
  muted: false,
  music: true,
  shake: true,
  showFps: false,
  theme: 'dark',
};

function read() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...defaults };
    const parsed = JSON.parse(raw);
    return { ...defaults, ...parsed };
  } catch {
    return { ...defaults };
  }
}

const state = reactive(read());
// Normalize stored value (old installs / typos fall back to dark).
if (state.theme !== 'light' && state.theme !== 'dark') state.theme = 'dark';

function applyTheme() {
  if (typeof document === 'undefined') return;
  document.documentElement.classList.toggle('light', state.theme === 'light');
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', state.theme === 'light' ? '#eef1f6' : '#08080c');
}

watch(
  () => state.theme,
  applyTheme,
  { immediate: true },
);

watch(
  state,
  (v) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(v));
    } catch {
      // ignore (private mode)
    }
  },
  { deep: true },
);

export function useSettings() {
  function toggleMute() {
    state.muted = !state.muted;
  }
  function toggleMusic() {
    state.music = !state.music;
  }
  function setVolume(v) {
    state.volume = Math.max(0, Math.min(1, Number(v) || 0));
    if (state.volume > 0) state.muted = false;
  }
  function toggleShake() {
    state.shake = !state.shake;
  }
  function toggleFps() {
    state.showFps = !state.showFps;
  }
  function setTheme(v) {
    state.theme = v === 'light' ? 'light' : 'dark';
  }
  return { settings: state, toggleMute, toggleMusic, setVolume, toggleShake, toggleFps, setTheme };
}
