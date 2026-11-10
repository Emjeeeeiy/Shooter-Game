/**
 * Fullscreen + landscape helpers.
 *
 * Browsers only allow `requestFullscreen()` during a user gesture, so a page
 * can never go fullscreen on load by itself. The closest thing to "by default"
 * is `useAutoFullscreen`: the first tap anywhere enters fullscreen (and, on
 * Android, locks landscape — the lock only works while fullscreen). iPhone
 * Safari has no fullscreen API at all, so callers keep the rotate prompt as
 * the fallback there.
 */
import { ref } from 'vue';

export const canFullscreen = typeof document !== 'undefined' && !!document.fullscreenEnabled;

/** Reactive: true while the page is fullscreen. */
export const isFullscreen = ref(typeof document !== 'undefined' && !!document.fullscreenElement);

let suppressed = false; // the player left fullscreen on purpose — stop re-entering
let leaving = false; // we are the ones exiting (exitFullscreen)
let inFlight = false;

if (typeof document !== 'undefined') {
  document.addEventListener('fullscreenchange', () => {
    isFullscreen.value = !!document.fullscreenElement;
    if (document.fullscreenElement) return;
    // Left fullscreen while the page is visible and not via exitFullscreen():
    // the Android back gesture / Esc. Leaving the app hides the page first, so
    // that case is not treated as deliberate and the next tap re-enters.
    if (!leaving && !document.hidden) suppressed = true;
    leaving = false;
  });
}

async function request() {
  if (inFlight) return false;
  inFlight = true;
  try {
    if (!document.fullscreenElement) {
      try {
        await document.documentElement.requestFullscreen({ navigationUI: 'hide' });
      } catch {
        return false; // refused (no user gesture, iframe, unsupported)
      }
    }
    try {
      await screen.orientation?.lock?.('landscape');
      return true;
    } catch {
      return false; // fullscreen worked but this device won't lock
    }
  } finally {
    inFlight = false;
  }
}

/**
 * Go fullscreen and lock to landscape from an explicit control (rotate-gate
 * button, Settings switch). Also clears "left on purpose". Resolves true when
 * the lock took.
 */
export function enterLandscape() {
  suppressed = false;
  return request();
}

export async function exitFullscreen() {
  leaving = true;
  try {
    screen.orientation?.unlock?.();
  } catch {
    // nothing locked
  }
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else leaving = false; // no change event will come to reset it
  } catch {
    leaving = false; // already out
  }
}

/**
 * Enter fullscreen on the first tap while `isEnabled()` is true (phones, with
 * the Settings switch on). Re-enters on later taps — e.g. after returning from
 * another app — unless the player left fullscreen themselves.
 * Returns a function that removes the listener.
 */
export function useAutoFullscreen(isEnabled) {
  if (typeof window === 'undefined' || !canFullscreen) return () => {};
  // pointerup, not pointerdown: touch activation is granted on release.
  const onTap = () => {
    if (suppressed || document.fullscreenElement || !isEnabled()) return;
    request();
  };
  window.addEventListener('pointerup', onTap, { capture: true, passive: true });
  return () => window.removeEventListener('pointerup', onTap, { capture: true });
}
