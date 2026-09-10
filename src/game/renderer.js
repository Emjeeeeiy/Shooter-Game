import {
  MINIMAP_SIZE,
  VIEW_HEIGHT,
  VIEW_WIDTH,
  WORLD_HEIGHT,
  WORLD_WIDTH,
  palette,
} from './constants.js';

const GRID = 100;

const onScreen = (x, y, margin, camera) =>
  x > -margin && x < VIEW_WIDTH + margin && y > -margin && y < VIEW_HEIGHT + margin;

/**
 * Flat, low-contrast rendering with culled draws and cheap glow.
 * shadowBlur is reserved for the player + missiles only (biggest cost);
 * bullets use a tracer stroke instead so 100+ bullets stay at 60fps.
 */
export function draw(ctx, game) {
  const { camera } = game;

  ctx.clearRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);
  ctx.fillStyle = palette.surface;
  ctx.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);

  drawGrid(ctx, camera);
  drawBounds(ctx, camera);
  drawObstacles(ctx, game);
  drawPickups(ctx, game);
  drawParticles(ctx, game);
  drawTrail(ctx, game);
  drawShockWaves(ctx, game);
  drawBullets(ctx, game);
  drawMissiles(ctx, game);
  drawEnemies(ctx, game);
  drawPlayer(ctx, game);
  drawLowHpVignette(ctx, game);
}

function drawGrid(ctx, camera) {
  ctx.strokeStyle = palette.grid;
  ctx.lineWidth = 1;
  ctx.beginPath();

  for (let x = -camera.x % GRID; x < VIEW_WIDTH; x += GRID) {
    ctx.moveTo(Math.round(x) + 0.5, 0);
    ctx.lineTo(Math.round(x) + 0.5, VIEW_HEIGHT);
  }
  for (let y = -camera.y % GRID; y < VIEW_HEIGHT; y += GRID) {
    ctx.moveTo(0, Math.round(y) + 0.5);
    ctx.lineTo(VIEW_WIDTH, Math.round(y) + 0.5);
  }
  ctx.stroke();
}

function drawBounds(ctx, camera) {
  ctx.strokeStyle = palette.bounds;
  ctx.lineWidth = 2;
  ctx.strokeRect(-camera.x, -camera.y, WORLD_WIDTH, WORLD_HEIGHT);
}

function drawObstacles(ctx, { obstacles, camera }) {
  ctx.fillStyle = palette.obstacle;
  ctx.strokeStyle = palette.obstacleEdge;
  ctx.lineWidth = 1;

  for (const o of obstacles) {
    const x = o.x - camera.x;
    const y = o.y - camera.y;
    if (x + o.width < 0 || x > VIEW_WIDTH || y + o.height < 0 || y > VIEW_HEIGHT) continue;

    ctx.fillRect(x, y, o.width, o.height);
    ctx.strokeRect(x + 0.5, y + 0.5, o.width - 1, o.height - 1);
  }
}

function drawPickups(ctx, { pickups, camera }) {
  for (const pk of pickups) {
    const x = pk.x - camera.x;
    const y = pk.y - camera.y;
    if (!onScreen(x, y, 30, camera)) continue;
    const color =
      pk.kind === 'repair' ? palette.repair : pk.kind === 'energy' ? palette.accent : palette.magnet;
    const blink = pk.life < 120 ? (Math.floor(pk.life / 8) % 2 === 0 ? 0.35 : 1) : 1;
    const r = 9 + Math.sin(pk.pulse) * 1.5;

    ctx.globalAlpha = blink;
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(x, y, r + 3, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = color;
    if (pk.kind === 'repair') {
      ctx.fillRect(x - 2, y - 6, 4, 12);
      ctx.fillRect(x - 6, y - 2, 12, 4);
    } else if (pk.kind === 'energy') {
      ctx.beginPath();
      ctx.moveTo(x + 2, y - 7);
      ctx.lineTo(x - 3, y + 1);
      ctx.lineTo(x, y + 1);
      ctx.lineTo(x - 2, y + 7);
      ctx.lineTo(x + 3, y - 1);
      ctx.lineTo(x, y - 1);
      ctx.closePath();
      ctx.fill();
    } else {
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(x, y, 7, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
}

function drawParticles(ctx, { particles, camera }) {
  for (const p of particles) {
    const x = p.x - camera.x;
    const y = p.y - camera.y;
    if (!onScreen(x, y, 10, camera)) continue;
    ctx.globalAlpha = Math.max(0, p.life / p.maxLife) * 0.85;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(x, y, p.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawTrail(ctx, { player, camera }) {
  for (const t of player.trail) {
    const x = t.x - camera.x;
    const y = t.y - camera.y;
    if (!onScreen(x, y, 30, camera)) continue;
    ctx.globalAlpha = (t.life / 20) * 0.5;
    ctx.fillStyle = palette.player;
    ctx.beginPath();
    ctx.arc(x, y, player.radius * 0.55, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawShockWaves(ctx, { shockWaves, camera }) {
  ctx.lineWidth = 3;
  for (const s of shockWaves) {
    const x = s.x - camera.x;
    const y = s.y - camera.y;
    ctx.globalAlpha = Math.max(0, s.life / 30);
    ctx.strokeStyle = palette.shock;
    ctx.beginPath();
    ctx.arc(x, y, s.radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = Math.max(0, s.life / 30) * 0.35;
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.arc(x, y, Math.max(1, s.radius - 10), 0, Math.PI * 2);
    ctx.stroke();
    ctx.lineWidth = 3;
  }
  ctx.globalAlpha = 1;
}

function drawBullets(ctx, { bullets, camera }) {
  // No shadowBlur here — tracer stroke reads as glow at a fraction of the cost.
  for (const b of bullets) {
    const x = b.x - camera.x;
    const y = b.y - camera.y;
    if (!onScreen(x, y, 40, camera)) continue;

    ctx.strokeStyle = b.color;
    ctx.globalAlpha = 0.35;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x - b.vx * 1.4, y - b.vy * 1.4);
    ctx.stroke();

    ctx.globalAlpha = 1;
    ctx.fillStyle = b.color;
    ctx.beginPath();
    ctx.arc(x, y, b.radius, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawMissiles(ctx, { missiles, camera }) {
  ctx.fillStyle = palette.missile;
  ctx.shadowColor = palette.missile;
  ctx.shadowBlur = 10;

  for (const m of missiles) {
    const x = m.x - camera.x;
    const y = m.y - camera.y;
    if (!onScreen(x, y, 30, camera)) continue;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(Math.atan2(m.vy, m.vx));

    ctx.beginPath();
    ctx.moveTo(10, 0);
    ctx.lineTo(-6, 4);
    ctx.lineTo(-6, -4);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  }
  ctx.shadowBlur = 0;
}

function drawEnemies(ctx, { enemies, camera }) {
  for (const e of enemies) {
    const x = e.x - camera.x;
    const y = e.y - camera.y;
    if (!onScreen(x, y, e.radius + 30, camera)) continue;
    const telegraph = e.behavior === 'charger' && e.state === 'telegraph';
    const r = e.radius + Math.sin(e.pulse) * 1.5 + (telegraph ? 2.5 : 0);

    const body = e.flash > 0 ? palette.flash : e.color;
    ctx.fillStyle = body;
    ctx.globalAlpha = 0.9;
    tracePath(ctx, e.shape, x, y, r, e);
    ctx.fill();

    ctx.globalAlpha = 1;
    ctx.strokeStyle = telegraph ? palette.flash : e.color;
    ctx.lineWidth = e.isBoss ? 2.5 : 1.5;
    tracePath(ctx, e.shape, x, y, r + 3, e);
    ctx.stroke();

    if (e.isBoss) {
      // Boss HP bar + telegraph ring
      const w = 110;
      const top = y - e.radius - 18;
      ctx.fillStyle = 'rgba(255,255,255,0.14)';
      ctx.fillRect(x - w / 2, top, w, 5);
      ctx.fillStyle = e.color;
      ctx.fillRect(x - w / 2, top, w * Math.max(0, e.health / e.maxHealth), 5);
    } else if (e.health < e.maxHealth) {
      const w = e.radius * 2;
      const top = y - e.radius - 10;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.14)';
      ctx.fillRect(x - w / 2, top, w, 2);
      ctx.fillStyle = e.color;
      ctx.fillRect(x - w / 2, top, w * (e.health / e.maxHealth), 2);
    }
  }
  ctx.globalAlpha = 1;
}

function tracePath(ctx, shape, x, y, r, e = null) {
  ctx.beginPath();

  if (shape === 'hexagon') {
    for (let i = 0; i < 6; i += 1) {
      const a = (i * Math.PI) / 3;
      const px = x + Math.cos(a) * r;
      const py = y + Math.sin(a) * r;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
  } else if (shape === 'square') {
    const s = r * 0.9;
    ctx.rect(x - s, y - s, s * 2, s * 2);
  } else if (shape === 'triangle') {
    const a = e ? Math.atan2(0, 1) : 0;
    for (let i = 0; i < 3; i += 1) {
      const t = a + (i * Math.PI * 2) / 3 - Math.PI / 2;
      const px = x + Math.cos(t) * r;
      const py = y + Math.sin(t) * r;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
  } else if (shape === 'cross') {
    const s = r * 0.55;
    ctx.moveTo(x - s, y - s);
    ctx.lineTo(x - s, y + s);
    ctx.lineTo(x + s, y + s);
    ctx.lineTo(x + s, y - s);
    ctx.closePath();
    ctx.moveTo(x, y - r);
    ctx.lineTo(x, y + r);
    ctx.moveTo(x - r, y);
    ctx.lineTo(x + r, y);
  } else if (shape === 'pentagon') {
    for (let i = 0; i < 5; i += 1) {
      const a = (i * Math.PI * 2) / 5 - Math.PI / 2;
      const px = x + Math.cos(a) * r;
      const py = y + Math.sin(a) * r;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
  } else if (shape === 'plus') {
    const s = r * 0.45;
    ctx.rect(x - s / 2, y - r, s, r * 2);
    ctx.rect(x - r, y - s / 2, r * 2, s);
  } else if (shape === 'octagon') {
    for (let i = 0; i < 8; i += 1) {
      const a = (i * Math.PI) / 4 + (e ? e.pulse * 0.2 : 0);
      const px = x + Math.cos(a) * r;
      const py = y + Math.sin(a) * r;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
  } else {
    ctx.moveTo(x, y - r);
    ctx.lineTo(x + r, y);
    ctx.lineTo(x, y + r);
    ctx.lineTo(x - r, y);
    ctx.closePath();
  }
}

function drawPlayer(ctx, game) {
  const { player, camera, activeBuff } = game;
  const x = player.x - camera.x;
  const y = player.y - camera.y;

  const body =
    player.flash > 0
      ? palette.flash
      : player.isDashing
        ? palette.playerDash
        : activeBuff === 'SKILL'
          ? palette.skill
          : activeBuff === 'MAGNET'
            ? palette.magnet
            : palette.player;

  // I-frame blink
  if (player.iframes > 0 && Math.floor(player.iframes / 4) % 2 === 0) ctx.globalAlpha = 0.45;

  if (activeBuff || player.isDashing) {
    ctx.strokeStyle = body;
    ctx.globalAlpha *= 0.4;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(x, y, player.radius + (player.isDashing ? 8 : 13), 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = player.iframes > 0 && Math.floor(player.iframes / 4) % 2 === 0 ? 0.45 : 1;
  }

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(player.angle);

  ctx.shadowColor = body;
  ctx.shadowBlur = 12;
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.moveTo(22, 0);
  ctx.lineTo(-13, 13);
  ctx.lineTo(-8, 0);
  ctx.lineTo(-13, -13);
  ctx.closePath();
  ctx.fill();
  ctx.shadowBlur = 0;

  ctx.fillStyle = palette.surface;
  ctx.beginPath();
  ctx.arc(-9, 0, 5, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
  ctx.globalAlpha = 1;
}

function drawLowHpVignette(ctx, game) {
  const hp = game.player.health / 100;
  if (hp > 0.35) return;
  const a = (0.35 - hp) * 1.6;
  const grad = ctx.createRadialGradient(
    VIEW_WIDTH / 2, VIEW_HEIGHT / 2, VIEW_HEIGHT * 0.36,
    VIEW_WIDTH / 2, VIEW_HEIGHT / 2, VIEW_HEIGHT * 0.75,
  );
  grad.addColorStop(0, 'rgba(251,113,133,0)');
  grad.addColorStop(1, `rgba(251,113,133,${Math.min(0.45, a).toFixed(3)})`);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);
}

export function drawMinimap(ctx, game) {
  const { camera, obstacles, enemies, missiles, pickups, player } = game;
  const sx = MINIMAP_SIZE / WORLD_WIDTH;
  const sy = MINIMAP_SIZE / WORLD_HEIGHT;

  ctx.clearRect(0, 0, MINIMAP_SIZE, MINIMAP_SIZE);

  ctx.fillStyle = 'rgba(255, 255, 255, 0.06)';
  for (const o of obstacles) {
    ctx.fillRect(o.x * sx, o.y * sy, Math.max(1, o.width * sx), Math.max(1, o.height * sy));
  }

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.16)';
  ctx.lineWidth = 1;
  ctx.strokeRect(camera.x * sx, camera.y * sy, camera.width * sx, camera.height * sy);

  ctx.fillStyle = palette.missile;
  for (const m of missiles) {
    ctx.fillRect(m.x * sx - 1, m.y * sy - 1, 2, 2);
  }

  for (const pk of pickups) {
    ctx.fillStyle = pk.kind === 'repair' ? palette.repair : pk.kind === 'energy' ? palette.accent : palette.magnet;
    ctx.fillRect(pk.x * sx - 1, pk.y * sy - 1, 2, 2);
  }

  for (const e of enemies) {
    ctx.fillStyle = e.color;
    if (e.isBoss) {
      ctx.beginPath();
      ctx.arc(e.x * sx, e.y * sy, 4, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.beginPath();
      ctx.arc(e.x * sx, e.y * sy, 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  ctx.fillStyle = player.isDashing ? palette.playerDash : palette.player;
  ctx.beginPath();
  ctx.arc(player.x * sx, player.y * sy, 3, 0, Math.PI * 2);
  ctx.fill();
}
