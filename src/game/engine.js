import {
  WORLD_WIDTH,
  WORLD_HEIGHT,
  VIEW_WIDTH,
  VIEW_HEIGHT,
  BUFFS,
  BUFF_DURATION,
  ENEMY_TYPES,
  BOSS,
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
      health: PLAYER.maxHealth,
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
    this.dashCharges = DASH.maxCharges;
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

    this.spawnTimer = 0;
    this.spawnInterval = SPAWN.baseInterval;
    this.fireCooldown = 0;

    this.generateObstacles();
    this.updateCamera();
    this.syncHud();
  }

  start() {
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
    const safeRadius = 220; // keep the player's spawn point clear
    const cx = WORLD_WIDTH / 2;
    const cy = WORLD_HEIGHT / 2;

    this.obstacles = [];
    let attempts = 0;

    while (this.obstacles.length < SPAWN.obstacleCount && attempts < 200) {
      attempts += 1;
      const rect = {
        x: Math.random() * (WORLD_WIDTH - 200) + 100,
        y: Math.random() * (WORLD_HEIGHT - 200) + 100,
        width: Math.random() * 100 + 50,
        height: Math.random() * 100 + 50,
      };

      const nearestX = clamp(cx, rect.x, rect.x + rect.width);
      const nearestY = clamp(cy, rect.y, rect.y + rect.height);
      if (Math.hypot(cx - nearestX, cy - nearestY) < safeRadius) continue;

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
    this.pointer.x = clamp(x, 0, VIEW_WIDTH);
    this.pointer.y = clamp(y, 0, VIEW_HEIGHT);
  }

  // --- abilities ------------------------------------------------------------

  cooldownFor(baseTicks) {
    return this.activeBuff === 'SKILL' ? Math.round(baseTicks * 0.5) : baseTicks;
  }

  cooldownTotal(baseTicks) {
    return this.cooldownFor(baseTicks);
  }

  fire() {
    if (!this.running || this.paused) return;

    if (this.activeBuff !== 'AMMO') {
      if (this.energy < BULLET.energyCost) return;
      this.energy -= BULLET.energyCost;
    }

    const target = this.worldPointer;
    const angle = Math.atan2(target.y - this.player.y, target.x - this.player.x);
    const buffed = this.activeBuff === 'SKILL';
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
        damage: buffed ? 2 : 1,
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
    this.dashCharges -= 1;
    if (this.dashRecharge <= 0) this.dashRecharge = DASH.cooldownTicks;

    let angle = this.player.angle;
    const mv = this.readMoveInput();
    if (mv.x !== 0 || mv.y !== 0) angle = Math.atan2(mv.y, mv.x);

    this.player.isDashing = true;
    this.player.dashTime = DASH.duration;
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
    this.missileCooldown = this.cooldownFor(MISSILE.cooldownTicks);

    const buffed = this.activeBuff === 'SKILL';
    const count = buffed ? MISSILE.countBuffed : MISSILE.count;

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
      const speed = buffed ? MISSILE.speedBuffed : MISSILE.speed;

      this.missiles.push({
        x: this.player.x + Math.cos(angle) * 30,
        y: this.player.y + Math.sin(angle) * 30,
        vx: Math.cos(angle) * 8,
        vy: Math.sin(angle) * 8,
        radius: MISSILE.radius,
        target,
        life: MISSILE.life,
        speed,
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

  shockWave() {
    if (!this.running || this.paused) return;
    if (this.shockCooldown > 0) return;
    this.shockCooldown = this.cooldownFor(SHOCK.cooldownTicks);

    this.shockWaves.push({
      x: this.player.x,
      y: this.player.y,
      radius: SHOCK.startRadius,
      life: SHOCK.life,
    });

    // Balanced radial damage + knockback (no longer clears the whole field).
    let hits = 0;
    for (let i = this.enemies.length - 1; i >= 0; i -= 1) {
      const e = this.enemies[i];
      const d = Math.hypot(e.x - this.player.x, e.y - this.player.y);
      if (d > SHOCK.maxRadius) continue;
      hits += 1;
      const falloff = 1 - (d / SHOCK.maxRadius) * 0.5;
      const dmg = Math.max(2, Math.round(SHOCK.damage * falloff));
      const ka = Math.atan2(e.y - this.player.y, e.x - this.player.x);
      e.x = clamp(e.x + Math.cos(ka) * SHOCK.knockback * falloff, e.radius, WORLD_WIDTH - e.radius);
      e.y = clamp(e.y + Math.sin(ka) * SHOCK.knockback * falloff, e.radius, WORLD_HEIGHT - e.radius);
      e.health -= dmg;
      e.flash = 8;
      this.burst(e.x, e.y, palette.shock, 8, 8);
      if (e.health <= 0) this.killEnemy(i, { viaShock: true });
    }

    this.burst(this.player.x, this.player.y, palette.shock, 50, 15);
    this.emit('shake', { magnitude: hits > 6 ? 'big' : 'medium' });
    this.emit('sfx', { name: 'shock' });
    if (hits >= 5) this.hitStop(3);
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
    const roll = Math.random();
    let type = ENEMY_TYPES.NORMAL;
    let cumulative = 0;
    for (const candidate of Object.values(ENEMY_TYPES)) {
      cumulative += candidate.spawnChance;
      if (roll <= cumulative) {
        type = candidate;
        break;
      }
    }
    return type;
  }

  spawnEnemy(forceType = null) {
    if (this.enemies.length >= SPAWN.maxEnemies) return;
    const angle = Math.random() * Math.PI * 2;
    const dist = Math.max(this.camera.width, this.camera.height) / 2 + 100;
    const x = clamp(this.player.x + Math.cos(angle) * dist, 50, WORLD_WIDTH - 50);
    const y = clamp(this.player.y + Math.sin(angle) * dist, 50, WORLD_HEIGHT - 50);

    const type = forceType ?? this.pickType();
    const health = Math.min(SPAWN.maxHealth, type.health + Math.floor(this.wave / 3));

    this.enemies.push({
      x,
      y,
      radius: 12 + health * 4,
      speed: Math.min(SPAWN.maxSpeed, type.speed + this.wave * 0.12 + Math.random() * 0.3),
      health,
      maxHealth: health,
      color: type.color,
      shape: type.shape,
      pulse: Math.random() * Math.PI * 2,
      type,
      buff: type.buff,
      drop: type.drop ?? null,
      behavior: type.behavior ?? 'chase',
      seed: Math.random() * 1000,
      state: 'chase',
      stateTimer: 0,
      lockAngle: 0,
      flash: 0,
      isBoss: false,
    });
  }

  spawnBoss() {
    const x = clamp(this.player.x + 500, 100, WORLD_WIDTH - 100);
    const y = clamp(this.player.y - 300, 100, WORLD_HEIGHT - 100);
    const health = BOSS.baseHealth + this.wave * BOSS.healthPerWave;
    this.enemies.push({
      x,
      y,
      radius: BOSS.radius,
      speed: BOSS.speed,
      health,
      maxHealth: health,
      color: BOSS.color,
      shape: BOSS.shape,
      pulse: 0,
      type: { name: 'BOSS', score: BOSS.score },
      buff: null,
      drop: 'shower',
      behavior: 'boss',
      seed: Math.random() * 1000,
      state: 'chase',
      stateTimer: BOSS.minionIntervalTicks,
      lockAngle: 0,
      flash: 0,
      isBoss: true,
    });
    this.bossActive = true;
    this.emit('banner', { text: `Boss — Wave ${this.wave}`, tone: 'danger' });
    this.emit('sfx', { name: 'boss' });
    this.emit('shake', { magnitude: 'big' });
  }

  damageEnemy(index, dmg) {
    const e = this.enemies[index];
    if (!e) return;
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
          x: clamp(e.x + (Math.random() - 0.5) * 40, 30, WORLD_WIDTH - 30),
          y: clamp(e.y + (Math.random() - 0.5) * 40, 30, WORLD_HEIGHT - 30),
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
          seed: Math.random() * 1000,
          state: 'chase',
          stateTimer: 0,
          lockAngle: 0,
          flash: 0,
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
    } else if (!e.isBoss && Math.random() < 0.04) {
      this.dropPickup(e.x, e.y, Math.random() < 0.5 ? 'energy' : 'repair');
    }

    // Combo + score multiplier
    this.comboKills += 1;
    this.comboTimer = COMBO.windowTicks;
    this.multiplier = Math.min(COMBO.maxMultiplier, 1 + Math.floor(this.comboKills / COMBO.killsPerStep));
    this.maxMultiplier = Math.max(this.maxMultiplier, this.multiplier);

    this.burst(e.x, e.y, e.color, e.isBoss ? 60 : 25, e.isBoss ? 14 : 10);
    this.enemies.splice(index, 1);
    this.score += e.type.score * e.maxHealth * this.multiplier;
    this.kills += 1;
    this.emit('sfx', { name: e.isBoss ? 'bossdie' : 'explosion' });
    if (e.isBoss) {
      this.bossActive = this.enemies.some((x) => x.isBoss);
      this.hitStop(6);
      this.emit('shake', { magnitude: 'big' });
      this.emit('banner', { text: 'Boss down', tone: 'success' });
    }

    if (this.kills % SPAWN.killsPerWave === 0) {
      this.wave += 1;
      this.spawnInterval = Math.max(
        SPAWN.minInterval,
        SPAWN.baseInterval - this.wave * SPAWN.intervalStepPerWave,
      );
      if (this.wave % SPAWN.bossWaveEvery === 0) this.spawnBoss();
      else {
        this.emit('banner', { text: `Wave ${this.wave}`, tone: 'accent' });
        this.emit('sfx', { name: 'wave' });
      }
    }
  }

  damagePlayer(amount, fromX = null, fromY = null) {
    const p = this.player;
    if (p.isDashing || p.iframes > 0 || !this.running || this.paused) return;
    p.health -= amount;
    p.iframes = PLAYER.iframesTicks;
    p.flash = 10;
    this.damageTaken += amount;
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
    this.buffTimer = BUFF_DURATION;
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

  collectPickup(index) {
    const pk = this.pickups[index];
    if (!pk) return;
    if (pk.kind === 'repair') {
      this.player.health = Math.min(PLAYER.maxHealth, this.player.health + PICKUPS.repairAmount);
      this.emit('notice', { text: `+${PICKUPS.repairAmount} Integrity`, tone: 'repair' });
    } else if (pk.kind === 'energy') {
      this.energy = Math.min(ENERGY.max, this.energy + PICKUPS.energyAmount);
      this.emit('notice', { text: `+${PICKUPS.energyAmount} Energy`, tone: 'ammo' });
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
    if (this.dashCharges < DASH.maxCharges) {
      this.dashRecharge -= 1;
      if (this.dashRecharge <= 0) {
        this.dashCharges += 1;
        this.dashRecharge = this.dashCharges >= DASH.maxCharges ? 0 : DASH.cooldownTicks;
      }
    }
  }

  updateEnergy() {
    if (this.energy >= ENERGY.max) return;
    const rate = this.activeBuff === 'AMMO' ? ENERGY.regenBuffed : ENERGY.regen;
    this.energy = Math.min(ENERGY.max, this.energy + rate);
  }

  updateFiring() {
    if (this.fireCooldown > 0) this.fireCooldown -= 1;
    if (!this.fireHeld || this.fireCooldown > 0) return;

    this.fire();
    this.fireCooldown = BULLET.interval;
  }

  updatePlayer() {
    const p = this.player;
    if (p.iframes > 0) p.iframes -= 1;
    if (p.flash > 0) p.flash -= 1;

    if (p.isDashing) {
      p.dashTime -= 1;
      this.movePlayer(Math.cos(p.dashAngle) * DASH.speed, Math.sin(p.dashAngle) * DASH.speed);

      if (p.dashTime % 2 === 0) this.burst(p.x, p.y, palette.playerDash, 2, 1);

      // Dashing is invincible and kills on contact, with a generous hitbox.
      for (let i = this.enemies.length - 1; i >= 0; i -= 1) {
        const e = this.enemies[i];
        if (e.isBoss) {
          // Dash chips bosses instead of insta-killing.
          if (Math.hypot(p.x - e.x, p.y - e.y) < p.radius + e.radius + DASH.killPadding) {
            this.damageEnemy(i, 4);
          }
          continue;
        }
        if (Math.hypot(p.x - e.x, p.y - e.y) < p.radius + e.radius + DASH.killPadding) {
          this.killEnemy(i);
        }
      }

      if (p.dashTime <= 0) {
        p.isDashing = false;
        this.burst(p.x, p.y, palette.accent, 8, 3);
      }
    } else {
      const mv = this.readMoveInput();
      if (mv.x !== 0 || mv.y !== 0) this.movePlayer(mv.x * PLAYER.speed, mv.y * PLAYER.speed);
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

        e.health -= MISSILE.damage;
        e.flash = 6;
        this.burst(m.x, m.y, palette.missile, 10, 6);
        hit = true;
        if (e.health <= 0) this.killEnemy(j);
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
    this.spawnInterval = Math.max(
      SPAWN.minInterval,
      SPAWN.baseInterval - this.wave * SPAWN.intervalStepPerWave,
    );
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

      // Contact damage (dash grants invincibility, iframes grant grace).
      if (!p.isDashing && p.iframes <= 0 && Math.hypot(p.x - e.x, p.y - e.y) < p.radius + e.radius) {
        const dmg = e.isBoss ? BOSS.contactDamage : PLAYER.damageOnHit;
        // Contact consumes the enemy (except bosses) and damages the player.
        if (!e.isBoss) this.enemies.splice(i, 1);
        this.burst(e.x, e.y, palette.danger, 15, 8);
        this.damagePlayer(dmg, e.x, e.y);
        if (!this.running) return;
        continue;
      }

      this.moveEnemy(e, i);
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

    if (e.behavior === 'boss') {
      this.stepEnemy(e, angleToPlayer, e.speed);
      e.stateTimer -= 1;
      if (e.stateTimer <= 0) {
        e.stateTimer = BOSS.minionIntervalTicks;
        for (let k = 0; k < BOSS.minionsPerSpawn; k += 1) {
          if (this.enemies.length >= SPAWN.maxEnemies) break;
          this.spawnEnemy(ENEMY_TYPES.NORMAL);
        }
        this.burst(e.x, e.y, palette.boss, 20, 8);
        this.emit('shake', { magnitude: 'small' });
        this.emit('sfx', { name: 'bossspawn' });
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
    hud.dashing = this.player.isDashing;
    hud.dashCharges = this.dashCharges;
    hud.dashMax = DASH.maxCharges;
    hud.dashRecharge = this.dashRecharge > 0 ? 1 - this.dashRecharge / DASH.cooldownTicks : 0;
    hud.missileCooldown = this.cooldownFraction(this.missileCooldown, this.cooldownTotal(MISSILE.cooldownTicks));
    hud.shockCooldown = this.cooldownFraction(this.shockCooldown, this.cooldownTotal(SHOCK.cooldownTicks));
    hud.multiplier = this.multiplier;
    hud.comboTimer = this.comboTimer > 0 ? this.comboTimer / COMBO.windowTicks : 0;
    hud.bossActive = this.bossActive;
    hud.paused = this.paused;
    hud.timeSec = Math.floor(this.timeTicks / TICKS_PER_SECOND);
    hud.pickups = this.pickups.length;
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
    dashing: false,
    dashCharges: DASH.maxCharges,
    dashMax: DASH.maxCharges,
    dashRecharge: 0,
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
  };
}
