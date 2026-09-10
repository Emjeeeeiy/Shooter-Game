import { reactive, watch } from 'vue';

const STORAGE_KEY = 'neonStrike_settings_v1';

const defaults = {
  volume: 0.7,
  muted: false,
  music: true,
  shake: true,
  showFps: false,
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
  return { settings: state, toggleMute, toggleMusic, setVolume, toggleShake, toggleFps };
}
