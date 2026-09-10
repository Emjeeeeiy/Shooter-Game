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
      expect(e.health).toBeLessThanOrEqual(10);
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

  it('spawns a boss on wave 20', () => {
    const { g } = makeGame();
    g.kills = 199;
    g.wave = 19;
    g.enemies.push({
      x: 100, y: 100, radius: 10, speed: 1, health: 1, maxHealth: 1,
      color: '#fff', shape: 'diamond', pulse: 0,
      type: { name: 'NORMAL', score: 100 }, buff: null, drop: null,
      behavior: 'chase', seed: 1, state: 'chase', stateTimer: 0, lockAngle: 0, flash: 0, isBoss: false,
    });
    g.killEnemy(g.enemies.length - 1);
    expect(g.wave).toBe(20);
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

function minEnemy(x = 100, y = 100, hp = 1) {
  return {
    x, y, radius: 15, speed: 1, health: hp, maxHealth: hp,
    color: '#fff', shape: 'diamond', pulse: 0,
    type: { name: 'NORMAL', score: 100 }, buff: null, drop: null,
    behavior: 'chase', seed: 1, state: 'chase', stateTimer: 0, lockAngle: 0,
    flash: 0, slowTimer: 0, isBoss: false,
  };
}

describe('threat tiers', () => {
  it('computes tiers and eases early waves', () => {
    const { g } = makeGame();
    g.wave = 1;
    expect(g.tier()).toBe(0);
    g.wave = 10;
    expect(g.tier()).toBe(0);
    g.wave = 11;
    expect(g.tier()).toBe(1);
    expect(g.spawnIntervalFor(1)).toBeGreaterThan(g.spawnIntervalFor(11));
  });

  it('announces a new tier with a patch-up', () => {
    const hud = createHudState();
    const events = [];
    const g = new Game(hud, (t, p) => events.push([t, p]));
    g.start();
    g.kills = 99;
    g.wave = 10;
    g.player.health = 40;
    g.enemies.push(minEnemy());
    g.killEnemy(g.enemies.length - 1);
    expect(g.wave).toBe(11);
    expect(g.player.health).toBeGreaterThan(40);
    expect(events.some(([t, p]) => t === 'banner' && String(p.text).includes('Threat'))).toBe(true);
  });

  it('keeps enemy size fixed at high waves', () => {
    const { g } = makeGame();
    g.wave = 30;
    for (let i = 0; i < 30; i += 1) g.spawnEnemy();
    expect(g.enemies.length).toBeGreaterThan(0);
    for (const e of g.enemies) {
      expect(e.radius).toBe(e.type.radius ?? 15);
    }
  });
});

describe('boss roster', () => {
  it('cycles boss types as bosses fall', () => {
    const { g } = makeGame();
    g.spawnBoss();
    const first = g.enemies.find((e) => e.isBoss);
    expect(first?.boss?.id).toBe('dreadnought');
    first.health = 1;
    g.damageEnemy(g.enemies.indexOf(first), 5);
    expect(g.bossesSlain).toBe(1);
    g.spawnBoss();
    const second = g.enemies.filter((e) => e.isBoss).pop();
    expect(second?.boss?.id).toBe('wyrm');
  });
});

describe('ship ultimates', () => {
  function enemyNear(g, hp = 20) {
    g.enemies.push(minEnemy(g.player.x + 100, g.player.y, hp));
    const e = g.enemies[g.enemies.length - 1];
    e.maxHealth = Math.max(hp, e.maxHealth);
  }

  it('spectre rift slows enemies', () => {
    const hud = createHudState();
    const g = new Game(hud, () => {});
    g.start('spectre');
    enemyNear(g);
    g.shockWave();
    expect(g.enemies[0]?.slowTimer).toBeGreaterThan(0);
  });

  it('juggernaut slam clears weak enemies', () => {
    const hud = createHudState();
    const g = new Game(hud, () => {});
    g.start('juggernaut');
    enemyNear(g, 5);
    g.shockWave();
    expect(g.enemies.length).toBe(0);
  });

  it('warden restoration heals', () => {
    const hud = createHudState();
    const g = new Game(hud, () => {});
    g.start('warden');
    g.player.health = 50;
    g.shockWave();
    expect(g.player.health).toBe(85);
  });
});

describe('ship passives', () => {
  it('vanguard earns bonus score', () => {
    const { g } = makeGame(); // vanguard by default
    g.enemies.push(minEnemy());
    g.killEnemy(g.enemies.length - 1);
    expect(g.score).toBeGreaterThan(100);
    expect(g.score).toBeLessThan(120);
  });

  it('juggernaut plating reduces damage', () => {
    const hud = createHudState();
    const g = new Game(hud, () => {});
    g.start('juggernaut');
    g.damagePlayer(10);
    expect(g.player.health).toBeCloseTo(143);
  });

  it('spectre executes weakened enemies', () => {
    const hud = createHudState();
    const g = new Game(hud, () => {});
    g.start('spectre');
    g.enemies.push(minEnemy(200, 200, 10));
    const e = g.enemies[g.enemies.length - 1];
    e.maxHealth = 40; // 10/40 = at the 25% threshold
    g.damageEnemy(g.enemies.length - 1, 4);
    expect(e.health).toBe(2); // doubled to 8
  });

  it('warden pickups are stronger', () => {
    const hud = createHudState();
    const g = new Game(hud, () => {});
    g.start('warden');
    g.player.health = 50;
    g.dropPickup(g.player.x, g.player.y, 'repair');
    g.updatePickups();
    expect(g.player.health).toBe(95);
  });
});

describe('arena maps', () => {
  it('generates the expected obstacle layouts', () => {
    const hud = createHudState();
    const g = new Game(hud, () => {});
    g.start('vanguard', 7, 'pillars');
    expect(g.mapId).toBe('pillars');
    expect(g.obstacles.length).toBe(8);
    g.start('vanguard', 7, 'debris');
    expect(g.mapId).toBe('debris');
    expect(g.obstacles.length).toBe(46);
    g.start('vanguard', 7, 'void');
    expect(g.mapId).toBe('void');
    expect(g.obstacles.length).toBe(4);
  });

  it('ignores unknown map ids and keeps spawn clear', () => {
    const { g } = makeGame();
    expect(g.mapId).toBe('grid');
    g.setMap('nope');
    expect(g.mapId).toBe('grid');
    const cx = 1800;
    const cy = 1200;
    for (const o of g.obstacles) {
      const nx = Math.max(o.x, Math.min(cx, o.x + o.width));
      const ny = Math.max(o.y, Math.min(cy, o.y + o.height));
      expect(Math.hypot(cx - nx, cy - ny)).toBeGreaterThanOrEqual(200);
    }
  });
});

describe('ship kits', () => {
  it('fires per-ship missile volleys', () => {
    const hud = createHudState();
    const g = new Game(hud, () => {});
    g.start('spectre', 11);
    g.fireMissiles();
    expect(g.missiles.length).toBe(6);
    expect(g.missiles[0].dmg).toBe(4);
    g.start('juggernaut', 11);
    g.fireMissiles();
    expect(g.missiles.length).toBe(14);
    expect(g.missiles[0].dmg).toBe(5);
  });

  it('spectre phase-steps longer', () => {
    const hud = createHudState();
    const g = new Game(hud, () => {});
    g.start('spectre', 11);
    g.dash();
    expect(g.player.dashTime).toBe(10);
  });

  it('juggernaut bull rush chips bosses harder', () => {
    const hud = createHudState();
    const g = new Game(hud, () => {});
    g.start('juggernaut', 11);
    g.spawnBoss(); // dreadnought, 34 hp
    const boss = g.enemies.find((e) => e.isBoss);
    boss.x = g.player.x + 40;
    boss.y = g.player.y;
    g.dash();
    g.update();
    expect(boss.health).toBe(24);
  });

  it('warden siphons hull from missile kills', () => {
    const hud = createHudState();
    const g = new Game(hud, () => {});
    g.start('warden', 11);
    g.obstacles = [];
    g.player.health = 50;
    g.enemies.push(minEnemy(g.player.x + 120, g.player.y, 1));
    g.fireMissiles();
    for (let t = 0; t < 40 && g.enemies.length > 0; t += 1) g.updateMissiles();
    expect(g.enemies.length).toBe(0);
    expect(g.player.health).toBe(52);
  });

  it('warden mend-dash heals on contact kills', () => {
    const hud = createHudState();
    const g = new Game(hud, () => {});
    g.start('warden', 11);
    g.player.health = 50;
    g.enemies.push(minEnemy(g.player.x + 30, g.player.y, 1));
    g.dash();
    for (let t = 0; t < 3; t += 1) {
      g.update();
      g.pickups.length = 0; // ignore random drops for an exact assertion
    }
    expect(g.player.health).toBe(54);
  });
});

export { MISSILE, SHOCK };
