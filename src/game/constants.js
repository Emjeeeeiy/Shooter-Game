// Tunables and shared palette for the simulation. No DOM, no Vue.
// All time-based values are in TICKS (60 ticks = 1s) so pause/hidden tabs stay in sync.

export const WORLD_WIDTH = 3600;
export const WORLD_HEIGHT = 2400;

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
  dragon: '#f43f5f',
  hydra: '#a3e635',
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
    unlockWave: 1,
    radius: 15,
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
    unlockWave: 4,
    radius: 16,
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
    unlockWave: 5,
    radius: 15,
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
    unlockWave: 3,
    radius: 17,
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
    unlockWave: 11,
    radius: 14,
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
    unlockWave: 13,
    radius: 21,
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
    unlockWave: 6,
    radius: 15,
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

// Boss roster. One appears every 20 waves, cycling in order and scaling
// with the number of bosses already slain.
export const BOSSES = [
  {
    id: 'dreadnought',
    name: 'Dreadnought',
    title: 'Siege Dreadnought',
    shape: 'octagon',
    color: palette.boss,
    radius: 44,
    baseHealth: 34,
    healthPerBoss: 12,
    speed: 0.9,
    score: 5000,
    contact: 25,
    behavior: 'boss',
    minion: 'NORMAL',
    minionInterval: 180,
    minionsPerSpawn: 4,
    note: 'Spawns fighter swarms',
  },
  {
    id: 'wyrm',
    name: 'Star-Wyrm',
    title: 'Ancient Star-Wyrm',
    shape: 'wyrm',
    color: palette.dragon,
    radius: 40,
    baseHealth: 30,
    healthPerBoss: 12,
    speed: 1.2,
    score: 6500,
    contact: 30,
    behavior: 'dragon',
    note: 'Telegraphs devastating lunges',
  },
  {
    id: 'hydra',
    name: 'Hydra',
    title: 'Hydra Matriarch',
    shape: 'pentagon',
    color: palette.hydra,
    radius: 46,
    baseHealth: 38,
    healthPerBoss: 12,
    speed: 0.7,
    score: 7000,
    contact: 25,
    behavior: 'hydra',
    note: 'Regenerates, splits into chargers',
  },
  {
    id: 'carrier',
    name: 'Void Carrier',
    title: 'Void Carrier',
    shape: 'hexagon',
    color: palette.magnet,
    radius: 48,
    baseHealth: 32,
    healthPerBoss: 12,
    speed: 0.85,
    score: 8000,
    contact: 20,
    behavior: 'carrier',
    minion: 'SNIPER',
    minionInterval: 240,
    minionsPerSpawn: 6,
    note: 'Keeps range, launches snipers',
  },
];

// Playable ships picked in the pre-game lobby. The engine reads these at
// reset() so every run uses the selected hull's stats.
export const CHARACTERS = {
  vanguard: {
    id: 'vanguard',
    name: 'Vanguard',
    title: 'Balanced Interceptor',
    desc: 'Reliable all-rounder. No weaknesses, no surprises.',
    color: '#38bdf8',
    speed: 6,
    maxHealth: 100,
    bulletDamage: 1,
    energyCost: 5,
    energyRegenMult: 1,
    dashCharges: 2,
    missileCdMult: 1,
    shockCdMult: 1,
    stats: { speed: 3, hull: 3, fire: 3, dash: 3 },
    passive: { name: 'Veteran', desc: '+15% score, longer combo window' },
    ultimate: { id: 'shock', name: 'Shockwave', desc: 'Heavy radial damage + knockback', cooldownTicks: 900 },
    scoreMult: 1.15,
    comboWindowMult: 1.25,
  },
  spectre: {
    id: 'spectre',
    name: 'Spectre',
    title: 'Swift Assassin',
    desc: 'Fragile but untouchable. Extra dash charge, faster guns.',
    color: '#c084fc',
    speed: 7.2,
    maxHealth: 75,
    bulletDamage: 1,
    energyCost: 4,
    energyRegenMult: 1.4,
    dashCharges: 3,
    missileCdMult: 0.85,
    shockCdMult: 1,
    stats: { speed: 5, hull: 2, fire: 3, dash: 5 },
    passive: { name: 'Executioner', desc: 'Double damage vs enemies under 25% HP' },
    ultimate: { id: 'rift', name: 'Void Rift', desc: 'Blast that slows all enemies', cooldownTicks: 600 },
    executeThreshold: 0.25,
  },
  juggernaut: {
    id: 'juggernaut',
    name: 'Juggernaut',
    title: 'Heavy Bruiser',
    desc: 'Slow tank with double-damage cannons. Takes a beating.',
    color: '#f97316',
    speed: 5.2,
    maxHealth: 150,
    bulletDamage: 2,
    energyCost: 6,
    energyRegenMult: 0.9,
    dashCharges: 2,
    missileCdMult: 1.1,
    shockCdMult: 1.1,
    stats: { speed: 2, hull: 5, fire: 5, dash: 2 },
    passive: { name: 'Heavy Plating', desc: 'Takes 30% less damage' },
    ultimate: { id: 'slam', name: 'Siege Slam', desc: 'Devastating close-range blast', cooldownTicks: 1080 },
    damageTakenMult: 0.7,
  },
  warden: {
    id: 'warden',
    name: 'Warden',
    title: 'Combat Support',
    desc: 'Fast regen, cheap shots, rapid missiles and shockwaves.',
    color: '#34d399',
    speed: 5.6,
    maxHealth: 110,
    bulletDamage: 1,
    energyCost: 3,
    energyRegenMult: 1.8,
    dashCharges: 2,
    missileCdMult: 0.8,
    shockCdMult: 0.7,
    stats: { speed: 2, hull: 4, fire: 2, dash: 3 },
    passive: { name: 'Field Medic', desc: 'Pickups 50% stronger' },
    ultimate: { id: 'restore', name: 'Restoration', desc: 'Heal + energy, burns nearby foes', cooldownTicks: 840 },
    pickupMult: 1.5,
  },
};

export const CHARACTER_LIST = Object.values(CHARACTERS);

export const spawn = {
  baseInterval: 55,
  minInterval: 16,
  intervalStepPerWave: 2,
  intervalStepPerTier: 6,
  killsPerWave: 10,
  obstacleCount: 26,
  maxEnemies: 60,
  maxSpeed: 4.2,
  maxHealth: 10,
  bossWaveEvery: 20,
};
