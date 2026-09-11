import { describe, expect, it } from 'vitest';
import { Game, createHudState } from './engine.js';
import { CHARACTER_LIST, WORLD_HEIGHT, WORLD_WIDTH, dash as DASH, lightPalette, missile as MISSILE, palette, shock as SHOCK } from './constants.js';

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

  it('spectre blink strikes along its path and chains on hit', () => {
    const hud = createHudState();
    const g = new Game(hud, () => {});
    g.start('spectre', 11);
    g.obstacles = [];
    g.setPointer(900, 350); // aim +x
    enemyNear(g, 20);
    g.shockWave();
    expect(g.enemies[0].health).toBe(14);
    expect(g.player.x).toBeGreaterThan(1800);
    expect(g.shockCooldown).toBe(0); // the hit reset it
    expect(g.shockWaves.length).toBe(0); // no shockwave visuals
  });

  it('spectre blink costs 10 mana', () => {
    const hud = createHudState();
    const g = new Game(hud, () => {});
    g.start('spectre', 11);
    g.energy = 10;
    g.obstacles = [];
    g.setPointer(900, 350);
    g.shockWave();
    expect(g.player.x).toBeGreaterThan(1800); // cast went through
    expect(g.energy).toBe(0);
  });

  it('spectre blink is denied below 10 mana', () => {
    const hud = createHudState();
    const g = new Game(hud, () => {});
    g.start('spectre', 11);
    g.energy = 9;
    g.obstacles = [];
    g.setPointer(900, 350);
    g.shockWave();
    expect(g.player.x).toBe(1800); // denied, no blink
    expect(g.shockCooldown).toBe(0);
  });

  it('spectre blink travels farther now', () => {
    const hud = createHudState();
    const g = new Game(hud, () => {});
    g.start('spectre', 11);
    g.obstacles = [];
    g.setPointer(1200, 700);
    const x0 = g.player.x;
    const y0 = g.player.y;
    g.shockWave();
    expect(Math.hypot(g.player.x - x0, g.player.y - y0)).toBeCloseTo(694.6, 0);
    expect(g.shockCooldown).toBe(300); // no hit, no reset
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

  it('annihilator beam has no range limit without walls', () => {
    const hud = createHudState();
    const g = new Game(hud, () => {});
    g.start('titan', 21);
    g.obstacles = [];
    g.setPointer(900, 350); // aim +x
    g.enemies.push(minEnemy(g.player.x + 1500, g.player.y, 30));
    const foe = g.enemies[0];
    g.shockWave();
    for (let t = 0; t < 5; t += 1) g.update();
    expect(foe.health).toBeLessThan(30); // 1500px out — the old 900 cap would miss
    expect(g.beamLen).toBeGreaterThan(1500);
    expect(g.beamWall).toBe(false);
  });

  it('annihilator beam stops at the first wall', () => {    const hud = createHudState();
    const g = new Game(hud, () => {});
    g.start('titan', 21);
    g.obstacles = [
      { x: g.player.x + 500, y: g.player.y - 100, width: 60, height: 200 },
    ];
    g.setPointer(900, 350); // aim +x, straight into the wall
    g.enemies.push(minEnemy(g.player.x + 700, g.player.y, 30));
    const foe = g.enemies[0];
    g.shockWave();
    for (let t = 0; t < 5; t += 1) g.update();
    expect(g.beamWall).toBe(true);
    expect(g.beamLen).toBeLessThan(560); // stops at the wall face
    expect(foe.health).toBe(30); // shielded behind the wall
  });

  it('rival ghosts snap on first sight then glide to targets', () => {
    const { g } = makeGame();
    expect(g.rivals).toEqual([]);
    g.setRivals([{ uid: 'abc', x: 100, y: 100, a: 1, name: 'Roe', ship: 'spectre' }]);
    expect(g.rivals.length).toBe(1);
    expect(g.rivals[0].x).toBe(100); // first sight: no glide from the corner
    expect(g.rivals[0].color).toBeTruthy();
    g.setRivals([{ uid: 'abc', x: 200, y: 100, a: 1, name: 'Roe', ship: 'spectre' }]);
    expect(g.rivals[0].x).toBeLessThan(200); // glides, doesn't teleport
    for (let t = 0; t < 60; t += 1) g.updateRivals();
    expect(Math.abs(g.rivals[0].x - 200)).toBeLessThan(1);
    expect(Math.abs(g.rivals[0].y - 100)).toBeLessThan(1);
    g.setRivals([{ uid: 'abc', x: 200, y: 100, name: 'Roe', ship: 'nope' }]);
    expect(g.rivals[0].ship).toBe('vanguard'); // unknown hulls fall back
    g.setRivals([{ uid: 'abc' }]); // missing coords dropped
    expect(g.rivals.length).toBe(0);
  });
});

describe('shared-arena sync', () => {
  function snapEnemies(g) {
    return JSON.stringify(
      g.enemies.map((e) => [
        e.type.name,
        Math.round(e.x * 100) / 100,
        Math.round(e.y * 100) / 100,
        e.health,
        Math.round(e.speed * 1000) / 1000,
      ]),
    );
  }

  function syncedPair() {
    const mk = () => {
      const hud = createHudState();
      const g = new Game(hud, () => {});
      g.start('vanguard', 777, 'debris');
      return g;
    };
    return [mk(), mk()];
  }

  it('same seed + same ticks deal identical spawn waves', () => {
    const [a, b] = syncedPair();
    for (let t = 0; t < 400; t += 1) {
      a.update();
      b.update();
    }
    expect(a.enemies.length).toBeGreaterThan(0);
    expect(snapEnemies(a)).toBe(snapEnemies(b));
  });

  it('local rolls never perturb the shared schedule', () => {
    const [a, b] = syncedPair();
    for (let i = 0; i < 50; i += 1) a.rlocal();
    const sa = [];
    const sb = [];
    for (let i = 0; i < 20; i += 1) {
      sa.push(a.random());
      sb.push(b.random());
    }
    expect(sa).toEqual(sb);
    for (let t = 0; t < 400; t += 1) {
      a.update();
      b.update();
    }
    expect(snapEnemies(a)).toBe(snapEnemies(b));
  });

  it('skill uses raise fx markers for the multiplayer echo', () => {
    const { g } = makeGame();
    expect(g.fx).toBeNull();
    g.dash();
    expect(g.fx?.k).toBe('dash');
    const s1 = g.fx.s;
    g.fireMissiles();
    expect(g.fx?.k).toBe('missiles');
    expect(g.fx.s).toBeGreaterThan(s1);
    g.shockWave();
    expect(g.fx?.k).toBe('shock');
  });

  it('ghost fx echoes play once as local-only visuals', () => {
    const { g } = makeGame();
    const before = g.enemies.length;
    g.setRivals([{ uid: 'r1', x: 200, y: 200, a: 0, name: 'Roe', ship: 'vanguard', fx: { k: 'shock', s: 1, a: 0 } }]);
    expect(g.ghostRings.length).toBe(1);
    g.setRivals([{ uid: 'r1', x: 200, y: 200, a: 0, name: 'Roe', ship: 'vanguard', fx: { k: 'shock', s: 1, a: 0 } }]);
    expect(g.ghostRings.length).toBe(1); // same sequence: no replay
    expect(g.enemies.length).toBe(before); // echoes never touch gameplay
    g.setRivals([{ uid: 'r1', x: 200, y: 200, a: 0, name: 'Roe', ship: 'vanguard', fx: { k: 'missiles', s: 2, a: 0 } }]);
    expect(g.particles.length).toBeGreaterThan(0); // missile tracers are visual only
    expect(g.enemies.length).toBe(before);
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

describe('shared-arena aggro', () => {
  it('enemies chase the nearest pilot, teammate ghosts included', () => {
    const { g } = makeGame();
    g.obstacles = [];
    const px = g.player.x;
    const py = g.player.y;
    g.enemies.push(minEnemy(px + 200, py, 5));
    const e = g.enemies[0];
    // No ghosts: tracks you.
    expect(g.nearestPilot(e.x, e.y)).toEqual({ x: px, y: py });
    g.moveEnemy(e, 0);
    expect(e.x).toBeLessThan(px + 200);
    // Teammate ghost closer (above): tracks them instead.
    g.setRivals([{ uid: 'mate', x: px + 200, y: py - 150, a: 0, name: 'Mate', ship: 'vanguard' }]);
    const t = g.nearestPilot(e.x, e.y);
    expect(t.x).toBe(px + 200);
    expect(t.y).toBe(py - 150);
    const y0 = e.y;
    g.moveEnemy(e, 0);
    expect(e.y).toBeLessThan(y0);
    // Stale ghost (broadcast stopped): ignored again.
    g.rivals[0].seenAt = Date.now() - 20000;
    expect(g.nearestPilot(e.x, e.y)).toEqual({ x: px, y: py });
  });
});

describe('shared wave clock', () => {
  function racedPair() {
    const mk = () => {
      const hud = createHudState();
      const g = new Game(hud, () => {});
      g.start('vanguard', 777, 'debris', { race: true });
      return g;
    };
    return [mk(), mk()];
  }

  it('race waves advance on shared ticks, never on kills', () => {
    const [a, b] = racedPair();
    expect(a.raceClock).toBe(true);
    a.kills = 45; // head start must not matter
    a.enemies.push(minEnemy(a.player.x + 50, a.player.y, 1));
    a.killEnemy(0);
    expect(a.wave).toBe(1);
    a.player.iframes = 99999;
    b.player.iframes = 99999;
    for (let t = 0; t < 1600; t += 1) {
      a.update();
      b.update();
    }
    expect(a.wave).toBe(2);
    expect(b.wave).toBe(2);
  });

  it('both pilots meet the same boss on the shared schedule', () => {
    const [a, b] = racedPair();
    b.kills = 199;
    // Land inside wave 20 (ticks 28500–29999), not past it.
    for (const g of [a, b]) {
      g.player.iframes = 99999;
      g.tick = 19 * 1500 - 2;
    }
    for (let t = 0; t < 5; t += 1) {
      a.update();
      b.update();
    }
    expect(a.wave).toBe(20);
    expect(b.wave).toBe(20);
    const bossA = a.enemies.find((e) => e.isBoss);
    const bossB = b.enemies.find((e) => e.isBoss);
    expect(bossA?.type.name).toBe('DREADNOUGHT');
    expect(bossB?.type.name).toBe('DREADNOUGHT');
  });

  it('solo waves still advance on kills', () => {
    const { g } = makeGame();
    expect(g.raceClock).toBe(false);
    g.enemies.push(minEnemy(g.player.x + 50, g.player.y, 1));
    g.kills = 9;
    g.killEnemy(0);
    expect(g.wave).toBe(2);
  });
});

describe('shared swarm', () => {
  function racedArcade() {
    const hud = createHudState();
    const g = new Game(hud, () => {});
    g.start('vanguard', 777, 'debris', { race: true, mode: 'arcade' });
    expect(g.sharedSwarm()).toBe(true);
    g.player.iframes = 99999;
    return g;
  }

  function fullSnap(g) {
    return JSON.stringify(
      g.enemies.map((e) => [
        e.eid,
        e.type.name,
        Math.round(e.x * 100) / 100,
        Math.round(e.y * 100) / 100,
        e.health,
      ]),
    );
  }

  it('both pilots see identical enemies at identical spots', () => {
    const a = racedArcade();
    const b = racedArcade();
    for (let t = 0; t < 400; t += 1) {
      a.update();
      b.update();
    }
    expect(a.enemies.length).toBeGreaterThan(0);
    expect(fullSnap(a)).toBe(fullSnap(b));
    // Gate spawns carry deterministic ids.
    expect(a.enemies.every((e) => typeof e.eid === 'string')).toBe(true);
  });

  it('stages kills only for the shared arcade swarm', () => {
    const a = racedArcade();
    const foe = Object.assign(minEnemy(a.player.x + 50, a.player.y, 1), {
      eid: 's1',
      spawnT: 0,
      private: false,
    });
    a.enemies.push(foe);
    a.killEnemy(0);
    expect(a.drainKills()).toEqual(['s1']);
    expect(a.drainKills()).toEqual([]);

    // Solo never stages.
    const s = makeGame().g;
    s.enemies.push(Object.assign(minEnemy(100, 100, 1), { eid: 's1', spawnT: 0, private: false }));
    s.killEnemy(0);
    expect(s.drainKills()).toEqual([]);

    // Versus duels stay parallel (sabotage intake is private).
    const hud = createHudState();
    const v = new Game(hud, () => {});
    v.start('vanguard', 777, 'debris', { race: true, mode: 'versus' });
    expect(v.sharedSwarm()).toBe(false);
    v.spawnEnemy('CHARGER');
    v.killEnemy(0);
    expect(v.drainKills()).toEqual([]);
  });

  it('remote kills drop the local copy with no score', () => {
    const a = racedArcade();
    a.enemies.push(Object.assign(minEnemy(200, 200, 5), { eid: 's9', spawnT: 0, private: false }));
    expect(a.applyRemoteKill('s9')).toBe(true);
    expect(a.enemies.length).toBe(0);
    expect(a.score).toBe(0);
    expect(a.applyRemoteKill('missing')).toBe(false);
  });

  it('materializing warp-ins cannot be hit until solid', () => {
    const a = racedArcade();
    const foe = Object.assign(minEnemy(a.player.x + 40, a.player.y, 10), {
      eid: 's9',
      spawnT: 45,
      private: false,
    });
    a.enemies.push(foe);
    a.bullets.push({ x: foe.x, y: foe.y, vx: 0, vy: 0, radius: 4, damage: 5, color: '#fff', life: 60 });
    a.updateEnemies();
    expect(foe.health).toBe(10);
    expect(a.bullets.length).toBe(1);
    foe.spawnT = 0;
    a.updateEnemies();
    expect(foe.health).toBeLessThan(10);
    expect(a.bullets.length).toBe(0);
  });
});

describe('canvas theme', () => {
  it('light palette covers every dark palette key', () => {
    for (const key of Object.keys(palette)) {
      expect(lightPalette[key], `missing light color for ${key}`).toBeTruthy();
    }
    expect(lightPalette.surface).not.toBe(palette.surface);
  });

  it('engine swaps its active palette with lightMode', () => {
    const { g } = makeGame();
    expect(g.lightMode).toBe(false);
    expect(g.pal).toBe(palette);
    g.lightMode = true;
    g.update();
    expect(g.pal).toBe(lightPalette);
    g.lightMode = false;
    g.update();
    expect(g.pal).toBe(palette);
  });
});

export { MISSILE, SHOCK };
