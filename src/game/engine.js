import {
  WORLD_WIDTH,
  WORLD_HEIGHT,
  VIEW_WIDTH,
  VIEW_HEIGHT,
  BUFFS,
  BUFF_DURATION,
  ENEMY_TYPES,
  bullet as BULLET,
  dash as DASH,
  energy as ENERGY,
  missile as MISSILE,
  palette,
  player as PLAYER,
  shock as SHOCK,
  spawn as SPAWN,
} from './constants.js';

const MOVE_KEYS = {
  KeyW: [0, -1],
  KeyS: [0, 1],
  KeyA: [-1, 0],
  KeyD: [1, 0],
};

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

/**
 * The simulation. Owns all entity state as plain (non-reactive) objects so the
 * hot loop never pays for a proxy, and mirrors a handful of scalars into `hud`
 * once per frame for Vue to render. It never touches the DOM.
 */
export class Game {
  constructor(hud, emit = () => {}) {
    this.hud = hud;
    this.emit = emit;

    this.camera = { x: 0, y: 0, width: VIEW_WIDTH, height: VIEW_HEIGHT };
    this.keys = new Set();
    this.pointer = { x: VIEW_WIDTH / 2, y: VIEW_HEIGHT / 2 };
    this.fireHeld = false;

    this.reset();
  }

  // --- lifecycle ------------------------------------------------------------

  reset() {
    this.running = false;
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
    };

    this.bullets = [];
    this.enemies = [];
    this.missiles = [];
    this.particles = [];
    this.shockWaves = [];
    this.obstacles = [];

    this.activeBuff = null;
    this.buffTimer = 0;

    this.spawnTimer = 0;
    this.spawnInterval = SPAWN.baseInterval;
    this.fireCooldown = 0;
    this.lastMissileTime = 0;
    this.lastShockTime = 0;

    this.generateObstacles();
    this.updateCamera();
    this.syncHud();
  }

  start() {
    this.reset();
    this.running = true;
    this.hud.running = true;
    this.hud.gameOver = false;
    this.emit('banner', { text: `Wave ${this.wave}`, tone: 'accent' });
  }

  stop() {
    this.running = false;
    this.hud.running = false;
  }

  gameOver() {
    this.running = false;
    this.hud.running = false;
    this.hud.gameOver = true;
    this.hud.finalScore = this.score;
    this.hud.finalWave = this.wave;
    this.emit('gameover');
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

  clearKeys() {
    this.keys.clear();
    this.fireHeld = false;
  }

  /** Held fire button (mouse or Space) — the loop paces the shots. */
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

  cooldownFor(base) {
    return this.activeBuff === 'SKILL' ? base * 0.5 : base;
  }

  fire() {
    if (!this.running) return;

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

    this.movePlayer(-Math.cos(angle) * BULLET.recoil, -Math.sin(angle) * BULLET.recoil);
  }

  dash() {
    if (!this.running || this.player.isDashing) return;

    let angle = this.player.angle;
    let dx = 0;
    let dy = 0;
    for (const code of this.keys) {
      const dir = MOVE_KEYS[code];
      if (dir) {
        dx += dir[0];
        dy += dir[1];
      }
    }
    if (dx !== 0 || dy !== 0) angle = Math.atan2(dy, dx);

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
  }

  fireMissiles() {
    if (!this.running) return;

    const now = Date.now();
    if (now - this.lastMissileTime < this.cooldownFor(MISSILE.cooldown)) return;
    this.lastMissileTime = now;

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
    this.movePlayer(
      -Math.cos(this.player.angle) * MISSILE.recoil,
      -Math.sin(this.player.angle) * MISSILE.recoil,
    );
  }

  shockWave() {
    if (!this.running) return;

    const now = Date.now();
    if (now - this.lastShockTime < this.cooldownFor(SHOCK.cooldown)) return;
    this.lastShockTime = now;

    this.shockWaves.push({
      x: this.player.x,
      y: this.player.y,
      radius: SHOCK.startRadius,
      life: SHOCK.life,
    });

    const cleared = this.enemies.length;
    for (const e of this.enemies) {
      this.burst(e.x, e.y, palette.shock, 30, 10);
      this.score += e.maxHealth * SHOCK.healthBonus;
    }
    this.enemies = [];
    this.score += cleared * SHOCK.killBonus;

    this.burst(this.player.x, this.player.y, palette.shock, 50, 15);
    this.emit('shake');
  }

  // --- spawning and scoring -------------------------------------------------

  spawnEnemy() {
    const angle = Math.random() * Math.PI * 2;
    const dist = Math.max(this.camera.width, this.camera.height) / 2 + 100;
    const x = clamp(this.player.x + Math.cos(angle) * dist, 50, WORLD_WIDTH - 50);
    const y = clamp(this.player.y + Math.sin(angle) * dist, 50, WORLD_HEIGHT - 50);

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

    const health = type.health + Math.floor(this.wave / 3);

    this.enemies.push({
      x,
      y,
      radius: 12 + health * 4,
      speed: type.speed + this.wave * 0.2 + Math.random() * 0.3,
      health,
      maxHealth: health,
      color: type.color,
      shape: type.shape,
      pulse: 0,
      type,
      buff: type.buff,
    });
  }

  killEnemy(index) {
    const e = this.enemies[index];
    if (!e) return;

    if (e.buff && !this.activeBuff) this.applyBuff(e.buff);

    this.burst(e.x, e.y, e.color, 25, 10);
    this.enemies.splice(index, 1);
    this.score += e.type.score * e.maxHealth;
    this.kills += 1;

    if (this.kills % SPAWN.killsPerWave === 0) {
      this.wave += 1;
      this.spawnInterval = Math.max(
        SPAWN.minInterval,
        SPAWN.baseInterval - this.wave * SPAWN.intervalStepPerWave,
      );
      this.emit('banner', { text: `Wave ${this.wave}`, tone: 'accent' });
    }
  }

  applyBuff(name) {
    const buff = BUFFS[name];
    if (!buff) return;

    this.activeBuff = name;
    this.buffTimer = BUFF_DURATION;
    this.emit('notice', { text: buff.label, note: buff.note, tone: name.toLowerCase() });
  }

  burst(x, y, color, count, speed = 5) {
    for (let i = 0; i < count; i += 1) {
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

  // --- per-frame update ----------------------------------------------------

  update() {
    if (!this.running) return;

    this.updateBuff();
    this.updateEnergy();
    this.updateFiring();
    this.updatePlayer();
    this.updateBullets();
    this.updateMissiles();
    this.updateShockWaves();
    this.updateSpawner();
    this.updateEnemies();
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

    if (p.isDashing) {
      p.dashTime -= 1;
      this.movePlayer(Math.cos(p.dashAngle) * DASH.speed, Math.sin(p.dashAngle) * DASH.speed);

      if (p.dashTime % 2 === 0) this.burst(p.x, p.y, palette.playerDash, 2, 1);

      // Dashing is invincible and kills on contact, with a generous hitbox.
      for (let i = this.enemies.length - 1; i >= 0; i -= 1) {
        const e = this.enemies[i];
        if (Math.hypot(p.x - e.x, p.y - e.y) < p.radius + e.radius + DASH.killPadding) {
          this.killEnemy(i);
        }
      }

      if (p.dashTime <= 0) {
        p.isDashing = false;
        this.burst(p.x, p.y, palette.accent, 8, 3);
      }
    } else {
      let dx = 0;
      let dy = 0;
      for (const code of this.keys) {
        const dir = MOVE_KEYS[code];
        if (dir) {
          dx += dir[0];
          dy += dir[1];
        }
      }
      if (dx !== 0 || dy !== 0) this.movePlayer(dx * PLAYER.speed, dy * PLAYER.speed);
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

    for (let i = this.enemies.length - 1; i >= 0; i -= 1) {
      const e = this.enemies[i];
      e.pulse += 0.1;

      if (!p.isDashing && Math.hypot(p.x - e.x, p.y - e.y) < p.radius + e.radius) {
        p.health -= PLAYER.damageOnHit;
        this.burst(e.x, e.y, palette.danger, 15);
        this.enemies.splice(i, 1);

        if (p.health <= 0) {
          p.health = 0;
          this.syncHud();
          this.gameOver();
          return;
        }
        continue;
      }

      const angle = Math.atan2(p.y - e.y, p.x - e.x);
      const nextX = e.x + Math.cos(angle) * e.speed;
      const nextY = e.y + Math.sin(angle) * e.speed;
      if (!this.hitsObstacle(nextX, e.y, e.radius)) e.x = nextX;
      if (!this.hitsObstacle(e.x, nextY, e.radius)) e.y = nextY;

      for (let j = this.bullets.length - 1; j >= 0; j -= 1) {
        const b = this.bullets[j];
        if (Math.hypot(b.x - e.x, b.y - e.y) >= e.radius + b.radius) continue;

        e.health -= b.damage;
        this.bullets.splice(j, 1);
        this.burst(b.x, b.y, b.color, 3, 3);

        if (e.health <= 0) {
          this.killEnemy(i);
          break;
        }
      }
    }
  }

  updateParticles() {
    for (let i = this.particles.length - 1; i >= 0; i -= 1) {
      const p = this.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vx *= p.decay;
      p.vy *= p.decay;
      p.life -= 1;
      if (p.life <= 0) this.particles.splice(i, 1);
    }
  }

  // --- HUD mirror -----------------------------------------------------------

  cooldownRemaining(last, base) {
    const elapsed = Date.now() - last;
    const total = this.cooldownFor(base);
    return clamp(1 - elapsed / total, 0, 1);
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
    hud.missileCooldown = this.cooldownRemaining(this.lastMissileTime, MISSILE.cooldown);
    hud.shockCooldown = this.cooldownRemaining(this.lastShockTime, SHOCK.cooldown);
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
    missileCooldown: 0,
    shockCooldown: 0,
    running: false,
    gameOver: false,
    finalScore: 0,
    finalWave: 1,
  };
}
