import { describe, expect, it } from 'vitest';
import { Game, createHudState } from './engine.js';
import { CHARACTER_LIST, WORLD_HEIGHT, WORLD_WIDTH, dash as DASH, missile as MISSILE, palette, shock as SHOCK } from './constants.js';

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
  it('missiles are cooldown-free; ultimates run flat 5s ticks', () => {
    const { g } = makeGame();
    g.energy = 100;
    g.fireMissiles();
    expect(g.missileCooldown).toBe(0);
    const n = g.missiles.length;
    g.fireMissiles();
    expect(g.missiles.length).toBeGreaterThan(n);
    g.shockWave();
    expect(g.shockCooldown).toBe(300);
    // Pausing freezes the sim (no auto-decrement outside update).
    g.pause();
    g.update();
    expect(g.shockCooldown).toBe(300);
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

  it('spectre blink strikes along its path', () => {
    const hud = createHudState();
    const g = new Game(hud, () => {});
    g.start('spectre', 11);
    g.obstacles = [];
    g.setPointer(900, 350); // aim +x
    enemyNear(g, 20);
    g.shockWave();
    expect(g.enemies[0].health).toBe(14);
    expect(g.player.x).toBeGreaterThan(1800);
    expect(g.shockWaves.length).toBeGreaterThanOrEqual(2);
  });

  it('spectre blink reaches farther now', () => {
    const hud = createHudState();
    const g = new Game(hud, () => {});
    g.start('spectre', 11);
    g.obstacles = [];
    g.setPointer(1200, 700); // far corner: capped at 650 range
    const x0 = g.player.x;
    const y0 = g.player.y;
    g.shockWave();
    expect(Math.hypot(g.player.x - x0, g.player.y - y0)).toBeCloseTo(650, 0);
  });

  it('juggernaut bull charge dashes through the horde', () => {
    const hud = createHudState();
    const g = new Game(hud, () => {});
    g.start('juggernaut', 11);
    g.obstacles = [];
    enemyNear(g, 1);
    g.shockWave();
    expect(g.player.isDashing).toBe(true);
    expect(g.player.dashTime).toBe(40);
    for (let t = 0; t < 3; t += 1) g.update();
    expect(g.enemies.length).toBe(0);
  });

  it('warden restoration heals over time and burns nearby foes', () => {
    const hud = createHudState();
    const g = new Game(hud, () => {});
    g.start('warden', 21);
    g.player.health = 50;
    g.player.iframes = 9999;
    g.enemies.push(minEnemy(g.player.x + 100, g.player.y, 30));
    const foe = g.enemies[0];
    g.shockWave();
    expect(g.regenTimer).toBe(300);
    expect(g.burnTimer).toBe(300);
    for (let t = 0; t < 60; t += 1) g.update();
    expect(g.player.health).toBeCloseTo(62);
    expect(foe.health).toBeLessThan(30);
  });

  it('warden cooldown waits out the aura, then drains', () => {
    const hud = createHudState();
    const g = new Game(hud, () => {});
    g.start('warden', 21);
    g.player.iframes = 9999;
    g.shockWave();
    expect(g.shockCooldown).toBe(300);
    for (let t = 0; t < 60; t += 1) g.update();
    expect(g.shockCooldown).toBe(300); // frozen while the aura burns
    for (let t = 0; t < 300; t += 1) g.update();
    expect(g.shockCooldown).toBeLessThan(300); // drains after expiry
  });

  it('bulwark cooldown waits out the rampart, then drains', () => {
    const hud = createHudState();
    const g = new Game(hud, () => {});
    g.start('bulwark', 21);
    g.player.iframes = 9999;
    g.shockWave();
    expect(g.shockCooldown).toBe(300);
    for (let t = 0; t < 60; t += 1) g.update();
    expect(g.shockCooldown).toBe(300); // frozen while the thorns hold
    for (let t = 0; t < 300; t += 1) g.update();
    expect(g.shockCooldown).toBeLessThan(300); // drains after expiry
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

describe('expanded roster', () => {
  it('every hull has a complete kit', () => {
    expect(CHARACTER_LIST.length).toBe(10);
    for (const c of CHARACTER_LIST) {
      expect(c.passive?.name).toBeTruthy();
      expect(c.ultimate?.id).toBeTruthy();
      expect(c.kit).toBeTruthy();
      expect(c.dash?.speed).toBeGreaterThan(0);
      expect(c.missiles?.count).toBeGreaterThan(0);
    }
  });

  it('phantom refunds dash kills, corsair plunders, oracle foresight holds', () => {
    let hud = createHudState();
    let g = new Game(hud, () => {});
    g.start('phantom', 21);
    g.enemies.push(minEnemy(g.player.x + 30, g.player.y, 1));
    g.dash();
    for (let t = 0; t < 3; t += 1) {
      g.update();
      g.pickups.length = 0;
    }
    expect(g.kills).toBe(1);
    expect(g.dashCharges).toBe(2);

    hud = createHudState();
    g = new Game(hud, () => {});
    g.start('corsair', 21);
    g.energy = 50;
    g.enemies.push(minEnemy());
    g.killEnemy(0);
    expect(g.energy).toBe(56);

    hud = createHudState();
    g = new Game(hud, () => {});
    g.start('oracle', 21);
    g.applyBuff('SKILL');
    expect(g.buffTimer).toBe(900);
  });

  it('stasis freezes, vortex drags, overdrive surges', () => {
    let hud = createHudState();
    let g = new Game(hud, () => {});
    g.start('phantom', 21);
    g.enemies.push(minEnemy(g.player.x + 100, g.player.y, 30));
    g.shockWave();
    expect(g.enemies[0]?.slowTimer).toBe(240);
    expect(g.enemies[0].health).toBe(27);
    expect(g.frostFlash).toBeGreaterThan(0);

    hud = createHudState();
    g = new Game(hud, () => {});
    g.start('corsair', 21);
    g.enemies.push(minEnemy(g.player.x + 500, g.player.y, 30));
    const ex = g.player.x + 500;
    const ey = g.player.y;
    g.shockWave();
    const after = Math.hypot(g.enemies[0].x - ex, g.enemies[0].y - ey);
    expect(g.enemies[0].health).toBeLessThan(30);
    expect(after).toBeGreaterThan(0);

    hud = createHudState();
    g = new Game(hud, () => {});
    g.start('oracle', 21);
    g.energy = 100;
    g.shockWave();
    expect(g.activeBuff).toBe('SKILL');
    expect(g.energy).toBe(100);
  });
});

describe('skill mana costs', () => {
  it('denies dash without energy and keeps the charge', () => {
    const { g } = makeGame();
    g.energy = 5;
    g.dash();
    expect(g.player.isDashing).toBe(false);
    expect(g.dashCharges).toBe(2);
  });

  it('denies missiles and ultimates without energy or cooldown', () => {
    const { g } = makeGame();
    g.energy = 5;
    g.fireMissiles();
    expect(g.missiles.length).toBe(0);
    expect(g.missileCooldown).toBe(0);
    g.shockWave();
    expect(g.shockCooldown).toBe(0);
    expect(g.shockWaves.length).toBe(0);
  });

  it('pays energy on cast', () => {
    const { g } = makeGame();
    g.energy = 100;
    g.dash();
    expect(g.energy).toBe(90);
    g.energy = 100;
    g.fireMissiles();
    expect(g.energy).toBe(75);
  });

  it('basic fire costs no mana', () => {
    const { g } = makeGame();
    g.energy = 40;
    for (let i = 0; i < 10; i += 1) g.fire();
    expect(g.energy).toBe(40);
    expect(g.bullets.length).toBeGreaterThan(0);
  });
});

describe('new ultimates', () => {
  it('bulwark rampart thorns attackers', () => {
    const hud = createHudState();
    const g = new Game(hud, () => {});
    g.start('bulwark', 21);
    g.player.health = 100;
    g.enemies.push(minEnemy(g.player.x + 20, g.player.y, 1));
    g.shockWave();
    expect(g.rampartTimer).toBe(300);
    expect(g.shockWaves.some((s) => s.shape === 'hex')).toBe(true);
    for (let t = 0; t < 3; t += 1) g.update(); // cast hit-stop freezes the first ticks
    expect(g.enemies.length).toBe(0);
    expect(g.player.health).toBeGreaterThanOrEqual(105);
  });

  it('hornet barrage bursts radially and frenzies', () => {
    const hud = createHudState();
    const g = new Game(hud, () => {});
    g.start('hornet', 21);
    g.shockWave();
    expect(g.bullets.length).toBe(24);
    expect(g.frenzyTimer).toBe(300);
  });

  it('titan annihilator roots the ship and beams where aimed', () => {
    const hud = createHudState();
    const g = new Game(hud, () => {});
    g.start('titan', 21);
    g.obstacles = [];
    g.setPointer(900, 350); // aim +x
    g.enemies.push(minEnemy(g.player.x + 300, g.player.y, 30));
    const foe = g.enemies[0];
    g.shockWave();
    expect(g.beamTimer).toBe(300);
    const x0 = g.player.x;
    g.setKey('KeyD', true);
    for (let t = 0; t < 5; t += 1) g.update();
    expect(g.player.x).toBe(x0); // rooted: no movement
    expect(foe.health).toBeLessThan(30); // beam burns along the aim
    // ...but the aim still tracks the pointer.
    g.setPointer(300, 350);
    g.update();
    expect(Math.abs(g.player.angle)).toBeGreaterThan(2);
  });
});

describe('seismic detonation', () => {
  it('charge detonates on wall impact', () => {
    const hud = createHudState();
    const g = new Game(hud, () => {});
    g.start('juggernaut', 31);
    g.obstacles = [];
    g.player.x = WORLD_WIDTH - 60;
    g.player.y = WORLD_HEIGHT / 2;
    g.updateCamera();
    g.enemies.push(minEnemy(3500, 1200, 5));
    g.setPointer(1200, 350);
    g.shockWave();
    expect(g.player.chargeDetonate).toBe(true);
    for (let t = 0; t < 3; t += 1) g.update();
    expect(g.player.isDashing).toBe(false);
    expect(g.enemies.length).toBe(0);
  });

  it('regular dashes never detonate on walls', () => {
    const hud = createHudState();
    const g = new Game(hud, () => {});
    g.start('juggernaut', 31);
    g.obstacles = [];
    g.player.x = WORLD_WIDTH - 60;
    g.player.y = WORLD_HEIGHT / 2;
    g.enemies.push(minEnemy(3500, 1200, 5));
    g.setPointer(1200, 350);
    g.dash();
    g.update();
    expect(g.player.isDashing).toBe(true);
    expect(g.enemies.length).toBe(1);
  });
});

describe('frenzy visuals', () => {
  it('frenzy turns the bullet stream gold', () => {
    const { g } = makeGame();
    g.frenzyTimer = 300;
    g.fire();
    expect(g.bullets[0].color).toBe(palette.skill);
  });

  it('bullets fly until they hit something', () => {
    const { g } = makeGame();
    g.obstacles = [];
    g.fire(); // straight +x toward the world edge, ~1800px away
    expect(g.bullets.length).toBe(1);
    for (let t = 0; t < 100; t += 1) g.updateBullets();
    expect(g.bullets.length).toBe(1); // no range expiry
    for (let t = 0; t < 200; t += 1) g.updateBullets();
    expect(g.bullets.length).toBe(0); // world edge still culls
  });

  it('vortex field grinds and holds cooldown', () => {
    const hud = createHudState();
    const g = new Game(hud, () => {});
    g.start('corsair', 21);
    g.player.iframes = 9999;
    g.shockWave();
    expect(g.vortexTimer).toBe(150);
    expect(g.shockCooldown).toBe(300);
    for (let t = 0; t < 60; t += 1) g.update();
    expect(g.shockCooldown).toBe(300); // frozen while the field grinds
    for (let t = 0; t < 200; t += 1) g.update();
    expect(g.shockCooldown).toBeLessThan(300); // drains after expiry
  });

  it('hornet cooldown waits out the frenzy, then drains', () => {
    const hud = createHudState();
    const g = new Game(hud, () => {});
    g.start('hornet', 21);
    g.player.iframes = 9999;
    g.shockWave();
    expect(g.shockCooldown).toBe(300);
    for (let t = 0; t < 60; t += 1) g.update();
    expect(g.shockCooldown).toBe(300); // frozen while guns are hot
    for (let t = 0; t < 300; t += 1) g.update();
    expect(g.shockCooldown).toBeLessThan(300); // drains after expiry
  });
});

describe('overdrive surge', () => {
  it('grants free skills with a held cooldown', () => {
    const hud = createHudState();
    const g = new Game(hud, () => {});
    g.start('oracle', 21);
    g.player.iframes = 9999;
    g.shockWave();
    expect(g.overdriveTimer).toBe(300);
    expect(g.activeBuff).toBe('SKILL');
    g.energy = 10;
    g.dash();
    expect(g.energy).toBe(10);
    expect(g.player.isDashing).toBe(true);
    g.fireMissiles();
    expect(g.energy).toBe(10);
    expect(g.missiles.length).toBeGreaterThan(0);
    for (let t = 0; t < 60; t += 1) g.update();
    expect(g.shockCooldown).toBe(300); // frozen while surging
    for (let t = 0; t < 300; t += 1) g.update();
    expect(g.shockCooldown).toBeLessThan(300); // drains after expiry
  });
});

export { MISSILE, SHOCK };
