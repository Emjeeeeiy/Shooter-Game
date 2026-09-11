import { onBeforeUnmount, onMounted, reactive, ref, shallowRef } from 'vue';
import { Game, createHudState } from '../game/engine.js';
import { draw, drawMinimap } from '../game/renderer.js';
import { sfx } from '../game/audio.js';
import { MINIMAP_SIZE, VIEW_HEIGHT, VIEW_WIDTH, WORLD_HEIGHT, WORLD_WIDTH } from '../game/constants.js';

const STEP_MS = 1000 / 60;
const MAX_STEPS = 5;
// Camera zoom: below 1.0 shows more of the map (zoomed out).
const ZOOM = 0.75;

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

  // Logical viewport in world units. Zoom stays 1:1 — bigger screens simply
  // see more of the world, so the ship and enemies never shrink.
  const view = reactive({ w: VIEW_WIDTH, h: VIEW_HEIGHT });

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
  let ro = null;
  let lastPaintKey = '';

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
   * Backing store matches the displayed CSS size (times DPR) while drawing
   * stays in logical view units — crisp at any window or fullscreen size.
   */
  function scaleCanvas() {
    const canvas = canvasRef.value;
    const minimap = minimapRef.value;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    if (canvas) {
      const rect = canvas.getBoundingClientRect();
      const cssW = Math.max(1, Math.round(rect.width));
      const cssH = Math.max(1, Math.round(rect.height));
      canvas.width = Math.round(cssW * dpr);
      canvas.height = Math.round(cssH * dpr);
      ctx = canvas.getContext('2d');
      ctx.setTransform(canvas.width / view.w, 0, 0, canvas.height / view.h, 0, 0);
    }
    if (minimap) {
      minimap.width = MINIMAP_SIZE * dpr;
      minimap.height = MINIMAP_SIZE * dpr;
      minimapCtx = minimap.getContext('2d');
      minimapCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    // Resizing clears the backing store — force one repaint even if frozen.
    lastPaintKey = '';
  }

  /**
   * Fit the logical viewport to the stage box at fixed zoom. The camera sees
   * fewer world units than the baseline, so everything renders bigger;
   * larger screens simply reveal a bit more around the edges.
   */
  function fitView() {
    const canvas = canvasRef.value;
    if (!canvas) return;
    const wrap = canvas.parentElement;
    if (!wrap) return;
    const rect = wrap.getBoundingClientRect();
    if (!rect.width || !rect.height) return;

    const aspect = rect.width / rect.height;
    const baseAspect = VIEW_WIDTH / VIEW_HEIGHT;
    let w;
    let h;
    if (aspect >= baseAspect) {
      h = VIEW_HEIGHT;
      w = Math.min(WORLD_WIDTH, Math.round(VIEW_HEIGHT * aspect));
    } else {
      w = VIEW_WIDTH;
      h = Math.min(WORLD_HEIGHT, Math.round(VIEW_WIDTH / aspect));
    }
    w = Math.max(600, Math.min(WORLD_WIDTH, Math.round(w / ZOOM)));
    h = Math.max(400, Math.min(WORLD_HEIGHT, Math.round(h / ZOOM)));

    if (Math.abs(w - view.w) > 1 || Math.abs(h - view.h) > 1) {
      view.w = w;
      view.h = h;
      game.value?.setView(w, h);
    }
    scaleCanvas();
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

    const g = game.value;
    if (!g) return;

    // Whole game map (canvas) follows the UI theme, live.
    g.lightMode = settings.theme === 'light';

    // Fixed 60Hz steps so the simulation runs at the same speed on any display.
    // When paused, drain the accumulator so resume doesn't jump.
    if (g.paused) {
      accumulator = 0;
    } else {
      const steps = Math.min(MAX_STEPS, Math.floor(accumulator / STEP_MS));
      for (let i = 0; i < steps; i += 1) g.update();
      accumulator -= steps * STEP_MS;
      if (accumulator > STEP_MS * MAX_STEPS) accumulator = 0;
    }

    // Paint every frame while simulating. Under overlays (pause / game over)
    // the scene is frozen, so paint once per state instead of forcing a full
    // backdrop-blur repaint at 60fps.
    if (g.running && !g.paused) {
      lastPaintKey = 'live';
      if (ctx) draw(ctx, g);
      if (minimapCtx) drawMinimap(minimapCtx, g);
    } else {
      const key = `still-${g.tick}-${g.hud.gameOver}`;
      if (key !== lastPaintKey) {
        lastPaintKey = key;
        if (ctx) draw(ctx, g);
        if (minimapCtx) drawMinimap(minimapCtx, g);
      }
    }
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
      (event.clientX - rect.left) * (view.w / rect.width),
      (event.clientY - rect.top) * (view.h / rect.height),
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
      (x - rect.left) * (view.w / rect.width),
      (y - rect.top) * (view.h / rect.height),
    );
  }

  function setTouchAimVector(dx, dy) {
    game.value?.setAimVector(dx, dy);
  }

  // --- public actions -------------------------------------------------------

  const start = (characterId, seed, mapId, opts) => {
    sfx.unlock();
    applyAudioSettings();
    sfx.play('click');
    game.value?.start(characterId, seed, mapId, opts);
  };
  const setCharacter = (id) => game.value?.setCharacter(id);
  const setPilotName = (name) => game.value?.setPilotName(name);
  // Snapshot for the throttled multiplayer broadcast (same arena, live ghosts).
  const getSelf = () => {
    const g = game.value;
    if (!g?.player) return {};
    return {
      x: g.player.x,
      y: g.player.y,
      a: g.player.angle,
      ship: g.characterId ?? 'vanguard',
    };
  };
  const setRivals = (list) => game.value?.setRivals(list);
  // Latest skill/ultimate marker {k, a, s} for the multiplayer echo.
  const getFx = () => game.value?.fx ?? null;
  // Shared-swarm kill outbox / remote apply (arcade rooms).
  const drainKills = () => (game.value ? game.value.drainKills() : []);
  const applyRemoteKill = (eid) => game.value?.applyRemoteKill(eid);
  const stop = () => game.value?.stop();
  const togglePause = () => game.value?.togglePause();
  const doDash = () => {
    sfx.unlock();
    game.value?.dash();
  };
  const doMissiles = () => game.value?.fireMissiles();
  const doShock = () => game.value?.shockWave();
  const setFire = (held) => game.value?.setFireHeld(held);
  const doInject = (type, count) => game.value?.injectEnemies(type, count);
  const doGift = () => game.value?.giftDrop();

  onMounted(() => {
    game.value = new Game(hud, emit);
    applyAudioSettings();
    fitView();

    if (typeof ResizeObserver !== 'undefined' && canvasRef.value?.parentElement) {
      ro = new ResizeObserver(() => fitView());
      ro.observe(canvasRef.value.parentElement);
    }

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    window.addEventListener('mouseup', releaseFire);
    window.addEventListener('resize', fitView);
    document.addEventListener('fullscreenchange', fitView);
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
    window.removeEventListener('resize', fitView);
    document.removeEventListener('fullscreenchange', fitView);
    document.removeEventListener('visibilitychange', onVisibility);
    if (ro) ro.disconnect();
  });

  return {
    hud,
    banner,
    notice,
    shake,
    fps,
    view,
    canvasRef,
    minimapRef,
    start,
    stop,
    togglePause,
    setCharacter,
    setPilotName,
    getSelf,
    setRivals,
    getFx,
    drainKills,
    applyRemoteKill,
    doDash,
    doMissiles,
    doShock,
    setFire,
    doInject,
    doGift,
    setMinimapEl,
    onPointerMove,
    onPointerDown,
    setTouchMove,
    setTouchAim,
  };
}
