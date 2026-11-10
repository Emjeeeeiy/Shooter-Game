import { reactive } from 'vue';

/**
 * Reactive mirror of the CSS viewport tiers declared in style.css, for the few
 * places where layout must change structure (not just style) — e.g. docking a
 * sheet into the page on phones, or picking the in-game HUD arrangement.
 *
 *   compact — phones: narrow (< 768px) or short (≤ 540px tall)
 *   short   — landscape phones (tiny: very short ones, e.g. 568×320)
 *   portrait / coarse (primary pointer) / anyCoarse (any touch input)
 */
const QUERIES = {
  compact: '(max-width: 767.98px), (max-height: 540px)',
  short: '(max-height: 540px)',
  tiny: '(max-height: 359px)',
  portrait: '(orientation: portrait)',
  // Phones are landscape-only: an upright phone gets the rotate gate.
  portraitPhone: '(orientation: portrait) and (max-width: 767.98px) and (pointer: coarse)',
  coarse: '(pointer: coarse)',
  anyCoarse: '(any-pointer: coarse)',
};

const state = reactive({
  compact: false,
  short: false,
  tiny: false,
  portrait: false,
  portraitPhone: false,
  coarse: false,
  anyCoarse: false,
});

if (typeof window !== 'undefined' && window.matchMedia) {
  for (const [key, query] of Object.entries(QUERIES)) {
    const mql = window.matchMedia(query);
    state[key] = mql.matches;
    const onChange = (e) => {
      state[key] = e.matches;
    };
    if (mql.addEventListener) mql.addEventListener('change', onChange);
    else mql.addListener?.(onChange);
  }
}

export function useViewport() {
  return state;
}
