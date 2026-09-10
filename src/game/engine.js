import {
  WORLD_WIDTH,
  WORLD_HEIGHT,
  VIEW_WIDTH,
  VIEW_HEIGHT,
  BUFFS,
  BUFF_DURATION,
  BOSSES,
  MAPS,
  CHARACTERS,
  ENEMY_TYPES,
  MAX_PARTICLES,
  TICKS_PER_SECOND,
  bullet as BULLET,
  dash as DASH,
  energy as ENERGY,
  missile as MISSILE,
  combo as COMBO,
  pickups as PICKUPS,
  palette,
  player as PLAYER,
  shock as SHOCK,
  spawn as SPAWN,
} from './constants.js';

const MOVE_KEYS = {
  KeyW: [0, -1],
  ArrowUp: [0, -1],
  KeyS: [0, 1],
  ArrowDown: [0, 1],
  KeyA: [-1, 0],
  ArrowLeft: [-1, 0],
  KeyD: [1, 0],
  ArrowRight: [1, 0],
};

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const GRID_CELL = 90;
const cellKey = (x, y) => `${Math.floor(x / GRID_CELL)},${Math.floor(y / GRID_CELL)}`;

/**
 * The simulation. Owns all entity state as plain (non-reactive) objects so the
 * hot loop never pays for a proxy, and mirrors a handful of scalars into `hud`
 * once per frame for Vue to render. It never touches the DOM.
 *
 * Time is tick-based (60 ticks = 1s). Cooldowns, buffs and combos all count
 * down in ticks so pause / hidden tabs never desync the HUD.
 */
export class Game {
  constructor(hud, emit = () => {}) {
    this.hud = hud;
    this.emit = emit;

    this.camera = { x: 0, y: 0, width: VIEW_WIDTH, height: VIEW_HEIGHT };
    this.keys = new Set();
    this.moveVector = { x: 0, y: 0 }; // virtual joystick / touch
    this.pointer = { x: VIEW_WIDTH / 2, y: VIEW_HEIGHT / 2 };
    this.fireHeld = false;

    this.characterId = 'vanguard';
    this.character = CHARACTERS.vanguard;
    this.mapId = 'grid';
    this.pilotName = '';
    this.seed = 1;
    this.rngState = 1;

    this.reset();
  }

  // --- lifecycle ------------------------------------------------------------

  reset() {
    this.running = false;
    this.paused = false;
    this.tick = 0;
    this.hitStopTicks = 0;
    this.score = 0;
    this.wave = 1;
    this.kills = 0;
    this.energy = ENERGY.max;

    this.player = {
      x: WORLD_WIDTH / 2,
      y: WORLD_HEIGHT / 2,
      radius: PLAYER.radius,
      speed: this.character.speed,
      maxHealth: this.character.maxHealth,
      health: this.character.maxHealth,
      angle: 0,
      trail: [],
      isDashing: false,
      dashTime: 0,
      dashAngle: 0,
      iframes: 0,
      flash: 0,
    };

    this.bullets = [];
    this.enemies = [];
    this.missiles = [];
    this.particles = [];
    this.shockWaves = [];
    this.obstacles = [];
    this.pickups = [];

    this.activeBuff = null;
    this.buffTimer = 0;

    // Tick-based cooldowns (remaining ticks). 0 = ready.
    this.missileCooldown = 0;
    this.shockCooldown = 0;
    this.dashCharges = this.dashMax();
    this.dashRecharge = 0;

    // Combo
    this.comboKills = 0;
    this.comboTimer = 0;
    this.multiplier = 1;
    this.maxMultiplier = 1;

    // Stats for the game-over screen
    this.shotsFired = 0;
    this.shotsHit = 0;
    this.timeTicks = 0;
    this.damageTaken = 0;
    this.bossActive = false;
    this.bossesSlain = 0;
    this.rampartTimer = 0;
    this.frenzyTimer = 0;

    this.spawnTimer = 0;
    this.spawnInterval = SPAWN.baseInterval;
    this.fireCooldown = 0;

    this.generateObstacles();
    this.updateCamera();
    this.syncHud();
  }

  start(characterId, seed, mapId) {
    if (characterId && CHARACTERS[characterId]) {
      this.characterId = characterId;
      this.character = CHARACTERS[characterId];
    }
    this.setMap(mapId ?? this.mapId);
    this.srand(seed ?? ((Date.now() % 2147483646) + 1));
    this.reset();
    this.running = true;
    this.paused = false;
    this.hud.running = true;
    this.hud.paused = false;
    this.hud.gameOver = false;
    this.emit('banner', { text: `Wave ${this.wave}`, tone: 'accent' });
    this.emit('sfx', { name: 'wave' });
  }

  stop() {
    this.running = false;
    this.paused = false;
    this.hud.running = false;
    this.hud.paused = false;
  }

  setCharacter(id) {
    if (!CHARACTERS[id]) return;
    this.characterId = id;
    this.character = CHARACTERS[id];
    if (!this.running) {
      this.player.speed = this.character.speed;
      this.player.maxHealth = this.character.maxHealth;
      this.player.health = this.character.maxHealth;
      this.dashCharges = this.dashMax();
      this.dashRecharge = 0;
    }
    this.syncHud();
  }

  dashMax() {
    return this.character?.dashCharges ?? DASH.maxCharges;
  }

  setMap(id) {
    if (MAPS[id]) this.mapId = id;
  }

  setPilotName(name) {
    this.pilotName = String(name ?? '').slice(0, 20);
    this.syncHud();
  }

  /** Cooldown total in ticks for an ability, with ship + buff modifiers. */
  abilityTotal(kind) {
    if (kind === 'shock') return this.ultCooldown();
    const mult = this.character?.missileCdMult ?? 1;
    const scaled = Math.round(MISSILE.cooldownTicks * mult);
    return this.activeBuff === 'SKILL' ? Math.round(scaled * 0.5) : scaled;
  }

  /** Ultimate cooldown in ticks, with ship + Skill-buff modifiers. */
  ultCooldown() {
    const base = this.character.ultimate?.cooldownTicks ?? SHOCK.cooldownTicks;
    return this.activeBuff === 'SKILL' ? Math.round(base * 0.5) : base;
  }

  /** Difficulty tier: 0 for waves 1-10, rising every 10 waves. */
  tier() {
    return Math.floor((this.wave - 1) / 10);
  }

  comboWindow() {
    return Math.round(COMBO.windowTicks * (this.character?.comboWindowMult ?? 1));
  }

  spawnIntervalFor(wave) {
    const tier = Math.floor((wave - 1) / 10);
    return Math.max(
      SPAWN.minInterval,
      SPAWN.baseInterval - wave * SPAWN.intervalStepPerWave - tier * SPAWN.intervalStepPerTier,
    );
  }

  pause() {
    if (!this.running) return;
    this.paused = true;
    this.hud.paused = true;
  }

  resume() {
    if (!this.running) return;
    this.paused = false;
    this.hud.paused = false;
  }

  togglePause() {
    if (this.paused) this.resume();
    else this.pause();
  }

  hitStop(ticks = 3) {
    this.hitStopTicks = Math.max(this.hitStopTicks, ticks);
  }

  /** Seeded RNG (mulberry32) so rooms can share identical battlefields. */
  srand(seed) {
    this.seed = seed >>> 0 || 1;
    this.rngState = this.seed;
  }

  /** Gameplay randomness. Visual-only particles keep using Math.random. */
  random() {
    this.rngState |= 0;
    this.rngState = (this.rngState + 0x6d2b79f5) | 0;
    let t = Math.imul(this.rngState ^ (this.rngState >>> 15), 1 | this.rngState);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  gameOver() {
    this.running = false;
    this.paused = false;
    this.hud.running = false;
    this.hud.paused = false;
    this.hud.gameOver = true;
    this.hud.finalScore = this.score;
    this.hud.finalWave = this.wave;
    this.hud.finalStats = {
      kills: this.kills,
      timeSec: Math.round(this.timeTicks / TICKS_PER_SECOND),
      accuracy: this.shotsFired === 0 ? 0 : Math.round((this.shotsHit / this.shotsFired) * 100),
      maxMultiplier: this.maxMultiplier,
      damageTaken: Math.round(this.damageTaken),
    };
    this.emit('gameover');
    this.emit('sfx', { name: 'gameover' });
  }

  // --- world ----------------------------------------------------------------

  generateObstacles() {
    const def = MAPS[this.mapId] ?? MAPS.grid;
    const cx = WORLD_WIDTH / 2;
    const cy = WORLD_HEIGHT / 2;
    const clearOfSpawn = (r, safe) => {
      const nx = clamp(cx, r.x, r.x + r.width);
      const ny = clamp(cy, r.y, r.y + r.height);
      return Math.hypot(cx - nx, cy - ny) >= safe;
    };

    this.obstacles = [];
    if (def.pattern === 'pillars') {
      // Symmetric colonnade with open lanes; the arena heart stays open.
      for (const fx of [0.22, 0.5, 0.78]) {
        for (const fy of [0.2, 0.5, 0.8]) {
          if (fx === 0.5 && fy === 0.5) continue;
          const w = 150 + this.random() * 70;
          const h = 150 + this.random() * 70;
          const r = {
            x: fx * WORLD_WIDTH - w / 2,
            y: fy * WORLD_HEIGHT - h / 2,
            width: w,
            height: h,
          };
          if (clearOfSpawn(r, 260)) this.obstacles.push(r);
        }
      }
      return;
    }

    const count = def.obstacleCount ?? SPAWN.obstacleCount;
    const safe = def.pattern === 'void' ? 420 : 220;
    let attempts = 0;
    while (this.obstacles.length < count && attempts < 300) {
      attempts += 1;
      let rect;
      if (def.pattern === 'debris') {
        const s = 30 + this.random() * 40;
        rect = {
          x: this.random() * (WORLD_WIDTH - s),
          y: this.random() * (WORLD_HEIGHT - s),
          width: s,
          height: s,
        };
      } else {
        // scatter / void: chunky ruins.
        rect = {
          x: this.random() * (WORLD_WIDTH - 200) + 100,
          y: this.random() * (WORLD_HEIGHT - 200) + 100,
          width: this.random() * 100 + 50,
          height: this.random() * 100 + 50,
        };
      }
      if (!clearOfSpawn(rect, safe)) continue;
      this.obstacles.push(rect);
    }
  }

  hitsObstacle(x, y, radius) {
    for (const o of this.obstacles) {
      if (
        x + radius > o.x &&
        x - radius < o.x + o.width &&
        y + radius > o.y &&
        y - radius < o.y + o.height
      ) {
        return true;
      }
    }
    return false;
  }

  /** Move the player by a delta, clamped to the world and blocked per axis. */
  movePlayer(dx, dy) {
    const p = this.player;
    const nextX = clamp(p.x + dx, p.radius, WORLD_WIDTH - p.radius);
    const nextY = clamp(p.y + dy, p.radius, WORLD_HEIGHT - p.radius);

    if (!this.hitsObstacle(nextX, p.y, p.radius)) p.x = nextX;
    if (!this.hitsObstacle(p.x, nextY, p.radius)) p.y = nextY;
  }

  updateCamera() {
    const { camera, player } = this;
    camera.x = clamp(player.x - camera.width / 2, 0, WORLD_WIDTH - camera.width);
    camera.y = clamp(player.y - camera.height / 2, 0, WORLD_HEIGHT - camera.height);
  }

  get worldPointer() {
    return {
      x: this.pointer.x + this.camera.x,
      y: this.pointer.y + this.camera.y,
    };
  }

  // --- input ----------------------------------------------------------------

  setKey(code, isDown) {
    if (isDown) this.keys.add(code);
    else this.keys.delete(code);
  }

  setMoveVector(x, y) {
    this.moveVector.x = clamp(x, -1, 1);
    this.moveVector.y = clamp(y, -1, 1);
  }

  clearKeys() {
    this.keys.clear();
    this.moveVector.x = 0;
    this.moveVector.y = 0;
    this.fireHeld = false;
  }

  /** Held fire button (left mouse / space / touch) — the loop paces the shots. */
  setFireHeld(isDown) {
    this.fireHeld = isDown;
    if (!isDown) return;

    this.fire();
    this.fireCooldown = BULLET.interval;
  }

  /** Pointer position in view (canvas-logical) coordinates. */
  setPointer(x, y) {
    this.pointer.x = clamp(x, 0, this.camera.width);
    this.pointer.y = clamp(y, 0, this.camera.height);
  }

  /** Dynamic viewport for responsive play. World units stay fixed. */
  setView(w, h) {
    this.camera.width = clamp(Math.round(w), 600, WORLD_WIDTH);
    this.camera.height = clamp(Math.round(h), 400, WORLD_HEIGHT);
    this.pointer.x = clamp(this.pointer.x, 0, this.camera.width);
    this.pointer.y = clamp(this.pointer.y, 0, this.camera.height);
    this.updateCamera();
    this.syncHud();
  }

  // --- abilities ------------------------------------------------------------

  cooldownFor(baseTicks) {
    return this.activeBuff === 'SKILL' ? Math.round(baseTicks * 0.5) : baseTicks;
  }

  cooldownTotal(baseTicks) {
    return this.cooldownFor(baseTicks);
  }

  /** Pay an energy (mana) cost for a skill. Denies with feedback when broke. */
  spendEnergy(amount) {
    if (this.energy < amount) {
      this.emit('sfx', { name: 'deny' });
      this.emit('notice', { text: 'Not enough energy', tone: 'muted' });
      return false;
    }
    this.energy -= amount;
    return true;
  }

  fire() {
    if (!this.running || this.paused) return;

    // Basic plasma is free and spammable — energy is reserved for skills.
    const target = this.worldPointer;
    const angle = Math.atan2(target.y - this.player.y, target.x - this.player.x);
    const buffed = this.activeBuff === 'SKILL';
    const baseDmg = this.character?.bulletDamage ?? 1;
    const count = buffed ? 3 : 1;
    const spread = buffed ? 0.2 : 0;

    for (let i = 0; i < count; i += 1) {
      const a = angle + (i - (count - 1) / 2) * spread;
      this.bullets.push({
        x: this.player.x + Math.cos(a) * 30,
        y: this.player.y + Math.sin(a) * 30,
        vx: Math.cos(a) * BULLET.speed,
        vy: Math.sin(a) * BULLET.speed,
        radius: BULLET.radius,
        color: buffed ? palette.skill : palette.bullet,
        life: BULLET.life,
        damage: buffed ? baseDmg * 2 : baseDmg,
      });
    }
    this.shotsFired += 1;

    this.emit('sfx', { name: 'shoot' });
    this.movePlayer(-Math.cos(angle) * BULLET.recoil, -Math.sin(angle) * BULLET.recoil);
  }

  dash() {
    if (!this.running || this.paused || this.player.isDashing) return;
    if (this.dashCharges <= 0) {
      this.emit('sfx', { name: 'deny' });
      return;
    }
    if (!this.spendEnergy(DASH.energyCost)) return;
    this.dashCharges -= 1;
    if (this.dashRecharge <= 0) {
      this.dashRecharge = Math.round(
        DASH.cooldownTicks * (this.character.dash?.rechargeMult ?? 1),
      );
    }

    let angle = this.player.angle;
    const mv = this.readMoveInput();
    if (mv.x !== 0 || mv.y !== 0) angle = Math.atan2(mv.y, mv.x);

    this.player.isDashing = true;
    this.player.dashTime = this.character.dash?.duration ?? DASH.duration;
    this.player.dashAngle = angle;

    for (let i = 0; i < DASH.trailCount; i += 1) {
      this.burst(
        this.player.x - Math.cos(angle) * i * 10,
        this.player.y - Math.sin(angle) * i * 10,
        palette.playerDash,
        3,
        2,
      );
    }
    this.burst(this.player.x, this.player.y, palette.accent, 10, 4);
    this.emit('sfx', { name: 'dash' });
  }

  fireMissiles() {
    if (!this.running || this.paused) return;
    if (this.missileCooldown > 0) return;
    if (!this.spendEnergy(MISSILE.energyCost)) return;
    this.missileCooldown = this.abilityTotal('missile');

    const buffed = this.activeBuff === 'SKILL';
    const mc = this.character.missiles ?? {};
    const baseCount = mc.count ?? MISSILE.count;
    const count = buffed ? baseCount * 2 : baseCount;
    const dmg = mc.damage ?? MISSILE.damage;

    const targets = [...this.enemies]
      .sort(
        (a, b) =>
          Math.hypot(a.x - this.player.x, a.y - this.player.y) -
          Math.hypot(b.x - this.player.x, b.y - this.player.y),
      )
      .slice(0, count);

    for (let i = 0; i < count; i += 1) {
      let target = targets[i] ?? null;
      if (!target && this.enemies.length > 0) target = this.enemies[i % this.enemies.length];

      const angle = this.player.angle + (i - (count / 2 - 0.5)) * MISSILE.spread;
      const speed = (mc.speed ?? MISSILE.speed) * (buffed ? 1.3 : 1);

      this.missiles.push({
        x: this.player.x + Math.cos(angle) * 30,
        y: this.player.y + Math.sin(angle) * 30,
        vx: Math.cos(angle) * 8,
        vy: Math.sin(angle) * 8,
        radius: MISSILE.radius,
        target,
        life: MISSILE.life,
        speed,
        dmg,
        turnSpeed: buffed ? MISSILE.turnSpeedBuffed : MISSILE.turnSpeed,
      });
    }

    this.burst(this.player.x, this.player.y, palette.missile, 15, 5);
    this.emit('sfx', { name: 'missile' });
    this.movePlayer(
      -Math.cos(this.player.angle) * MISSILE.recoil,
      -Math.sin(this.player.angle) * MISSILE.recoil,
    );
  }

  /** E key: fires the selected ship's ultimate. */
  shockWave() {
    if (!this.running || this.paused) return;
    if (this.shockCooldown > 0) return;
    if (!this.spendEnergy(SHOCK.energyCost)) return;
    const ult = this.character.ultimate?.id ?? 'shock';
    if (ult === 'blink') return this.ultBlink();
    if (ult === 'charge') return this.ultCharge();
    if (ult === 'restore') return this.ultRestore();
    if (ult === 'stasis') return this.ultStasis();
    if (ult === 'rampart') return this.ultRampart();
    if (ult === 'barrage') return this.ultBarrage();
    if (ult === 'vortex') return this.ultVortex();
    if (ult === 'overdrive') return this.ultOverdrive();
    if (ult === 'annihilator') return this.ultAnnihilator();
    return this.ultShock();
  }

  /**
   * Shared radial strike: damages + knocks back every enemy in range with
   * falloff. Returns the number of enemies hit.
   */
  nova(maxRadius, baseDmg, knockback, color, burstN = 8, burstSpeed = 8) {
    let hits = 0;
    for (let i = this.enemies.length - 1; i >= 0; i -= 1) {
      const e = this.enemies[i];
      const d = Math.hypot(e.x - this.player.x, e.y - this.player.y);
      if (d > maxRadius) continue;
      hits += 1;
      const falloff = 1 - (d / maxRadius) * 0.5;
      const ka = Math.atan2(e.y - this.player.y, e.x - this.player.x);
      e.x = clamp(e.x + Math.cos(ka) * knockback * falloff, e.radius, WORLD_WIDTH - e.radius);
      e.y = clamp(e.y + Math.sin(ka) * knockback * falloff, e.radius, WORLD_HEIGHT - e.radius);
      e.health -= Math.max(2, Math.round(baseDmg * falloff));
      e.flash = 8;
      this.burst(e.x, e.y, color, burstN, burstSpeed);
      if (e.health <= 0) this.killEnemy(i, { viaShock: true });
    }
    return hits;
  }

  pushShockVisual() {
    this.shockWaves.push({
      x: this.player.x,
      y: this.player.y,
      radius: SHOCK.startRadius,
      life: SHOCK.life,
    });
  }

  // Vanguard: heavy radial damage + knockback.
  ultShock() {
    this.shockCooldown = this.ultCooldown();
    this.pushShockVisual();
    const hits = this.nova(SHOCK.maxRadius, SHOCK.damage, SHOCK.knockback, palette.shock);
    this.burst(this.player.x, this.player.y, palette.shock, 50, 15);
    this.emit('shake', { magnitude: hits > 6 ? 'big' : 'medium' });
    this.emit('sfx', { name: 'shock' });
    if (hits >= 5) this.hitStop(3);
  }

  // Spectre: teleport toward aim, shredding everything along the path.
  ultBlink() {
    this.shockCooldown = this.ultCooldown();
    const t = this.worldPointer;
    const a0 = Math.atan2(t.y - this.player.y, t.x - this.player.x);
    const dist = Math.min(420, Math.hypot(t.x - this.player.x, t.y - this.player.y));
    const x0 = this.player.x;
    const y0 = this.player.y;
    // Step the blink so walls still block it.
    const steps = 6;
    for (let s = 1; s <= steps; s += 1) {
      this.movePlayer((Math.cos(a0) * dist) / steps, (Math.sin(a0) * dist) / steps);
      this.burst(this.player.x, this.player.y, palette.magnet, 3, 2);
    }
    const x1 = this.player.x;
    const y1 = this.player.y;
    const len2 = Math.max(1, (x1 - x0) ** 2 + (y1 - y0) ** 2);
    for (let i = this.enemies.length - 1; i >= 0; i -= 1) {
      const e = this.enemies[i];
      const tt = Math.max(
        0,
        Math.min(1, ((e.x - x0) * (x1 - x0) + (e.y - y0) * (y1 - y0)) / len2),
      );
      const px = x0 + (x1 - x0) * tt;
      const py = y0 + (y1 - y0) * tt;
      if (Math.hypot(e.x - px, e.y - py) > 90 + e.radius) continue;
      e.flash = 8;
      this.burst(e.x, e.y, palette.magnet, 8, 7);
      this.damageEnemy(i, 6);
    }
    this.player.iframes = Math.max(this.player.iframes, 30);
    this.emit('sfx', { name: 'dash' });
  }

  // Juggernaut: unstoppable charge toward aim — the dash machinery
  // does the killing, invincible, straight through the horde.
  ultCharge() {
    this.shockCooldown = this.ultCooldown();
    const t = this.worldPointer;
    this.player.isDashing = true;
    this.player.dashTime = 40;
    this.player.dashAngle = Math.atan2(t.y - this.player.y, t.x - this.player.x);
    this.burst(this.player.x, this.player.y, palette.missile, 30, 10);
    this.emit('shake', { magnitude: 'medium' });
    this.emit('sfx', { name: 'dash' });
  }

  // Phantom: freeze the whole swarm in time, then crack it.
  ultStasis() {
    this.shockCooldown = this.ultCooldown();
    this.pushShockVisual();
    let hits = 0;
    for (let i = this.enemies.length - 1; i >= 0; i -= 1) {
      const e = this.enemies[i];
      if (Math.hypot(e.x - this.player.x, e.y - this.player.y) > 900) continue;
      hits += 1;
      e.slowTimer = 240;
      e.flash = 8;
      this.burst(e.x, e.y, palette.magnet, 5, 5);
      this.damageEnemy(i, 3);
    }
    this.burst(this.player.x, this.player.y, palette.magnet, 40, 12);
    this.emit('notice', { text: 'Stasis — the swarm freezes', tone: 'magnet' });
    this.emit('shake', { magnitude: 'medium' });
    this.emit('sfx', { name: 'shock' });
    if (hits >= 5) this.hitStop(3);
  }

  // Corsair: drags everything nearby into the guns, then crushes.
  ultVortex() {
    this.shockCooldown = this.ultCooldown();
    this.pushShockVisual();
    let hits = 0;
    for (let i = this.enemies.length - 1; i >= 0; i -= 1) {
      const e = this.enemies[i];
      const d = Math.hypot(e.x - this.player.x, e.y - this.player.y);
      if (d > 600 || d < 1) continue;
      hits += 1;
      const ka = Math.atan2(this.player.y - e.y, this.player.x - e.x);
      const pull = Math.min(d - (e.radius + 30), 220);
      if (pull > 0) {
        e.x = clamp(e.x + Math.cos(ka) * pull, e.radius, WORLD_WIDTH - e.radius);
        e.y = clamp(e.y + Math.sin(ka) * pull, e.radius, WORLD_HEIGHT - e.radius);
      }
      e.health -= 5;
      e.flash = 8;
      this.burst(e.x, e.y, palette.magnet, 6, 6);
      if (e.health <= 0) this.killEnemy(i, { viaShock: true });
    }
    this.burst(this.player.x, this.player.y, palette.magnet, 40, 12);
    this.emit('notice', { text: 'Vortex drags them in', tone: 'magnet' });
    this.emit('shake', { magnitude: 'medium' });
    this.emit('sfx', { name: 'shock' });
    if (hits >= 5) this.hitStop(3);
  }

  // Bulwark: thorn shield — attackers die on contact and mend the hull.
  ultRampart() {
    this.shockCooldown = this.ultCooldown();
    this.pushShockVisual();
    this.rampartTimer = 300;
    this.burst(this.player.x, this.player.y, palette.repair, 40, 12);
    this.emit('notice', { text: 'Rampart — come and take it', tone: 'repair' });
    this.emit('sfx', { name: 'buff' });
  }

  // Hornet: radial burst plus a firing frenzy.
  ultBarrage() {
    this.shockCooldown = this.ultCooldown();
    for (let k = 0; k < 24; k += 1) {
      const a = (k / 24) * Math.PI * 2;
      this.bullets.push({
        x: this.player.x + Math.cos(a) * 30,
        y: this.player.y + Math.sin(a) * 30,
        vx: Math.cos(a) * BULLET.speed,
        vy: Math.sin(a) * BULLET.speed,
        radius: BULLET.radius,
        color: palette.skill,
        life: BULLET.life,
        damage: 2,
      });
    }
    this.frenzyTimer = 300;
    this.burst(this.player.x, this.player.y, palette.skill, 30, 10);
    this.emit('notice', { text: 'Barrage — guns hot', tone: 'skill' });
    this.emit('shake', { magnitude: 'small' });
    this.emit('sfx', { name: 'missile' });
  }

  // Titan: hitscan railbeam toward aim — instant, piercing, brutal.
  ultAnnihilator() {
    this.shockCooldown = this.ultCooldown();
    const t = this.worldPointer;
    const a0 = Math.atan2(t.y - this.player.y, t.x - this.player.x);
    const LEN = 900;
    const HALF = 60;
    const ca = Math.cos(a0);
    const sa = Math.sin(a0);
    let hits = 0;
    for (let i = this.enemies.length - 1; i >= 0; i -= 1) {
      const e = this.enemies[i];
      const dx = e.x - this.player.x;
      const dy = e.y - this.player.y;
      const along = dx * ca + dy * sa;
      if (along < 0 || along > LEN) continue;
      if (Math.abs(-dx * sa + dy * ca) > HALF + e.radius) continue;
      hits += 1;
      e.flash = 8;
      this.burst(e.x, e.y, palette.danger, 10, 8);
      this.damageEnemy(i, 20);
    }
    for (let d = 30; d < LEN; d += 24) {
      this.burst(this.player.x + ca * d, this.player.y + sa * d, palette.danger, 2, 2);
    }
    this.emit('shake', { magnitude: 'big' });
    this.emit('sfx', { name: 'shock' });
    this.hitStop(6);
    if (hits === 0) this.emit('notice', { text: 'Annihilator missed', tone: 'muted' });
  }

  // Oracle: full energy plus a Skill surge.
  ultOverdrive() {
    this.shockCooldown = this.ultCooldown();
    this.energy = ENERGY.max;
    this.applyBuff('SKILL');
    this.burst(this.player.x, this.player.y, palette.skill, 40, 12);
    this.emit('notice', { text: 'Overdrive engaged', tone: 'skill' });
    this.emit('shake', { magnitude: 'small' });
    this.emit('sfx', { name: 'buff' });
  }

  // Warden: heal + recharge, burns nearby foes.
  ultRestore() {
    this.shockCooldown = this.ultCooldown();
    this.pushShockVisual();
    this.player.health = Math.min(this.player.maxHealth, this.player.health + 35);
    this.energy = Math.min(ENERGY.max, this.energy + 50);
    // Drag distant pickups toward the blast.
    for (const pk of this.pickups) {
      const pd = Math.hypot(pk.x - this.player.x, pk.y - this.player.y);
      if (pd > 1 && pd <= 900) {
        const pull = Math.min(pd * 0.6, 400);
        const pa = Math.atan2(this.player.y - pk.y, this.player.x - pk.x);
        pk.x += Math.cos(pa) * pull;
        pk.y += Math.sin(pa) * pull;
      }
    }
    const hits = this.nova(550, 4, 14, palette.repair);
    this.burst(this.player.x, this.player.y, palette.repair, 50, 12);
    this.emit('notice', { text: '+35 integrity field', tone: 'repair' });
    this.emit('shake', { magnitude: 'small' });
    this.emit('sfx', { name: 'buff' });
    if (hits >= 5) this.hitStop(2);
  }

  // --- spawning and scoring -------------------------------------------------

  readMoveInput() {
    let dx = this.moveVector.x;
    let dy = this.moveVector.y;
    for (const code of this.keys) {
      const dir = MOVE_KEYS[code];
      if (dir) {
        dx += dir[0];
        dy += dir[1];
      }
    }
    // Normalize so diagonals aren't faster.
    const len = Math.hypot(dx, dy);
    if (len > 1) {
      dx /= len;
      dy /= len;
    }
    return { x: dx, y: dy };
  }

  pickType() {
    const roll = this.random();
    // Tougher breeds unlock as waves climb — early game stays gentle.
    const pool = Object.values(ENEMY_TYPES).filter((c) => this.wave >= (c.unlockWave ?? 1));
    const total = pool.reduce((s, c) => s + c.spawnChance, 0) || 1;
    let type = ENEMY_TYPES.NORMAL;
    let cumulative = 0;
    for (const candidate of pool) {
      cumulative += candidate.spawnChance / total;
      if (roll <= cumulative) {
        type = candidate;
        break;
      }
    }
    return type;
  }

  spawnEnemy(forceType = null) {
    if (this.enemies.length >= SPAWN.maxEnemies) return;
    const angle = this.random() * Math.PI * 2;
    const dist = Math.max(this.camera.width, this.camera.height) / 2 + 100;
    const x = clamp(this.player.x + Math.cos(angle) * dist, 50, WORLD_WIDTH - 50);
    const y = clamp(this.player.y + Math.sin(angle) * dist, 50, WORLD_HEIGHT - 50);

    const type = forceType ?? this.pickType();
    const tier = this.tier();
    let health = Math.min(SPAWN.maxHealth, type.health + Math.floor(this.wave / 4) + tier);
    let scoreMult = 1;
    // Elites stalk higher tiers: tankier, worth more.
    if (tier >= 2 && !forceType && this.random() < 0.06 + tier * 0.02) {
      health = Math.min(SPAWN.maxHealth, health + 2);
      scoreMult = 1.5;
    }

    this.enemies.push({
      x,
      y,
      radius: type.radius ?? 15,
      speed: Math.min(SPAWN.maxSpeed, type.speed + this.wave * 0.08 + tier * 0.3 + this.random() * 0.3),
      health,
      maxHealth: health,
      color: type.color,
      shape: type.shape,
      pulse: this.random() * Math.PI * 2,
      type,
      buff: type.buff,
      drop: type.drop ?? null,
      behavior: type.behavior ?? 'chase',
      seed: this.random() * 1000,
      state: 'chase',
      stateTimer: 0,
      lockAngle: 0,
      flash: 0,
      slowTimer: 0,
      scoreMult,
      elite: scoreMult > 1,
      isBoss: false,
    });
  }

  spawnBoss() {
    const def = BOSSES[this.bossesSlain % BOSSES.length];
    const x = clamp(this.player.x + 500, 100, WORLD_WIDTH - 100);
    const y = clamp(this.player.y - 300, 100, WORLD_HEIGHT - 100);
    const health = def.baseHealth + this.bossesSlain * def.healthPerBoss;
    this.enemies.push({
      x,
      y,
      radius: def.radius,
      speed: def.speed,
      health,
      maxHealth: health,
      color: def.color,
      shape: def.shape,
      pulse: 0,
      type: { name: def.name.toUpperCase(), score: def.score },
      buff: null,
      drop: 'shower',
      behavior: def.behavior,
      seed: this.random() * 1000,
      state: 'chase',
      stateTimer: def.minionInterval ?? 120,
      lockAngle: 0,
      flash: 0,
      slowTimer: 0,
      isBoss: true,
      boss: def,
    });
    this.bossActive = true;
    this.emit('banner', { text: def.title, tone: 'danger' });
    this.emit('notice', { text: def.note, tone: 'muted' });
    this.emit('sfx', { name: 'boss' });
    this.emit('shake', { magnitude: 'big' });
  }

  damageEnemy(index, dmg) {
    const e = this.enemies[index];
    if (!e) return;
    // Spectre passive: executions hit twice as hard under the threshold.
    const th = this.character?.executeThreshold ?? 0;
    if (th > 0 && e.health <= e.maxHealth * th) dmg *= 2;
    e.health -= dmg;
    e.flash = 6;
    if (e.health <= 0) this.killEnemy(index);
  }

  killEnemy(index, opts = {}) {
    const e = this.enemies[index];
    if (!e) return;

    // Splitter spawns two normals.
    if (e.behavior === 'splitter' && !e.isBoss) {
      for (let k = 0; k < 2; k += 1) {
        if (this.enemies.length >= SPAWN.maxEnemies) break;
        this.enemies.push({
          x: clamp(e.x + (this.random() - 0.5) * 40, 30, WORLD_WIDTH - 30),
          y: clamp(e.y + (this.random() - 0.5) * 40, 30, WORLD_HEIGHT - 30),
          radius: 14,
          speed: Math.min(SPAWN.maxSpeed, 1.4 + this.wave * 0.1),
          health: 1,
          maxHealth: 1,
          color: ENEMY_TYPES.NORMAL.color,
          shape: 'diamond',
          pulse: 0,
          type: ENEMY_TYPES.NORMAL,
          buff: null,
          drop: null,
          behavior: 'chase',
          seed: this.random() * 1000,
          state: 'chase',
          stateTimer: 0,
          lockAngle: 0,
          flash: 0,
          isBoss: false,
        });
      }
    }

    // Hydra Matriarch bursts into chargers.
    if (e.behavior === 'hydra' && e.isBoss) {
      for (let k = 0; k < 3; k += 1) {
        if (this.enemies.length >= SPAWN.maxEnemies) break;
        this.enemies.push({
          x: clamp(e.x + (this.random() - 0.5) * 90, 30, WORLD_WIDTH - 30),
          y: clamp(e.y + (this.random() - 0.5) * 90, 30, WORLD_HEIGHT - 30),
          radius: 16,
          speed: Math.min(SPAWN.maxSpeed, ENEMY_TYPES.CHARGER.speed + 1),
          health: 2,
          maxHealth: 2,
          color: ENEMY_TYPES.CHARGER.color,
          shape: 'triangle',
          pulse: 0,
          type: ENEMY_TYPES.CHARGER,
          buff: null,
          drop: null,
          behavior: 'charger',
          seed: this.random() * 1000,
          state: 'chase',
          stateTimer: 60,
          lockAngle: 0,
          flash: 0,
          slowTimer: 0,
          isBoss: false,
        });
      }
    }

    if (e.buff && !this.activeBuff) this.applyBuff(e.buff);
    if (e.drop === 'repair') this.dropPickup(e.x, e.y, 'repair');
    else if (e.drop === 'shower') {
      this.dropPickup(e.x - 30, e.y, 'repair');
      this.dropPickup(e.x + 30, e.y, 'energy');
      this.dropPickup(e.x, e.y - 30, 'magnet');
    } else if (!e.isBoss && this.random() < 0.04) {
      this.dropPickup(e.x, e.y, this.random() < 0.5 ? 'energy' : 'repair');
    }

    // Combo + score multiplier (Veteran hulls stretch the window / payout).
    this.comboKills += 1;
    this.comboTimer = this.comboWindow();
    this.multiplier = Math.min(COMBO.maxMultiplier, 1 + Math.floor(this.comboKills / COMBO.killsPerStep));
    this.maxMultiplier = Math.max(this.maxMultiplier, this.multiplier);

    this.burst(e.x, e.y, e.color, e.isBoss ? 60 : 25, e.isBoss ? 14 : 10);
    this.enemies.splice(index, 1);
    this.score +=
      e.type.score * e.maxHealth * this.multiplier * (e.scoreMult ?? 1) * (this.character?.scoreMult ?? 1);
    this.kills += 1;
    const energyBounty = this.character?.energyOnKill ?? 0;
    if (energyBounty > 0) this.energy = Math.min(ENERGY.max, this.energy + energyBounty);
    this.emit('sfx', { name: e.isBoss ? 'bossdie' : 'explosion' });
    if (e.isBoss) {
      this.bossesSlain += 1;
      this.bossActive = this.enemies.some((x) => x.isBoss);
      this.hitStop(6);
      this.emit('shake', { magnitude: 'big' });
      this.emit('banner', { text: 'Boss down', tone: 'success' });
    }

    if (this.kills % SPAWN.killsPerWave === 0) {
      this.wave += 1;
      this.spawnInterval = this.spawnIntervalFor(this.wave);
      if (this.wave % SPAWN.bossWaveEvery === 0) {
        this.spawnBoss();
      } else if (this.wave % 10 === 1) {
        // New threat tier every 10 waves: breather + warning.
        this.player.health = Math.min(this.player.maxHealth, this.player.health + 25);
        this.emit('banner', { text: `Threat ${this.tier() + 1}`, tone: 'danger' });
        this.emit('notice', { text: '+25 integrity — hold the line', tone: 'repair' });
        this.emit('sfx', { name: 'wave' });
      } else {
        this.emit('banner', { text: `Wave ${this.wave}`, tone: 'accent' });
        this.emit('sfx', { name: 'wave' });
      }
    }
  }

  damagePlayer(amount, fromX = null, fromY = null) {
    const p = this.player;
    if (p.isDashing || p.iframes > 0 || !this.running || this.paused) return;
    const taken = amount * (this.character?.damageTakenMult ?? 1);
    p.health -= taken;
    p.iframes = PLAYER.iframesTicks;
    p.flash = 10;
    this.damageTaken += taken;
    // Reset combo on damage — risk/reward.
    this.comboKills = 0;
    this.comboTimer = 0;
    this.multiplier = 1;
    if (fromX !== null) {
      const ka = Math.atan2(p.y - fromY, p.x - fromX);
      this.movePlayer(Math.cos(ka) * PLAYER.knockback, Math.sin(ka) * PLAYER.knockback);
    }
    this.burst(p.x, p.y, palette.danger, 15, 8);
    this.emit('shake', { magnitude: 'small' });
    this.emit('sfx', { name: 'hurt' });
    if (p.health <= 0) {
      p.health = 0;
      this.syncHud();
      this.gameOver();
    }
  }

  applyBuff(name) {
    const buff = BUFFS[name];
    if (!buff) return;

    this.activeBuff = name;
    this.buffTimer = Math.round(BUFF_DURATION * (this.character?.buffDurationMult ?? 1));
    this.emit('notice', { text: buff.label, note: buff.note, tone: name.toLowerCase() });
    this.emit('sfx', { name: 'buff' });
  }

  dropPickup(x, y, kind) {
    this.pickups.push({
      x: clamp(x, 20, WORLD_WIDTH - 20),
      y: clamp(y, 20, WORLD_HEIGHT - 20),
      kind, // repair | energy | magnet
      life: PICKUPS.lifeTicks,
      pulse: 0,
    });
  }

  /** Multiplayer versus: hostile reinforcements sent by an opponent. */
  injectEnemies(typeName, count) {
    const type = ENEMY_TYPES[typeName] ?? ENEMY_TYPES.NORMAL;
    for (let i = 0; i < count; i += 1) this.spawnEnemy(type);
    this.emit('notice', { text: 'Incoming hostiles!', tone: 'danger' });
    this.emit('sfx', { name: 'lunge' });
  }

  /** Multiplayer arcade: a teammate shares supplies. */
  giftDrop() {
    this.dropPickup(this.player.x + 50, this.player.y - 20, 'repair');
    this.emit('notice', { text: 'Squad gift: repairs inbound', tone: 'repair' });
    this.emit('sfx', { name: 'pickup' });
  }

  collectPickup(index) {
    const pk = this.pickups[index];
    if (!pk) return;
    const pm = this.character?.pickupMult ?? 1; // Warden passive
    if (pk.kind === 'repair') {
      const gain = Math.round(PICKUPS.repairAmount * pm);
      this.player.health = Math.min(this.player.maxHealth, this.player.health + gain);
      this.emit('notice', { text: `+${gain} Integrity`, tone: 'repair' });
    } else if (pk.kind === 'energy') {
      const gain = Math.round(PICKUPS.energyAmount * pm);
      this.energy = Math.min(ENERGY.max, this.energy + gain);
      this.emit('notice', { text: `+${gain} Energy`, tone: 'ammo' });
    } else if (pk.kind === 'magnet') {
      this.applyBuff('MAGNET');
    }
    this.burst(pk.x, pk.y, palette[pk.kind] ?? palette.accent, 12, 5);
    this.emit('sfx', { name: 'pickup' });
    this.pickups.splice(index, 1);
  }

  burst(x, y, color, count, speed = 5) {
    for (let i = 0; i < count; i += 1) {
      if (this.particles.length >= MAX_PARTICLES) this.particles.shift();
      const angle = (Math.PI * 2 * i) / count + Math.random() * 0.5;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed * Math.random(),
        vy: Math.sin(angle) * speed * Math.random(),
        life: 40,
        maxLife: 40,
        color,
        size: Math.random() * 3 + 1,
        decay: 0.98,
      });
    }
  }

  buildEnemyGrid() {
    const grid = new Map();
    for (let i = 0; i < this.enemies.length; i += 1) {
      const e = this.enemies[i];
      const k = cellKey(e.x, e.y);
      if (!grid.has(k)) grid.set(k, []);
      grid.get(k).push(i);
    }
    return grid;
  }

  nearbyEnemies(grid, x, y) {
    const cx = Math.floor(x / GRID_CELL);
    const cy = Math.floor(y / GRID_CELL);
    const out = [];
    for (let gx = cx - 1; gx <= cx + 1; gx += 1) {
      for (let gy = cy - 1; gy <= cy + 1; gy += 1) {
        const bucket = grid.get(`${gx},${gy}`);
        if (bucket) for (const i of bucket) out.push(i);
      }
    }
    return out;
  }

  // --- per-frame update ----------------------------------------------------

  update() {
    if (!this.running || this.paused) return;
    if (this.hitStopTicks > 0) {
      this.hitStopTicks -= 1;
      return;
    }

    this.tick += 1;
    this.timeTicks += 1;

    this.updateBuff();
    this.updateCombo();
    if (this.rampartTimer > 0) this.rampartTimer -= 1;
    if (this.frenzyTimer > 0) this.frenzyTimer -= 1;
    this.updateCooldowns();
    this.updateEnergy();
    this.updateFiring();
    this.updatePlayer();
    if (!this.running) return; // player may have died
    this.updateBullets();
    this.updateMissiles();
    this.updateShockWaves();
    this.updateSpawner();
    this.updateEnemies();
    if (!this.running) return;
    this.updatePickups();
    this.updateParticles();
    this.syncHud();
  }

  updateBuff() {
    if (!this.activeBuff) return;

    this.buffTimer -= 1;
    if (this.buffTimer <= 0) {
      this.activeBuff = null;
      this.emit('notice', { text: 'Buff expired', tone: 'muted' });
    }
  }

  updateCombo() {
    if (this.comboTimer > 0) {
      this.comboTimer -= 1;
      if (this.comboTimer <= 0) {
        this.comboKills = 0;
        this.multiplier = 1;
      }
    }
  }

  updateCooldowns() {
    if (this.missileCooldown > 0) this.missileCooldown -= 1;
    if (this.shockCooldown > 0) this.shockCooldown -= 1;
    if (this.dashCharges < this.dashMax()) {
      this.dashRecharge -= 1;
      if (this.dashRecharge <= 0) {
        this.dashCharges += 1;
        const recharge = Math.round(DASH.cooldownTicks * (this.character.dash?.rechargeMult ?? 1));
        this.dashRecharge = this.dashCharges >= this.dashMax() ? 0 : recharge;
      }
    }
  }

  updateEnergy() {
    if (this.energy >= ENERGY.max) return;
    const mult = this.character?.energyRegenMult ?? 1;
    const rate = (this.activeBuff === 'AMMO' ? ENERGY.regenBuffed : ENERGY.regen) * mult;
    this.energy = Math.min(ENERGY.max, this.energy + rate);
  }

  updateFiring() {
    if (this.fireCooldown > 0) this.fireCooldown -= 1;
    if (!this.fireHeld || this.fireCooldown > 0) return;

    this.fire();
    this.fireCooldown = this.frenzyTimer > 0 ? 3 : BULLET.interval;
  }

  updatePlayer() {
    const p = this.player;
    if (p.iframes > 0) p.iframes -= 1;
    if (p.flash > 0) p.flash -= 1;

    if (p.isDashing) {
      p.dashTime -= 1;
      const dashSpeed = this.character.dash?.speed ?? DASH.speed;
      this.movePlayer(Math.cos(p.dashAngle) * dashSpeed, Math.sin(p.dashAngle) * dashSpeed);

      if (p.dashTime % 2 === 0) this.burst(p.x, p.y, palette.playerDash, 2, 1);

      // Dashing is invincible and kills on contact, with a generous hitbox.
      // Warden hulls mend on every dash kill.
      const dashHeal = this.character.dash?.healOnKill ?? 0;
      for (let i = this.enemies.length - 1; i >= 0; i -= 1) {
        const e = this.enemies[i];
        if (e.isBoss) {
          // Dash chips bosses instead of insta-killing (Bull Rush hits harder).
          if (Math.hypot(p.x - e.x, p.y - e.y) < p.radius + e.radius + DASH.killPadding) {
            this.damageEnemy(i, this.character.dash?.bossDmg ?? 4);
          }
          continue;
        }
        if (Math.hypot(p.x - e.x, p.y - e.y) < p.radius + e.radius + DASH.killPadding) {
          this.killEnemy(i);
          if (dashHeal > 0) {
            p.health = Math.min(p.maxHealth, p.health + dashHeal);
          }
          // Phantom passive: dash kills refund one charge.
          if (this.character.dashRefundOnKill && this.dashCharges < this.dashMax()) {
            this.dashCharges += 1;
          }
        }
      }

      if (p.dashTime <= 0) {
        p.isDashing = false;
        this.burst(p.x, p.y, palette.accent, 8, 3);
      }
    } else {
      const mv = this.readMoveInput();
      if (mv.x !== 0 || mv.y !== 0) this.movePlayer(mv.x * p.speed, mv.y * p.speed);
    }

    p.trail.push({ x: p.x, y: p.y, life: PLAYER.trailLength });
    p.trail = p.trail.filter((t) => (t.life -= 1) > 0);

    const target = this.worldPointer;
    p.angle = Math.atan2(target.y - p.y, target.x - p.x);

    this.updateCamera();
  }

  updateBullets() {
    for (let i = this.bullets.length - 1; i >= 0; i -= 1) {
      const b = this.bullets[i];
      b.x += b.vx;
      b.y += b.vy;
      b.life -= 1;

      if (this.hitsObstacle(b.x, b.y, b.radius)) {
        this.burst(b.x, b.y, b.color, 5, 3);
        this.bullets.splice(i, 1);
        continue;
      }

      if (b.life <= 0 || b.x < 0 || b.x > WORLD_WIDTH || b.y < 0 || b.y > WORLD_HEIGHT) {
        this.bullets.splice(i, 1);
      }
    }
  }

  updateMissiles() {
    for (let i = this.missiles.length - 1; i >= 0; i -= 1) {
      const m = this.missiles[i];
      m.life -= 1;

      if (m.target && this.enemies.includes(m.target)) {
        const desired = Math.atan2(m.target.y - m.y, m.target.x - m.x);
        const current = Math.atan2(m.vy, m.vx);

        let diff = desired - current;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;

        const angle = current + clamp(diff, -m.turnSpeed, m.turnSpeed);
        m.vx = Math.cos(angle) * m.speed;
        m.vy = Math.sin(angle) * m.speed;
      }

      m.x += m.vx;
      m.y += m.vy;

      if (m.life % 3 === 0) this.burst(m.x, m.y, palette.missile, 1, 1);

      let hit = false;
      for (let j = this.enemies.length - 1; j >= 0; j -= 1) {
        const e = this.enemies[j];
        if (Math.hypot(m.x - e.x, m.y - e.y) >= e.radius + m.radius) continue;

        this.damageEnemy(j, m.dmg ?? MISSILE.damage);
        // Siphon missiles mend the hull on every kill.
        if (!this.enemies.includes(e)) {
          const siphon = this.character.missiles?.siphon ?? 0;
          if (siphon > 0) {
            this.player.health = Math.min(this.player.maxHealth, this.player.health + siphon);
          }
        }
        this.burst(m.x, m.y, palette.missile, 10, 6);
        hit = true;
        break;
      }

      if (hit || m.life <= 0 || this.hitsObstacle(m.x, m.y, m.radius)) {
        if (!hit) this.burst(m.x, m.y, palette.missile, 8, 4);
        this.missiles.splice(i, 1);
      }
    }
  }

  updateShockWaves() {
    for (let i = this.shockWaves.length - 1; i >= 0; i -= 1) {
      const s = this.shockWaves[i];
      s.radius += SHOCK.growth;
      s.life -= 1;
      if (s.life <= 0) this.shockWaves.splice(i, 1);
    }
  }

  updateSpawner() {
    this.spawnTimer += 1;
    if (this.spawnTimer < this.spawnInterval) return;

    this.spawnEnemy();
    this.spawnTimer = 0;
    this.spawnInterval = this.spawnIntervalFor(this.wave);
  }

  updateEnemies() {
    const p = this.player;
    const grid = this.buildEnemyGrid();

    // Bullet collisions via spatial hash (bullets query nearby enemies).
    for (let j = this.bullets.length - 1; j >= 0; j -= 1) {
      const b = this.bullets[j];
      const candidates = this.nearbyEnemies(grid, b.x, b.y);
      for (const i of candidates) {
        const e = this.enemies[i];
        if (!e) continue;
        if (Math.hypot(b.x - e.x, b.y - e.y) >= e.radius + b.radius) continue;
        this.shotsHit += 1;
        this.bullets.splice(j, 1);
        this.burst(b.x, b.y, b.color, 3, 3);
        this.damageEnemy(i, b.damage);
        break;
      }
    }

    for (let i = this.enemies.length - 1; i >= 0; i -= 1) {
      const e = this.enemies[i];
      if (!e) continue;
      e.pulse += 0.1;
      if (e.flash > 0) e.flash -= 1;
      const slowed = (e.slowTimer ?? 0) > 0;
      if (slowed) {
        e.slowTimer -= 1;
        e.speed *= 0.45;
      }

      // Rampart thorns (Bulwark ultimate): attackers die and mend the hull.
      const touching = Math.hypot(p.x - e.x, p.y - e.y) < p.radius + e.radius;
      if (touching && this.rampartTimer > 0 && !p.isDashing) {
        if (e.isBoss) this.damageEnemy(i, 10);
        else this.killEnemy(i);
        p.health = Math.min(p.maxHealth, p.health + 5);
        this.burst(e.x, e.y, palette.repair, 12, 7);
        this.emit('sfx', { name: 'explosion' });
        continue;
      }

      // Contact damage (dash grants invincibility, iframes grant grace).
      if (!p.isDashing && p.iframes <= 0 && Math.hypot(p.x - e.x, p.y - e.y) < p.radius + e.radius) {
        const dmg = e.isBoss ? (e.boss?.contact ?? 25) : PLAYER.damageOnHit;
        // Contact consumes the enemy (except bosses) and damages the player.
        if (!e.isBoss) this.enemies.splice(i, 1);
        this.burst(e.x, e.y, palette.danger, 15, 8);
        this.damagePlayer(dmg, e.x, e.y);
        if (!this.running) return;
        continue;
      }

      this.moveEnemy(e, i);
      if (slowed) e.speed /= 0.45;
    }
  }

  moveEnemy(e, index) {
    const p = this.player;
    const angleToPlayer = Math.atan2(p.y - e.y, p.x - e.x);

    if (e.behavior === 'charger') {
      e.stateTimer -= 1;
      if (e.state === 'chase') {
        this.stepEnemy(e, angleToPlayer, e.speed);
        if (e.stateTimer <= 0 && Math.hypot(p.x - e.x, p.y - e.y) < 420) {
          e.state = 'telegraph';
          e.stateTimer = 30;
          e.lockAngle = angleToPlayer;
        }
        if (e.stateTimer <= -120) e.stateTimer = 0;
      } else if (e.state === 'telegraph') {
        e.lockAngle = angleToPlayer; // track briefly, then commit
        if (e.stateTimer <= 0) {
          e.state = 'lunge';
          e.stateTimer = 18;
          this.emit('sfx', { name: 'lunge' });
        }
      } else if (e.state === 'lunge') {
        this.stepEnemy(e, e.lockAngle, e.speed * 4);
        if (e.stateTimer <= 0) {
          e.state = 'chase';
          e.stateTimer = 90;
        }
      }
      return;
    }

    if (e.behavior === 'sniper') {
      // Strafe orbit + slight approach, sine wobble makes it hard to hit.
      const d = Math.hypot(p.x - e.x, p.y - e.y);
      const desired = 380;
      const radial = d > desired + 40 ? 1 : d < desired - 40 ? -0.6 : 0;
      const tangent = e.seed % 2 === 0 ? 1 : -1;
      const wobble = Math.sin((this.tick + e.seed) * 0.08) * 0.9;
      const a = angleToPlayer + tangent * (Math.PI / 2) * 0.7 + wobble * 0.3;
      const nx = e.x + (Math.cos(a) * e.speed + Math.cos(angleToPlayer) * radial * e.speed * 0.6);
      const ny = e.y + (Math.sin(a) * e.speed + Math.sin(angleToPlayer) * radial * e.speed * 0.6);
      if (!this.hitsObstacle(nx, e.y, e.radius)) e.x = nx;
      if (!this.hitsObstacle(e.x, ny, e.radius)) e.y = ny;
      return;
    }

    // Dreadnought: slow siege engine, spawns fighter swarms.
    if (e.behavior === 'boss') {
      this.stepEnemy(e, angleToPlayer, e.speed);
      e.stateTimer -= 1;
      if (e.stateTimer <= 0) {
        e.stateTimer = e.boss?.minionInterval ?? 180;
        const mCount = e.boss?.minionsPerSpawn ?? 4;
        const mType = ENEMY_TYPES[e.boss?.minion] ?? ENEMY_TYPES.NORMAL;
        for (let k = 0; k < mCount; k += 1) {
          if (this.enemies.length >= SPAWN.maxEnemies) break;
          this.spawnEnemy(mType);
        }
        this.burst(e.x, e.y, palette.boss, 20, 8);
        this.emit('shake', { magnitude: 'small' });
        this.emit('sfx', { name: 'bossspawn' });
      }
      return;
    }

    // Star-Wyrm: stalks, telegraphs, then rips across the arena.
    if (e.behavior === 'dragon') {
      e.stateTimer -= 1;
      if (e.state === 'chase') {
        this.stepEnemy(e, angleToPlayer, e.speed);
        if (e.stateTimer <= 0) {
          e.state = 'telegraph';
          e.stateTimer = 35;
          e.lockAngle = angleToPlayer;
        }
      } else if (e.state === 'telegraph') {
        e.lockAngle = angleToPlayer;
        e.flash = 4;
        if (e.stateTimer <= 0) {
          e.state = 'lunge';
          e.stateTimer = 22;
          this.emit('sfx', { name: 'lunge' });
          this.emit('shake', { magnitude: 'small' });
        }
      } else if (e.state === 'lunge') {
        this.stepEnemy(e, e.lockAngle, e.speed * 5);
        this.burst(e.x, e.y, e.color, 2, 4);
        if (e.stateTimer <= 0) {
          e.state = 'chase';
          e.stateTimer = 100;
        }
      }
      return;
    }

    // Hydra Matriarch: slow, regenerates, splits on death (see killEnemy).
    if (e.behavior === 'hydra') {
      this.stepEnemy(e, angleToPlayer, e.speed);
      e.stateTimer -= 1;
      if (e.stateTimer <= 0) {
        e.stateTimer = 30;
        if (e.health < e.maxHealth) e.health = Math.min(e.maxHealth, e.health + 1);
      }
      return;
    }

    // Void Carrier: keeps its distance, launches sniper rings + pulse push.
    if (e.behavior === 'carrier') {
      const d = Math.hypot(p.x - e.x, p.y - e.y);
      const desired = 480;
      if (d > desired + 60) this.stepEnemy(e, angleToPlayer, e.speed);
      else if (d < desired - 60) this.stepEnemy(e, angleToPlayer + Math.PI, e.speed);
      else this.stepEnemy(e, angleToPlayer + Math.PI / 2, e.speed * 0.5);

      e.stateTimer -= 1;
      if (e.stateTimer <= 0) {
        e.stateTimer = e.boss?.minionInterval ?? 240;
        const mCount = e.boss?.minionsPerSpawn ?? 6;
        const mType = ENEMY_TYPES[e.boss?.minion] ?? ENEMY_TYPES.NORMAL;
        for (let k = 0; k < mCount; k += 1) {
          if (this.enemies.length >= SPAWN.maxEnemies) break;
          const ma = (k / mCount) * Math.PI * 2 + this.random();
          this.enemies.push({
            x: clamp(e.x + Math.cos(ma) * 70, 30, WORLD_WIDTH - 30),
            y: clamp(e.y + Math.sin(ma) * 70, 30, WORLD_HEIGHT - 30),
            radius: 14,
            speed: Math.min(SPAWN.maxSpeed, mType.speed + 1),
            health: 1,
            maxHealth: 1,
            color: mType.color,
            shape: mType.shape,
            pulse: 0,
            type: mType,
            buff: mType.buff ?? null,
            drop: null,
            behavior: mType.behavior ?? 'chase',
            seed: this.random() * 1000,
            state: 'chase',
            stateTimer: 0,
            lockAngle: 0,
            flash: 0,
            slowTimer: 0,
            isBoss: false,
          });
        }
        this.movePlayer(Math.cos(angleToPlayer) * 14, Math.sin(angleToPlayer) * 14);
        this.burst(e.x, e.y, e.color, 24, 10);
        this.emit('shake', { magnitude: 'small' });
        this.emit('sfx', { name: 'shock' });
      }
      return;
    }

    // Default chase (normal / skill / ammo / splitter / repair).
    this.stepEnemy(e, angleToPlayer, e.speed);
  }

  stepEnemy(e, angle, speed) {
    const nextX = e.x + Math.cos(angle) * speed;
    const nextY = e.y + Math.sin(angle) * speed;
    if (!this.hitsObstacle(nextX, e.y, e.radius)) e.x = nextX;
    if (!this.hitsObstacle(e.x, nextY, e.radius)) e.y = nextY;
  }

  updatePickups() {
    const p = this.player;
    const attract = this.activeBuff === 'MAGNET' ? PICKUPS.magnetBuffRadius : PICKUPS.magnetRadius;
    for (let i = this.pickups.length - 1; i >= 0; i -= 1) {
      const pk = this.pickups[i];
      pk.life -= 1;
      pk.pulse += 0.12;
      if (pk.life <= 0) {
        this.pickups.splice(i, 1);
        continue;
      }
      const d = Math.hypot(p.x - pk.x, p.y - pk.y);
      if (d < p.radius + PICKUPS.radius + 6) {
        this.collectPickup(i);
        continue;
      }
      if (d < attract) {
        const a = Math.atan2(p.y - pk.y, p.x - pk.x);
        const pull = 4.5 * (1 - d / attract) + 1.2;
        pk.x += Math.cos(a) * pull;
        pk.y += Math.sin(a) * pull;
      }
    }
  }

  updateParticles() {
    for (let i = this.particles.length - 1; i >= 0; i -= 1) {
      const pt = this.particles[i];
      pt.x += pt.vx;
      pt.y += pt.vy;
      pt.vx *= pt.decay;
      pt.vy *= pt.decay;
      pt.life -= 1;
      if (pt.life <= 0) this.particles.splice(i, 1);
    }
  }

  // --- HUD mirror -----------------------------------------------------------

  /** Remaining fraction 0..1 for tick-based cooldowns. */
  cooldownFraction(remaining, total) {
    if (total <= 0) return 0;
    return clamp(remaining / total, 0, 1);
  }

  syncHud() {
    const hud = this.hud;
    hud.score = this.score;
    hud.wave = this.wave;
    hud.targets = this.enemies.length;
    hud.health = this.player.health;
    hud.energy = this.energy;
    hud.buff = this.activeBuff;
    hud.buffRemaining = this.activeBuff ? this.buffTimer / BUFF_DURATION : 0;
    hud.ultimateName = this.character.ultimate?.name ?? 'Shock';
    hud.dashing = this.player.isDashing;
    hud.dashCharges = this.dashCharges;
    hud.dashMax = this.dashMax();
    const dashTotal = Math.round(DASH.cooldownTicks * (this.character.dash?.rechargeMult ?? 1));
    hud.dashRecharge = this.dashRecharge > 0 ? 1 - this.dashRecharge / dashTotal : 0;
    hud.missileCooldown = this.cooldownFraction(this.missileCooldown, this.abilityTotal('missile'));
    hud.shockCooldown = this.cooldownFraction(this.shockCooldown, this.abilityTotal('shock'));
    hud.multiplier = this.multiplier;
    hud.comboTimer = this.comboTimer > 0 ? this.comboTimer / this.comboWindow() : 0;
    hud.bossActive = this.bossActive;
    hud.paused = this.paused;
    hud.timeSec = Math.floor(this.timeTicks / TICKS_PER_SECOND);
    hud.pickups = this.pickups.length;
    hud.kills = this.kills;
    hud.characterId = this.characterId;
    hud.characterName = this.character.name;
    hud.characterColor = this.character.color;
    hud.maxHealth = this.player.maxHealth;
    hud.pilotName = this.pilotName;
  }
}

export function createHudState() {
  return {
    score: 0,
    wave: 1,
    targets: 0,
    health: PLAYER.maxHealth,
    energy: ENERGY.max,
    buff: null,
    buffRemaining: 0,
    ultimateName: 'Shockwave',
    dashing: false,
    dashCharges: DASH.maxCharges,
    dashMax: DASH.maxCharges,
    dashRecharge: 0,
    characterId: 'vanguard',
    characterName: 'Vanguard',
    characterColor: '#38bdf8',
    maxHealth: PLAYER.maxHealth,
    pilotName: '',
    missileCooldown: 0,
    shockCooldown: 0,
    multiplier: 1,
    comboTimer: 0,
    bossActive: false,
    running: false,
    paused: false,
    gameOver: false,
    finalScore: 0,
    finalWave: 1,
    finalStats: null,
    timeSec: 0,
    pickups: 0,
    kills: 0,
  };
}
