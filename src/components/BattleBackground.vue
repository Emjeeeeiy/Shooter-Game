<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue';
import { CHARACTER_LIST, palette } from '../game/constants.js';
import { tracePath, traceShip } from '../game/renderer.js';

// Ambient backdrop: the four hulls dogfight drifting targets behind the
// login and menu screens. Purely cosmetic, paused when hidden.
const canvasRef = ref(null);

const FOES = [
  { shape: 'diamond', color: palette.danger, r: 13 },
  { shape: 'hexagon', color: palette.skill, r: 14 },
  { shape: 'square', color: palette.accent, r: 12 },
  { shape: 'triangle', color: palette.charger, r: 14 },
  { shape: 'cross', color: palette.sniper, r: 12 },
  { shape: 'pentagon', color: palette.splitter, r: 16 },
  { shape: 'plus', color: palette.repair, r: 12 },
];

let raf = 0;
let ctx = null;
let W = 0;
let H = 0;
let ships = [];
let foes = [];
let bullets = [];
let parts = [];

const rand = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

function sizeCanvas() {
  const canvas = canvasRef.value;
  if (!canvas) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
  const rect = canvas.parentElement.getBoundingClientRect();
  W = Math.max(320, rect.width);
  H = Math.max(320, rect.height);
  canvas.width = Math.round(W * dpr);
  canvas.height = Math.round(H * dpr);
  ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function newTarget(ship) {
  ship.tx = rand(W * 0.1, W * 0.9);
  ship.ty = rand(H * 0.15, H * 0.85);
}

function initActors() {
  ships = CHARACTER_LIST.map((c, i) => {
    const s = {
      id: c.id,
      color: c.color,
      x: rand(W * 0.2, W * 0.8),
      y: rand(H * 0.25, H * 0.75),
      vx: 0,
      vy: 0,
      angle: rand(0, Math.PI * 2),
      tx: 0,
      ty: 0,
      cool: rand(10, 40),
      speed: i === 1 ? 2.8 : i === 2 ? 1.7 : 2.2,
    };
    newTarget(s);
    return s;
  });
  foes = [];
  for (let i = 0; i < 14; i += 1) spawnFoe(true);
  bullets = [];
  parts = [];
}

function spawnFoe(anywhere = false) {
  const f = pick(FOES);
  const edge = Math.floor(rand(0, 4));
  const m = 30;
  const pos =
    edge === 0
      ? [rand(0, W), -m]
      : edge === 1
        ? [W + m, rand(0, H)]
        : edge === 2
          ? [rand(0, W), H + m]
          : [-m, rand(0, H)];
  foes.push({
    shape: f.shape,
    color: f.color,
    r: f.r,
    x: anywhere ? rand(0, W) : pos[0],
    y: anywhere ? rand(0, H) : pos[1],
    vx: 0,
    vy: 0,
    hp: Math.random() < 0.25 ? 2 : 1,
    flash: 0,
    wob: rand(0, 1000),
  });
}

function burst(x, y, color, n, speed) {
  for (let i = 0; i < n; i += 1) {
    if (parts.length > 220) parts.shift();
    const a = rand(0, Math.PI * 2);
    const s = rand(0.3, 1) * speed;
    parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: rand(18, 42), max: 42, color, size: rand(1, 3) });
  }
}

function nearestFoe(x, y, maxD) {
  let best = null;
  let bd = maxD;
  for (const f of foes) {
    const d = Math.hypot(f.x - x, f.y - y);
    if (d < bd) {
      bd = d;
      best = f;
    }
  }
  return best;
}

function step() {
  // Ships: wander between waypoints, shoot at nearby foes.
  for (const s of ships) {
    const dx = s.tx - s.x;
    const dy = s.ty - s.y;
    const d = Math.hypot(dx, dy) || 1;
    if (d < 60) newTarget(s);
    s.vx += ((dx / d) * s.speed - s.vx) * 0.04;
    s.vy += ((dy / d) * s.speed - s.vy) * 0.04;
    s.x += s.vx;
    s.y += s.vy;
    const want = Math.atan2(s.vy, s.vx);
    let diff = want - s.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    s.angle += diff * 0.08;

    s.cool -= 1;
    if (s.cool <= 0) {
      s.cool = rand(16, 42);
      const foe = nearestFoe(s.x, s.y, 520);
      if (foe && bullets.length < 60) {
        const a = Math.atan2(foe.y - s.y, foe.x - s.x);
        bullets.push({
          x: s.x + Math.cos(a) * 26,
          y: s.y + Math.sin(a) * 26,
          vx: Math.cos(a) * 8,
          vy: Math.sin(a) * 8,
          life: 55,
          color: s.id === 'spectre' ? palette.skill : '#e4e4e7',
        });
      }
    }
  }

  // Foes: drift toward the nearest ship.
  for (const f of foes) {
    let ns = ships[0];
    let nd = Infinity;
    for (const s of ships) {
      const d = Math.hypot(s.x - f.x, s.y - f.y);
      if (d < nd) {
        nd = d;
        ns = s;
      }
    }
    const wob = Math.sin((f.wob += 0.03)) * 0.6;
    const a = Math.atan2(ns.y - f.y, ns.x - f.x) + wob * 0.4;
    f.vx += (Math.cos(a) * 0.75 - f.vx) * 0.03;
    f.vy += (Math.sin(a) * 0.75 - f.vy) * 0.03;
    f.x += f.vx;
    f.y += f.vy;
    if (f.flash > 0) f.flash -= 1;
  }

  // Bullets vs foes.
  for (let i = bullets.length - 1; i >= 0; i -= 1) {
    const b = bullets[i];
    b.x += b.vx;
    b.y += b.vy;
    b.life -= 1;
    let dead = b.life <= 0 || b.x < -40 || b.x > W + 40 || b.y < -40 || b.y > H + 40;
    if (!dead) {
      for (let j = foes.length - 1; j >= 0; j -= 1) {
        const f = foes[j];
        if (Math.hypot(b.x - f.x, b.y - f.y) < f.r + 3) {
          f.hp -= 1;
          f.flash = 5;
          burst(b.x, b.y, b.color, 3, 3);
          dead = true;
          if (f.hp <= 0) {
            burst(f.x, f.y, f.color, 16, 6);
            foes.splice(j, 1);
          }
          break;
        }
      }
    }
    if (dead) bullets.splice(i, 1);
  }
  while (foes.length < 14) spawnFoe();

  for (let i = parts.length - 1; i >= 0; i -= 1) {
    const p = parts[i];
    p.x += p.vx;
    p.y += p.vy;
    p.vx *= 0.97;
    p.vy *= 0.97;
    p.life -= 1;
    if (p.life <= 0) parts.splice(i, 1);
  }
}

function render() {
  ctx.clearRect(0, 0, W, H);

  // Faint grid for depth.
  ctx.strokeStyle = 'rgba(255,255,255,0.035)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = 0.5; x < W; x += 90) {
    ctx.moveTo(x, 0);
    ctx.lineTo(x, H);
  }
  for (let y = 0.5; y < H; y += 90) {
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
  }
  ctx.stroke();

  for (const f of foes) {
    ctx.fillStyle = f.flash > 0 ? '#ffffff' : f.color;
    ctx.globalAlpha = 0.9;
    tracePath(ctx, f.shape, f.x, f.y, f.r + Math.sin(f.wob * 0.5) * 1.2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  for (const s of ships) {
    ctx.save();
    ctx.translate(s.x, s.y);
    ctx.rotate(s.angle);
    // Engine flicker.
    const flick = 7 + Math.random() * 7;
    ctx.fillStyle = 'rgba(251,146,60,0.75)';
    ctx.beginPath();
    ctx.moveTo(-13, 4);
    ctx.lineTo(-13 - flick, 0);
    ctx.lineTo(-13, -4);
    ctx.closePath();
    ctx.fill();
    ctx.shadowColor = s.color;
    ctx.shadowBlur = 14;
    ctx.fillStyle = s.color;
    traceShip(ctx, s.id);
    ctx.fill();
    ctx.restore();
  }
  ctx.shadowBlur = 0;

  for (const b of bullets) {
    ctx.strokeStyle = b.color;
    ctx.globalAlpha = 0.4;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(b.x, b.y);
    ctx.lineTo(b.x - b.vx * 1.2, b.y - b.vy * 1.2);
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.fillStyle = b.color;
    ctx.beginPath();
    ctx.arc(b.x, b.y, 3, 0, Math.PI * 2);
    ctx.fill();
  }

  for (const p of parts) {
    ctx.globalAlpha = Math.max(0, p.life / p.max) * 0.85;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function loop() {
  raf = requestAnimationFrame(loop);
  step();
  render();
}

function onResize() {
  sizeCanvas();
}

onMounted(() => {
  sizeCanvas();
  initActors();
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
    render(); // single static frame, no motion
    return;
  }
  window.addEventListener('resize', onResize);
  raf = requestAnimationFrame(loop);
});

onBeforeUnmount(() => {
  cancelAnimationFrame(raf);
  window.removeEventListener('resize', onResize);
});
</script>

<template>
  <div class="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden="true">
    <canvas ref="canvasRef" class="block h-full w-full opacity-70" />
    <!-- Readability gradient over the battle. -->
    <div
      class="absolute inset-0"
      style="
        background:
          radial-gradient(ellipse 90% 70% at 50% 40%, transparent 30%, rgba(9, 9, 11, 0.72) 100%),
          linear-gradient(180deg, rgba(9, 9, 11, 0.55) 0%, rgba(9, 9, 11, 0.25) 40%, rgba(9, 9, 11, 0.6) 100%);
      "
    />
  </div>
</template>
