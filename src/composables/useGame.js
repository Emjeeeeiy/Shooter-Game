import { onBeforeUnmount, onMounted, reactive, ref, shallowRef } from 'vue';
import { Game, createHudState } from '../game/engine.js';
import { draw, drawMinimap } from '../game/renderer.js';
import { MINIMAP_SIZE, VIEW_HEIGHT, VIEW_WIDTH } from '../game/constants.js';

const STEP_MS = 1000 / 60;
const MAX_STEPS = 5;

/**
 * Owns the engine, the single animation frame loop, and input wiring.
 * Vue reads `hud` / `banner` / `notice`; the engine never reads them back.
 */
export function useGame() {
  const hud = reactive(createHudState());
  const banner = ref(null);
  const notice = ref(null);
  const shaking = ref(false);

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
      shaking.value = true;
      clearTimeout(shakeTimer);
      shakeTimer = setTimeout(() => (shaking.value = false), 420);
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

  function loop(now) {
    frame = requestAnimationFrame(loop);

    accumulator += now - previous;
    previous = now;

    // Fixed 60Hz steps so the simulation runs at the same speed on any display.
    const steps = Math.min(MAX_STEPS, Math.floor(accumulator / STEP_MS));
    for (let i = 0; i < steps; i += 1) game.value.update();
    accumulator -= steps * STEP_MS;
    if (accumulator > STEP_MS * MAX_STEPS) accumulator = 0;

    if (ctx) draw(ctx, game.value);
    if (minimapCtx) drawMinimap(minimapCtx, game.value);
  }

  // --- input ----------------------------------------------------------------

  function onKeyDown(event) {
    const g = game.value;
    if (!g) return;

    // Ignore game keys while typing a pilot name.
    if (event.target instanceof HTMLInputElement) return;

    if (event.repeat) return;

    g.setKey(event.code, true);

    if (event.code === 'KeyC') g.fireMissiles();
    else if (event.code === 'KeyE') g.shockWave();
    else if (event.code === 'ShiftLeft' || event.code === 'ShiftRight') g.dash();
  }

  function onKeyUp(event) {
    const g = game.value;
    if (!g) return;

    g.setKey(event.code, false);
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
    if (event.button !== 0) return;
    onPointerMove(event);
    game.value?.setFireHeld(true);
  }

  function releaseFire() {
    game.value?.setFireHeld(false);
  }

  function onBlur() {
    game.value?.clearKeys();
  }

  // --- public actions -------------------------------------------------------

  const start = () => game.value?.start();
  const stop = () => game.value?.stop();

  onMounted(() => {
    game.value = new Game(hud, emit);
    scaleCanvas();

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    window.addEventListener('mouseup', releaseFire);
    window.addEventListener('resize', scaleCanvas);

    previous = performance.now();
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
  });

  return {
    hud,
    banner,
    notice,
    shaking,
    canvasRef,
    minimapRef,
    start,
    stop,
    onPointerMove,
    onPointerDown,
  };
}
