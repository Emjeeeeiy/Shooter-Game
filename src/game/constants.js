// Tunables and shared palette for the simulation. No DOM, no Vue.
// All time-based values are in TICKS (60 ticks = 1s) so pause/hidden tabs stay in sync.

export const WORLD_WIDTH = 2400;
export const WORLD_HEIGHT = 1600;

export const VIEW_WIDTH = 1200;
export const VIEW_HEIGHT = 700;

export const MINIMAP_SIZE = 150;

export const TICKS_PER_SECOND = 60;

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
  repair: '#4ade80',
  magnet: '#a78bfa',
  boss: '#f472b6',
  charger: '#fb7185',
  sniper: '#e879f9',
  splitter: '#facc15',
  flash: '#ffffff',
};

export const player = {
  radius: 18,
  speed: 6,
  maxHealth: 100,
  damageOnHit: 15,
  trailLength: 10,
  iframesTicks: 45, // 0.75s grace after taking a hit
  knockback: 14,
};

export const bullet = {
  radius: 4,
  speed: 15,
  life: 60,
  energyCost: 5,
  recoil: 3,
  interval: 6, // ticks between shots while fire is held
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
  cooldownTicks: 72, // ~1.2s per charge
  maxCharges: 2,
};

export const missile = {
  cooldownTicks: 300, // 5s
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
  cooldownTicks: 900, // 15s
  startRadius: 50,
  growth: 25,
  life: 30,
  damage: 6,
  knockback: 22,
  maxRadius: 650,
};

export const combo = {
  windowTicks: 180, // 3s to keep chain alive
  killsPerStep: 8,
  maxMultiplier: 5,
};

export const pickups = {
  radius: 10,
  lifeTicks: 600, // 10s on the ground
  magnetRadius: 150,
  magnetBuffRadius: 280,
  repairAmount: 30,
  energyAmount: 40,
};

export const MAX_PARTICLES = 800;

export const BUFF_DURATION = 600; // ticks, ~10s at 60fps

export const BUFFS = {
  SKILL: { label: 'Skill Enhanced', note: 'Triple shot, faster cooldowns', color: palette.skill },
  AMMO: { label: 'Infinite Ammo', note: 'No energy cost, faster regen', color: palette.accent },
  MAGNET: { label: 'Magnet', note: 'Attracts pickups from afar', color: palette.magnet },
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
    drop: null,
    spawnChance: 0.35,
  },
  SKILL: {
    name: 'SKILL',
    shape: 'hexagon',
    color: palette.skill,
    health: 2,
    speed: 1.3,
    score: 300,
    buff: 'SKILL',
    drop: null,
    spawnChance: 0.15,
  },
  AMMO: {
    name: 'AMMO',
    shape: 'square',
    color: palette.accent,
    health: 1,
    speed: 1.5,
    score: 250,
    buff: 'AMMO',
    drop: null,
    spawnChance: 0.1,
  },
  CHARGER: {
    name: 'CHARGER',
    shape: 'triangle',
    color: palette.charger,
    health: 2,
    speed: 1.1,
    score: 350,
    buff: null,
    drop: null,
    spawnChance: 0.12,
    behavior: 'charger',
  },
  SNIPER: {
    name: 'SNIPER',
    shape: 'cross',
    color: palette.sniper,
    health: 1,
    speed: 1.6,
    score: 300,
    buff: null,
    drop: null,
    spawnChance: 0.1,
    behavior: 'sniper',
  },
  SPLITTER: {
    name: 'SPLITTER',
    shape: 'pentagon',
    color: palette.splitter,
    health: 3,
    speed: 0.8,
    score: 400,
    buff: null,
    drop: null,
    spawnChance: 0.08,
    behavior: 'splitter',
  },
  REPAIR: {
    name: 'REPAIR',
    shape: 'plus',
    color: palette.repair,
    health: 1,
    speed: 1.2,
    score: 200,
    buff: null,
    drop: 'repair',
    spawnChance: 0.1,
  },
};

export const BOSS = {
  name: 'BOSS',
  shape: 'octagon',
  color: palette.boss,
  radius: 44,
  baseHealth: 40,
  healthPerWave: 4,
  speed: 0.9,
  score: 5000,
  contactDamage: 25,
  minionIntervalTicks: 180,
  minionsPerSpawn: 4,
};

export const spawn = {
  baseInterval: 50,
  minInterval: 15,
  intervalStepPerWave: 4,
  killsPerWave: 10,
  obstacleCount: 15,
  maxEnemies: 60,
  maxSpeed: 4.2,
  maxHealth: 8,
  bossWaveEvery: 5,
};
