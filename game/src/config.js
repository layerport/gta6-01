// Solmar City — tuning numbers, palette and city layout in one place.
// The world is a fixed 3200 x 2400 coastal city; the renderer follows the
// player with a camera, so no rule here depends on the screen size.
export const WORLD = { width: 3200, height: 2400 };

// Roads run on a grid: avenues every 400 units, 96 wide, with sidewalks.
export const ROAD_STEP = 400;
export const ROAD_FIRST = 200;
export const ROAD_WIDTH = 96;
export const ROAD_LINES = [200, 600, 1000, 1400, 1800, 2200, 2600, 3000];

export const STEP = 1 / 60;
export const SAVE_KEY = 'solmar-city.save.v1';
export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

export const PLAYER = {
  radius: 16,
  walkSpeed: 265,
  accel: 2400,
  friction: 2200,
  health: 100,
  startMoney: 250,
  startAmmo: 30,
  punchRange: 52,
  punchDamage: 1,
  fireRate: 0.17,
  bulletSpeed: 780,
  regenPerSec: 2,
};

export const CAR = {
  length: 64,
  width: 32,
  accel: 420,
  brake: 700,
  reverseTop: 160,
  drag: 0.55,
  grip: 3.2,
};

export const WANTED = {
  // Heat thresholds that raise the star level (0..5).
  thresholds: [0, 25, 60, 110, 170, 240],
  maxStars: 5,
  decayDelay: 14,
  decayPerSec: 4,
  stealHeat: 20,
  killPedHeat: 35,
  killCopHeat: 60,
  shootHeat: 6,
  hitPedHeat: 25,
};

export const MISSIONS = [
  {
    id: 'first-wheels',
    title: 'First Wheels',
    giver: 'Lena Marlowe',
    reward: 500,
    brief: [
      'LENA: Dario. You want work in Solmar, you need wheels first.',
      'LENA: Any car on the street will do. Borrow one. Permanently.',
      'LENA: Then bring it to my garage — the yellow wrench on your map.',
    ],
  },
  {
    id: 'dockside-payback',
    title: 'Dockside Payback',
    giver: 'Lena Marlowe',
    reward: 800,
    brief: [
      'LENA: The Kessler crew torched my cousin’s truck at the docks.',
      'LENA: Four of Vic Kessler’s thugs are still there, counting cash.',
      'LENA: Go settle it. Take the package they stole — then come home.',
    ],
  },
  {
    id: 'marina-getaway',
    title: 'Marina Getaway',
    giver: 'Lena Marlowe',
    reward: 1200,
    brief: [
      'LENA: Last job, Dario. A package is waiting at the marina.',
      'LENA: Grab it and the whole Solmar PD will be on your tail.',
      'LENA: Lose them and get it to the safehouse. Then Solmar is ours.',
    ],
  },
];

export const LANDMARKS = {
  garage: { x: 1400, y: 1240, name: "Lena's Garage" },
  docks: { x: 320, y: 1500, name: 'Solmar Docks' },
  marina: { x: 2920, y: 1820, name: 'Marina Del Sol' },
  safehouse: { x: 900, y: 620, name: 'Safehouse' },
  plaza: { x: 1800, y: 1000, name: 'Plaza del Sol' },
};

export const PALETTE = {
  grass: '#7fae5a',
  grassDark: '#6f9c4c',
  sand: '#e8d29a',
  water: '#2f7fb8',
  waterDeep: '#256b9e',
  sidewalk: '#b9b3a4',
  road: '#3a3d44',
  roadLine: '#e8d44d',
  curb: '#8f8a7c',
  text: '#f4f1e8',
  muted: '#cfc9b8',
  hudPanel: 'rgba(12, 16, 24, 0.72)',
  hudAccent: '#ffc93c',
  player: '#e84c3d',
  playerDark: '#a93226',
  police: '#e8e8e8',
  marker: '#ffc93c',
};

export const CAR_MODELS = [
  { name: 'Comet', color: '#d94f3d', top: 520, accel: 430, handling: 3.4 },
  { name: 'Brisa', color: '#3d7dd9', top: 470, accel: 400, handling: 3.0 },
  { name: 'Tortuga', color: '#e8b23d', top: 430, accel: 360, handling: 2.8 },
  { name: 'Vela', color: '#7a4fd0', top: 500, accel: 420, handling: 3.2 },
  { name: 'Camion', color: '#4d9e57', top: 400, accel: 330, handling: 2.5 },
  { name: 'Fulgor', color: '#22252b', top: 580, accel: 480, handling: 3.8 },
];
export const POLICE_MODEL = { name: 'Interceptor', color: '#e8e8e8', top: 560, accel: 470, handling: 3.6 };

export const PED_SHIRTS = ['#e8e8e8', '#3d7dd9', '#e8b23d', '#4d9e57', '#d94f8a', '#7a4fd0', '#e8d44d', '#5bc0be'];
export const PED_PANTS = ['#2b2f38', '#4a3b2a', '#3a4a6b', '#5b5b5b'];
