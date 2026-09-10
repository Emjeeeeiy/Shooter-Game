import { onBeforeUnmount, onMounted, reactive, ref, shallowRef } from 'vue';
import { Game, createHudState } from '../game/engine.js';
import { draw, drawMinimap } from '../game/renderer.js';
import { sfx } from '../game/audio.js';
import { MINIMAP_SIZE, VIEW_HEIGHT, VIEW_WIDTH } from '../game/constants.js';

const STEP_MS = 1000 / 60;
const MAX_STEPS = 5;

/**
 * Owns the engine, the single animation frame loop, and input wiring.
 * Vue reads `hud` / `banner` / `notice`; the engine never reads them back.
 */
export function useGame(settings) {
  const hud = reactive(createHudState());
  const banner = ref(null);
  const notice = ref(null);
  const shake = ref(null); // null | small | medium | big
  const fps = ref(0);

  const canvasRef = ref(null);
  const minimapRef = ref(null);
  const game = shallowRef(null);

  let ctx = null;
  let minimapCtx = null;
  let frame = 0;
  let accumulator = 0;
  let previous = 0;
  let bannerTimer = 0;
  let noticeTimer = 0;
  let shakeTimer = 0;
  let sequence = 0;
  let fpsFrames = 0;
  let fpsLast = 0;

  function applyAudioSettings() {
    if (!settings) return;
    sfx.setMuted(settings.value?.muted ?? settings.muted);
    sfx.setVolume(settings.value?.volume ?? settings.volume ?? 0.7);
  }

  function emit(type, payload) {
    if (type === 'banner') {
      sequence += 1;
      banner.value = { ...payload, id: sequence };
      clearTimeout(bannerTimer);
      bannerTimer = setTimeout(() => (banner.value = null), 1800);
    } else if (type === 'notice') {
      sequence += 1;
      notice.value = { ...payload, id: sequence };
      clearTimeout(noticeTimer);
      noticeTimer = setTimeout(() => (notice.value = null), 2200);
    } else if (type === 'shake') {
      if (settings && (settings.value?.shake ?? settings.shake) === false) return;
      const magnitude = payload?.magnitude ?? 'medium';
      shake.value = magnitude;
      clearTimeout(shakeTimer);
      shakeTimer = setTimeout(() => (shake.value = null), magnitude === 'big' ? 500 : 420);
    } else if (type === 'sfx') {
      sfx.play(payload?.name);
    }
  }

  /**
   * Size the backing store to the device pixel ratio while keeping the drawing
   * code in logical 1200x700 space.
   */
  function scaleCanvas() {
    const canvas = canvasRef.value;
    const minimap = minimapRef.value;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    if (canvas) {
      canvas.width = VIEW_WIDTH * dpr;
      canvas.height = VIEW_HEIGHT * dpr;
      ctx = canvas.getContext('2d');
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    if (minimap) {
      minimap.width = MINIMAP_SIZE * dpr;
      minimap.height = MINIMAP_SIZE * dpr;
      minimapCtx = minimap.getContext('2d');
      minimapCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
  }

  function setMinimapEl(el) {
    minimapRef.value = el;
    scaleCanvas();
  }

  function loop(now) {
    frame = requestAnimationFrame(loop);

    // FPS meter
    fpsFrames += 1;
    if (now - fpsLast >= 500) {
      fps.value = Math.round((fpsFrames * 1000) / Math.max(1, now - fpsLast));
      fpsFrames = 0;
      fpsLast = now;
    }

    accumulator += now - previous;
    previous = now;

    // Fixed 60Hz steps so the simulation runs at the same speed on any display.
    // When paused, drain the accumulator so resume doesn't jump.
    if (game.value?.paused) {
      accumulator = 0;
    } else {
      const steps = Math.min(MAX_STEPS, Math.floor(accumulator / STEP_MS));
      for (let i = 0; i < steps; i += 1) game.value.update();
      accumulator -= steps * STEP_MS;
      if (accumulator > STEP_MS * MAX_STEPS) accumulator = 0;
    }

    if (ctx) draw(ctx, game.value);
    if (minimapCtx) drawMinimap(minimapCtx, game.value);
  }

  // --- input ----------------------------------------------------------------

  function onKeyDown(event) {
    const g = game.value;
    if (!g) return;

    // Ignore game keys while typing a pilot name.
    if (event.target instanceof HTMLInputElement) return;
    if (event.repeat) {
      if (event.code === 'Space') event.preventDefault();
      return;
    }

    sfx.unlock();

    if (event.code === 'KeyM') {
      emit('sfx', { name: 'click' });
      // handled by App-level settings toggle via exposed toggleMute
      window.dispatchEvent(new CustomEvent('neon:toggle-mute'));
      return;
    }
    if (event.code === 'KeyP' || event.code === 'Escape') {
      if (g.running && !g.hud.gameOver) g.togglePause();
      return;
    }

    g.setKey(event.code, true);

    if (event.code === 'Space') {
      event.preventDefault();
      if (g.running && !g.paused) g.setFireHeld(true);
    } else if (event.code === 'KeyC') g.fireMissiles();
    else if (event.code === 'KeyE') g.shockWave();
    else if (event.code === 'ShiftLeft' || event.code === 'ShiftRight') g.dash();
  }

  function onKeyUp(event) {
    const g = game.value;
    if (!g) return;

    g.setKey(event.code, false);
    if (event.code === 'Space') g.setFireHeld(false);
  }

  /** Convert a pointer event to logical canvas coordinates (CSS-scaled canvas). */
  function onPointerMove(event) {
    const canvas = canvasRef.value;
    if (!canvas || !game.value) return;

    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;

    game.value.setPointer(
      (event.clientX - rect.left) * (VIEW_WIDTH / rect.width),
      (event.clientY - rect.top) * (VIEW_HEIGHT / rect.height),
    );
  }

  function onPointerDown(event) {
    sfx.unlock();
    if (event.button !== 0) return;
    onPointerMove(event);
    game.value?.setFireHeld(true);
  }

  function releaseFire() {
    game.value?.setFireHeld(false);
  }

  function onBlur() {
    game.value?.clearKeys();
    // Auto-pause when the window loses focus mid-run.
    if (game.value?.running && !game.value.hud.gameOver) game.value.pause();
  }

  function onVisibility() {
    if (document.hidden) onBlur();
  }

  // Touch controls -----------------------------------------------------------
  function setTouchMove(x, y) {
    game.value?.setMoveVector(x, y);
  }
  function setTouchAim(x, y) {
    const canvas = canvasRef.value;
    if (!canvas || !game.value) return;
    const rect = canvas.getBoundingClientRect();
    game.value.setPointer(
      (x - rect.left) * (VIEW_WIDTH / rect.width),
      (y - rect.top) * (VIEW_HEIGHT / rect.height),
    );
  }

  // --- public actions -------------------------------------------------------

  const start = () => {
    sfx.unlock();
    applyAudioSettings();
    sfx.play('click');
    game.value?.start();
  };
  const stop = () => game.value?.stop();
  const togglePause = () => game.value?.togglePause();
  const doDash = () => {
    sfx.unlock();
    game.value?.dash();
  };
  const doMissiles = () => game.value?.fireMissiles();
  const doShock = () => game.value?.shockWave();
  const setFire = (held) => game.value?.setFireHeld(held);

  onMounted(() => {
    game.value = new Game(hud, emit);
    applyAudioSettings();
    scaleCanvas();

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    window.addEventListener('mouseup', releaseFire);
    window.addEventListener('resize', scaleCanvas);
    document.addEventListener('visibilitychange', onVisibility);

    previous = performance.now();
    fpsLast = previous;
    frame = requestAnimationFrame(loop);
  });

  onBeforeUnmount(() => {
    cancelAnimationFrame(frame);
    clearTimeout(bannerTimer);
    clearTimeout(noticeTimer);
    clearTimeout(shakeTimer);

    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('keyup', onKeyUp);
    window.removeEventListener('blur', onBlur);
    window.removeEventListener('mouseup', releaseFire);
    window.removeEventListener('resize', scaleCanvas);
    document.removeEventListener('visibilitychange', onVisibility);
  });

  return {
    hud,
    banner,
    notice,
    shake,
    fps,
    canvasRef,
    minimapRef,
    start,
    stop,
    togglePause,
    doDash,
    doMissiles,
    doShock,
    setFire,
    setMinimapEl,
    onPointerMove,
    onPointerDown,
    setTouchMove,
    setTouchAim,
  };
}
