// The game state and the one step that advances it: the clock, the player,
// traffic, pedestrians, police, combat, missions, particles and the camera.
// Modules own their jobs; this file only builds the state and calls them in
// order, and reports what happened as event flags.
import { LANDMARKS, PLAYER, STEP, WORLD } from './config.js';
import { createRandom, clamp, dist } from './random.js';
import { generateCity } from './city.js';
import { createAudio } from './audio.js';
import { ACTION_INTERACT, ACTION_MELEE } from './input.js';
import { updatePlayer } from './player.js';
import { spawnParkedCars, spawnTraffic, updateTraffic } from './vehicles.js';
import { spawnPedestrians, updatePedestrians } from './pedestrians.js';
import { updatePolice, wantedStars } from './police.js';
import { playerMelee, playerShoot, updateBullets, updateEnemies } from './combat.js';
import { spawnPickups, startMission, updateMissions } from './missions.js';

export const EVENT_BUSTED = 2;
export const EVENT_WASTED = 4;
export const EVENT_HURT = 16;
export const EVENT_MISSION = 32;

export function createGame(seed, audio) {
  const rng = createRandom(seed);
  const city = generateCity(rng);
  const state = {
    seed,
    rng,
    city,
    audio: audio || createAudio(),
    elapsed: 0,
    clock: 9 * 60, // minutes after midnight: the game opens at 9 in the morning
    events: 0,
    player: {
      x: LANDMARKS.garage.x + 60, y: LANDMARKS.garage.y + 80,
      vx: 0, vy: 0, angle: -Math.PI / 2,
      health: PLAYER.health, money: PLAYER.startMoney, ammo: PLAYER.startAmmo,
      onFoot: true, car: null, speed: 0,
      fireCooldown: 0, meleeCooldown: 0, walkPhase: 0,
    },
    cars: [],
    peds: [],
    pedTarget: 26,
    cops: [],
    copSpawnT: 0,
    bullets: [],
    enemies: [],
    particles: [],
    skids: [],
    pickups: [],
    heat: 0,
    wanted: 0,
    crimeTimer: 99,
    lastShotX: 0, lastShotY: 0, lastShotT: 0,
    mission: { index: 0, stage: 0, kills: 0, packageX: LANDMARKS.docks.x + 60, packageY: LANDMARKS.docks.y + 40 },
    dialogue: { lines: [], index: 0, t: 0, active: false },
    message: { text: '', t: 0 },
    camera: { x: LANDMARKS.garage.x, y: LANDMARKS.garage.y },
    mouseWorldX: 0, mouseWorldY: 0,
    busted: false,
    wasted: false,
    storyDone: false,
    stats: { carsStolen: 0, kills: 0, missionsDone: 0, shotsFired: 0 },
    _dialogueSkip: false,
  };
  spawnParkedCars(state, 14);
  spawnTraffic(state, 12);
  spawnPedestrians(state, state.pedTarget);
  spawnPickups(state);
  startMission(state, 0);
  // The briefing should not block the very first frame's controls.
  state.dialogue.t = 0;
  return state;
}

export function resetGame(state) {
  const fresh = createGame(state.seed, state.audio);
  for (const key of Object.keys(fresh)) state[key] = fresh[key];
}

function updateParticles(state, dt) {
  for (let i = state.particles.length - 1; i >= 0; i -= 1) {
    const p = state.particles[i];
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.t -= dt;
    if (p.t <= 0) state.particles.splice(i, 1);
  }
  for (let i = state.skids.length - 1; i >= 0; i -= 1) {
    state.skids[i].t -= dt;
    if (state.skids[i].t <= 0) state.skids.splice(i, 1);
  }
}

function updateCamera(state, dt) {
  const p = state.player;
  const tx = clamp(p.x, 0, WORLD.width);
  const ty = clamp(p.y, 0, WORLD.height);
  const k = Math.min(1, 5 * dt);
  state.camera.x += (tx - state.camera.x) * k;
  state.camera.y += (ty - state.camera.y) * k;
}

/**
 * One fixed step. `actions` carries the frame's one-shot presses (see
 * input.js) and `mouse` the pointer in world coordinates. Returns events.
 */
export function stepGame(state, input, actions, dt) {
  state.events = 0;
  state.elapsed += dt;
  // A full Solmar day lasts about eight minutes of play.
  state.clock = (state.clock + (dt * 1440) / 480) % 1440;

  // One-shot presses, wired to the modules that own them.
  input._interact = (actions & ACTION_INTERACT) !== 0;
  state._dialogueSkip = input._interact || input.mouse.clicked;
  if ((actions & ACTION_MELEE) !== 0) playerMelee(state);
  if (input.mouse.down) {
    playerShoot(state, state.mouseWorldX, state.mouseWorldY);
  }

  updatePlayer(state, input, dt);
  updateTraffic(state, dt);
  updatePedestrians(state, dt);
  updatePolice(state, dt);
  updateEnemies(state, dt);
  updateBullets(state, dt);
  updateMissions(state, dt);
  updateParticles(state, dt);
  updateCamera(state, dt);

  if (state.message.t > 0) state.message.t -= dt;
  if (state.player.health <= 0 && !state.wasted) {
    state.wasted = true;
    state.events |= EVENT_WASTED;
    state.audio.engineStop();
    state.audio.sirenStop();
  }
  if (state.busted) {
    state.events |= EVENT_BUSTED;
    state.audio.engineStop();
    state.audio.sirenStop();
  }
  state.wanted = wantedStars(state);
  return state.events;
}

export { STEP };
