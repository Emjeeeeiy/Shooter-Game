import {
  MINIMAP_SIZE,
  VIEW_HEIGHT,
  VIEW_WIDTH,
  WORLD_HEIGHT,
  WORLD_WIDTH,
  palette,
} from './constants.js';

const GRID = 100;

/**
 * Flat, low-contrast rendering: shape and value carry the information rather
 * than glow. A single soft shadow is kept on small fast objects (bullets,
 * missiles, the player) purely so they stay readable against the grid.
 */
export function draw(ctx, game) {
  const { camera } = game;

  ctx.clearRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);
  ctx.fillStyle = palette.surface;
  ctx.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);

  drawGrid(ctx, camera);
  drawBounds(ctx, camera);
  drawObstacles(ctx, game);
  drawParticles(ctx, game);
  drawTrail(ctx, game);
  drawShockWaves(ctx, game);
  drawBullets(ctx, game);
  drawMissiles(ctx, game);
  drawEnemies(ctx, game);
  drawPlayer(ctx, game);
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

function drawParticles(ctx, { particles, camera }) {
  for (const p of particles) {
    ctx.globalAlpha = Math.max(0, p.life / p.maxLife) * 0.85;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x - camera.x, p.y - camera.y, p.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawTrail(ctx, { player, camera }) {
  for (const t of player.trail) {
    ctx.globalAlpha = (t.life / 20) * 0.5;
    ctx.fillStyle = palette.player;
    ctx.beginPath();
    ctx.arc(t.x - camera.x, t.y - camera.y, player.radius * 0.55, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawShockWaves(ctx, { shockWaves, camera }) {
  ctx.lineWidth = 2;
  for (const s of shockWaves) {
    ctx.globalAlpha = Math.max(0, s.life / 30);
    ctx.strokeStyle = palette.shock;
    ctx.beginPath();
    ctx.arc(s.x - camera.x, s.y - camera.y, s.radius, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

function drawBullets(ctx, { bullets, camera }) {
  ctx.shadowBlur = 8;
  for (const b of bullets) {
    const x = b.x - camera.x;
    const y = b.y - camera.y;

    ctx.strokeStyle = b.color;
    ctx.globalAlpha = 0.35;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x - b.vx * 1.4, y - b.vy * 1.4);
    ctx.stroke();

    ctx.globalAlpha = 1;
    ctx.shadowColor = b.color;
    ctx.fillStyle = b.color;
    ctx.beginPath();
    ctx.arc(x, y, b.radius, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.shadowBlur = 0;
  ctx.globalAlpha = 1;
}

function drawMissiles(ctx, { missiles, camera }) {
  ctx.fillStyle = palette.missile;
  ctx.shadowColor = palette.missile;
  ctx.shadowBlur = 10;

  for (const m of missiles) {
    ctx.save();
    ctx.translate(m.x - camera.x, m.y - camera.y);
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
    const r = e.radius + Math.sin(e.pulse) * 1.5;

    ctx.fillStyle = e.color;
    ctx.globalAlpha = 0.9;
    tracePath(ctx, e.shape, x, y, r);
    ctx.fill();

    ctx.globalAlpha = 1;
    ctx.strokeStyle = e.color;
    ctx.lineWidth = 1.5;
    tracePath(ctx, e.shape, x, y, r + 3);
    ctx.stroke();

    if (e.health < e.maxHealth) {
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

function tracePath(ctx, shape, x, y, r) {
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

  const body = player.isDashing
    ? palette.playerDash
    : activeBuff === 'SKILL'
      ? palette.skill
      : palette.player;

  if (activeBuff || player.isDashing) {
    ctx.strokeStyle = body;
    ctx.globalAlpha = 0.4;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(x, y, player.radius + (player.isDashing ? 8 : 13), 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
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
}

export function drawMinimap(ctx, game) {
  const { camera, obstacles, enemies, missiles, player } = game;
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

  for (const e of enemies) {
    ctx.fillStyle = e.color;
    ctx.beginPath();
    ctx.arc(e.x * sx, e.y * sy, 2, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = player.isDashing ? palette.playerDash : palette.player;
  ctx.beginPath();
  ctx.arc(player.x * sx, player.y * sy, 3, 0, Math.PI * 2);
  ctx.fill();
}
