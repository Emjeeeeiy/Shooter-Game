# Neon Strike

A modern, fast-paced top-down arena shooter (Vue 3 + Vite + Tailwind CSS + Canvas).

Survive escalating waves, chain kills for combos, grab buffs from special enemies, and clear the field with missiles / shockwave / dash.

![Neon Strike](public/brand/logo.png)

## Setup and Run

Requires Node.js >= 18.

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # production build -> dist/
npm run preview  # preview production build
npm test         # vitest unit tests
```

## Controls

| Input | Action |
|---|---|
| **WASD / Arrows** | Move (normalized diagonals) |
| **Mouse** | Aim |
| **Left Click / Space (hold)** | Fire plasma (hold to auto-fire) |
| **Shift** | Dash — invincible, kills on contact (2 charges, ~1.2s recharge) |
| **C** | Homing missiles (5s, 20 when Skill buff) |
| **E** | Shockwave — heavy radial damage + knockback (15s) |
| **P / Esc** | Pause / resume |
| **M** | Mute / unmute |
| Touch | Left virtual stick to move, right side drag to aim, buttons to fire/dash/missiles/shock |

Kills charge a combo multiplier (up to x5). Taking damage resets combo.
Special enemies drop buffs / pickups:

* **Gold hexagon** → Skill Enhanced (triple shot, faster cooldowns)
* **Cyan square** → Infinite Ammo (no energy cost, faster regen)
* **Green cross** → Repair (+30 integrity)
* **Violet triangle** → Magnet (pickup attraction) — boss waves

Boss every 5 waves: large, high HP, radial burst.

## Architecture

```
src/
  game/
    constants.js  # tunables, palette, enemy defs, wave director tables
    engine.js     # pure simulation (no DOM), tick-based, fixed 60Hz
    renderer.js   # canvas + minimap drawing (culled, pooled particles)
    audio.js      # WebAudio synth SFX, no assets
  composables/
    useGame.js        # loop, input, pause, touch, settings wiring
    useLeaderboard.js # localStorage top-10 with validation
    useSettings.js    # volume/shake/fps/mute persisted settings
  components/
    GameStage.vue, Hud.vue, AbilityBar.vue, Minimap.vue,
    Banner.vue, StatBar.vue, StartOverlay.vue,
    GameOverOverlay.vue, PauseOverlay.vue, SettingsPanel.vue,
    TouchControls.vue, Leaderboard.vue
```

* Engine never touches DOM. Vue reads a `hud` mirror synced once per frame.
* Simulation is tick-based (`STEP_MS = 1000/60`). Cooldowns are in ticks, not `Date.now()`, so pause/hidden tabs don't desync.
* Legacy single-file prototype archived at `legacy/shootergame.html` — `src/` is source of truth.

## Tuning

All gameplay numbers live in `src/game/constants.js` (`player, bullet, energy, dash, missile, shock, combo, pickups, MAX_PARTICLES, ENEMY_TYPES, BOSS, spawn`).

## Production

* `vite.config.js` uses relative `base`, sourcemaps, Vitest config.
* PWA manifest at `public/manifest.webmanifest`.
* CI: `.github/workflows/ci.yml` runs `npm test` + `npm run build`.
* Scores stored locally (`neonStrike_leaderboard_v2`, top 10).

## Roadmap

* [x] Tick cooldowns, dash charges, combo, pickups, boss
* [ ] Online leaderboard, replays, more biomes
