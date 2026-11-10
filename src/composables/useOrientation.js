/**
 * Landscape helpers. Browsers only allow an orientation lock while the page is
 * fullscreen (Android Chrome / installed PWA); iOS Safari supports neither,
 * so callers must still show the rotate prompt as the fallback.
 */
export const canFullscreen = typeof document !== 'undefined' && !!document.fullscreenEnabled;

/** Go fullscreen and lock to landscape. Resolves true when the lock took. */
export async function enterLandscape() {
  try {
    if (!document.fullscreenElement) {
      await document.documentElement.requestFullscreen({ navigationUI: 'hide' });
    }
  } catch {
    return false; // refused (no user gesture, iframe, unsupported)
  }
  try {
    await screen.orientation?.lock?.('landscape');
    return true;
  } catch {
    return false; // fullscreen worked but this device won't lock
  }
}

export async function exitFullscreen() {
  try {
    screen.orientation?.unlock?.();
  } catch {
    // nothing locked
  }
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
  } catch {
    // already out
  }
}
