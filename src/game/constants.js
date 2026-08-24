// Tunables and shared palette for the simulation. No DOM, no Vue.

export const WORLD_WIDTH = 2400;
export const WORLD_HEIGHT = 1600;

export const VIEW_WIDTH = 1200;
export const VIEW_HEIGHT = 700;

export const MINIMAP_SIZE = 150;

// Single source of truth for entity colors. The Tailwind theme in src/style.css
// mirrors these values so the HUD and the canvas always agree.
export const palette = {
  surface: '#09090b',
  grid: 'rgba(255, 255, 255, 0.045)',
  bounds: 'rgba(255, 255, 255, 0.14)',
  obstacle: '#17171b',
  obstacleEdge: 'rgba(255, 255, 255, 0.09)',
  player: '#38bdf8',
  playerDash: '#fafafa',
  bullet: '#e4e4e7',
  accent: '#38bdf8',
  danger: '#fb7185',
  skill: '#fbbf24',
  shock: '#34d399',
  missile: '#fb923c',
};

export const player = {
  radius: 18,
  speed: 6,
  maxHealth: 100,
  damageOnHit: 15,
  trailLength: 10,
};

export const bullet = {
  radius: 4,
  speed: 15,
  life: 60,
  energyCost: 5,
  recoil: 3,
  interval: 6, // frames between shots while fire is held
};

export const energy = {
  max: 100,
  regen: 0.2,
  regenBuffed: 0.5,
};

export const dash = {
  speed: 25,
  duration: 8,
  trailCount: 5,
  killPadding: 20,
};

export const missile = {
  cooldown: 5000,
  count: 10,
  countBuffed: 20,
  radius: 6,
  speed: 10,
  speedBuffed: 14,
  turnSpeed: 0.15,
  turnSpeedBuffed: 0.25,
  damage: 3,
  life: 180,
  spread: 0.15,
  recoil: 5,
};

export const shock = {
  cooldown: 15000,
  startRadius: 50,
  growth: 25,
  life: 30,
  killBonus: 500,
  healthBonus: 200,
};

export const BUFF_DURATION = 600; // frames, ~10s at 60fps

export const BUFFS = {
  SKILL: { label: 'Skill Enhanced', note: 'Triple shot, faster cooldowns', color: palette.skill },
  AMMO: { label: 'Infinite Ammo', note: 'No energy cost, faster regen', color: palette.accent },
};

export const ENEMY_TYPES = {
  NORMAL: {
    name: 'NORMAL',
    shape: 'diamond',
    color: palette.danger,
    health: 1,
    speed: 1,
    score: 100,
    buff: null,
    spawnChance: 0.6,
  },
  SKILL: {
    name: 'SKILL',
    shape: 'hexagon',
    color: palette.skill,
    health: 2,
    speed: 1.3,
    score: 300,
    buff: 'SKILL',
    spawnChance: 0.25,
  },
  AMMO: {
    name: 'AMMO',
    shape: 'square',
    color: palette.accent,
    health: 1,
    speed: 1.5,
    score: 250,
    buff: 'AMMO',
    spawnChance: 0.15,
  },
};

export const spawn = {
  baseInterval: 50,
  minInterval: 15,
  intervalStepPerWave: 4,
  killsPerWave: 10,
  obstacleCount: 15,
};
