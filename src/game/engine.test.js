import { describe, expect, it } from 'vitest';
import { Game, createHudState } from './engine.js';
import { dash as DASH, missile as MISSILE, shock as SHOCK } from './constants.js';

function makeGame() {
  const hud = createHudState();
  const events = [];
  const g = new Game(hud, (type, payload) => events.push({ type, payload }));
  g.start();
  return { g, hud, events };
}

describe('movement', () => {
  it('normalizes diagonal movement', () => {
    const { g } = makeGame();
    const x0 = g.player.x;
    const y0 = g.player.y;
    g.setKey('KeyW', true);
    g.setKey('KeyD', true);
    g.updatePlayer();
    const dx = g.player.x - x0;
    const dy = g.player.y - y0;
    const dist = Math.hypot(dx, dy);
    // Speed is 6 in any direction; diagonals must not be faster.
    expect(dist).toBeLessThanOrEqual(6.0001);
    expect(dist).toBeGreaterThan(5.9);
  });
});

describe('dash', () => {
  it('consumes a charge and recharges over ticks', () => {
    const { g } = makeGame();
    expect(g.dashCharges).toBe(DASH.maxCharges);
    g.dash();
    expect(g.dashCharges).toBe(DASH.maxCharges - 1);
    expect(g.player.isDashing).toBe(true);
    // Run out the dash then recharge fully.
    for (let i = 0; i < DASH.duration + 2; i += 1) g.update();
    for (let i = 0; i < DASH.cooldownTicks + 5; i += 1) g.updateCooldowns();
    expect(g.dashCharges).toBe(DASH.maxCharges);
  });

  it('refuses to dash with no charges', () => {
    const { g } = makeGame();
    g.dashCharges = 0;
    g.dashRecharge = 10;
    g.dash();
    expect(g.player.isDashing).toBe(false);
  });
});

describe('tick cooldowns', () => {
  it('missiles and shock use ticks, not wall clock', () => {
    const { g } = makeGame();
    g.fireMissiles();
    expect(g.missileCooldown).toBeGreaterThan(0);
    const m0 = g.missileCooldown;
    g.updateCooldowns();
    expect(g.missileCooldown).toBe(m0 - 1);
    g.shockWave();
    expect(g.shockCooldown).toBeGreaterThan(0);
    // Pausing freezes the sim (no auto-decrement outside update).
    const s0 = g.shockCooldown;
    g.pause();
    g.update();
    expect(g.shockCooldown).toBe(s0);
  });
});

describe('scaling caps', () => {
  it('caps enemy speed and health at high waves', () => {
    const { g } = makeGame();
    g.wave = 60;
    for (let i = 0; i < 20; i += 1) g.spawnEnemy();
    for (const e of g.enemies) {
      expect(e.speed).toBeLessThanOrEqual(4.3);
      expect(e.health).toBeLessThanOrEqual(8);
    }
  });

  it('caps particles', () => {
    const { g } = makeGame();
    for (let i = 0; i < 200; i += 1) g.burst(100, 100, '#fff', 25, 10);
    expect(g.particles.length).toBeLessThanOrEqual(800);
  });
});

describe('combo + shockwave', () => {
  it('multiplies score and resets on damage', () => {
    const { g } = makeGame();
    for (let i = 0; i < 8; i += 1) {
      g.enemies.push({
        x: 100, y: 100, radius: 10, speed: 1, health: 1, maxHealth: 1,
        color: '#fff', shape: 'diamond', pulse: 0,
        type: { name: 'NORMAL', score: 100 }, buff: null, drop: null,
        behavior: 'chase', seed: 1, state: 'chase', stateTimer: 0, lockAngle: 0, flash: 0, isBoss: false,
      });
      g.killEnemy(g.enemies.length - 1);
    }
    expect(g.multiplier).toBe(2);
    g.damagePlayer(10);
    expect(g.multiplier).toBe(1);
  });

  it('shockwave damages instead of clearing the field', () => {
    const { g } = makeGame();
    g.enemies.push({
      x: g.player.x + 100, y: g.player.y, radius: 16, speed: 1, health: 30, maxHealth: 30,
      color: '#fff', shape: 'diamond', pulse: 0,
      type: { name: 'NORMAL', score: 100 }, buff: null, drop: null,
      behavior: 'chase', seed: 1, state: 'chase', stateTimer: 0, lockAngle: 0, flash: 0, isBoss: false,
    });
    g.shockWave();
    expect(g.enemies.length).toBe(1);
    expect(g.enemies[0].health).toBeLessThan(30);
  });
});

describe('pickups + boss', () => {
  it('repair pickup heals', () => {
    const { g } = makeGame();
    g.player.health = 50;
    g.dropPickup(g.player.x, g.player.y, 'repair');
    g.updatePickups();
    expect(g.player.health).toBeGreaterThan(50);
  });

  it('spawns a boss on wave 5', () => {
    const { g } = makeGame();
    g.kills = 9;
    g.wave = 4;
    g.enemies.push({
      x: 100, y: 100, radius: 10, speed: 1, health: 1, maxHealth: 1,
      color: '#fff', shape: 'diamond', pulse: 0,
      type: { name: 'NORMAL', score: 100 }, buff: null, drop: null,
      behavior: 'chase', seed: 1, state: 'chase', stateTimer: 0, lockAngle: 0, flash: 0, isBoss: false,
    });
    g.killEnemy(g.enemies.length - 1);
    expect(g.wave).toBe(5);
    expect(g.enemies.some((e) => e.isBoss)).toBe(true);
  });
});

describe('iframes', () => {
  it('grants grace after a hit', () => {
    const { g } = makeGame();
    const hp = g.player.health;
    g.damagePlayer(10);
    expect(g.player.health).toBe(hp - 10);
    expect(g.player.iframes).toBeGreaterThan(0);
    g.damagePlayer(10);
    expect(g.player.health).toBe(hp - 10); // ignored during iframes
  });
});

export { MISSILE, SHOCK };
