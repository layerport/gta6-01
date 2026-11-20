// The screenshot scenes behind ?shot=cover|street|chase|mission. Each one
// builds the real game from the seed, then places the player, the traffic,
// the police and the mission by hand and plays the rules forward for a few
// seconds, so the frame is what a short game really looks like and the same
// seed always gives the same frame.
import { CAR_MODELS, LANDMARKS, POLICE_MODEL, STEP } from './config.js';
import { SCREEN_PLAY } from './render.js';
import { createCar, makePoliceCar } from './vehicles.js';
import { spawnThugs } from './combat.js';
import { stepGame } from './game.js';

function driveForward(state, seconds, throttle) {
  // A tiny autopilot for the staged driving shots: hold the throttle and
  // steer gently along the avenue, exactly as a player would.
  const input = {
    axis() { return { x: 0, y: throttle ? -1 : 0 }; },
    mouse: { x: 0, y: 0, down: false, clicked: false, moved: false },
    _interact: false,
    takeActions() { return 0; },
  };
  for (let i = 0; i < seconds / STEP; i += 1) {
    state.mouseWorldX = state.player.x + 400;
    state.mouseWorldY = state.player.y;
    stepGameShim(state, input);
  }
}

// The shots stage through the same step the live game uses.
function stepGameShim(state, input) {
  stepGame(state, input, 0, STEP);
}

function clearPolice(state) {
  state.cops.length = 0;
  state.cars = state.cars.filter((c) => c.kind !== 'police');
  state.audio.sirenStop();
}

function putPlayerInCar(state, x, y, angle, modelIndex) {
  const car = createCar(x, y, angle, CAR_MODELS[modelIndex % CAR_MODELS.length], 'player');
  car.speed = 240;
  state.cars.push(car);
  const p = state.player;
  p.car = car;
  p.onFoot = false;
  p.x = x;
  p.y = y;
  p.angle = angle;
  p.speed = 240;
  state.camera.x = x;
  state.camera.y = y;
  return car;
}

function scatterTraffic(state, cx, cy, count) {
  const rng = state.rng;
  for (let i = 0; i < count; i += 1) {
    const road = [600, 1000, 1400, 1800][i % 4];
    const car = createCar(
      cx - 420 + i * 210,
      road === 1400 ? cy : road,
      i % 2 === 0 ? 0 : Math.PI,
      CAR_MODELS[(i + 1) % CAR_MODELS.length],
      'traffic',
    );
    car.axis = 'x';
    car.dir = i % 2 === 0 ? 1 : -1;
    car.lane = (i % 2 === 0 ? -1 : 1) * 22;
    car.road = road;
    car.targetSpeed = 120 + rng() * 60;
    car.speed = car.targetSpeed;
    state.cars.push(car);
  }
}

function stageCover(state) {
  clearPolice(state);
  state.clock = 10 * 60 + 20; // late morning sun
  state.heat = 0;
  state.wanted = 0;
  state.player.money = 1250;
  state.player.health = 100;
  state.player.ammo = 30;
  putPlayerInCar(state, 1000, 1400, 0, 5);
  // Traffic on the parallel avenues, clear of the player's lane.
  for (let i = 0; i < 5; i += 1) {
    const road = [1000, 1800, 600, 2200, 1000][i];
    const car = createCar(900 + i * 260, road, i % 2 === 0 ? 0 : Math.PI, CAR_MODELS[(i + 2) % CAR_MODELS.length], 'traffic');
    car.axis = 'x';
    car.dir = i % 2 === 0 ? 1 : -1;
    car.lane = (i % 2 === 0 ? -1 : 1) * 22;
    car.road = road;
    car.targetSpeed = 130;
    car.speed = 130;
    state.cars.push(car);
  }
  driveForward(state, 1.2, true);
  state.dialogue.active = false;
  // The cover shows the first job already rolling: drive to the garage.
  state.mission.stage = 2;
  state.message = { text: '', t: 0 };
  return { screen: SCREEN_PLAY };
}

function stageStreet(state) {
  clearPolice(state);
  state.clock = 15 * 60 + 40; // afternoon
  state.heat = 0;
  state.wanted = 0;
  state.player.money = 850;
  const p = state.player;
  p.x = 1380;
  p.y = 980;
  p.angle = -Math.PI / 2;
  p.onFoot = true;
  p.car = null;
  state.camera.x = p.x;
  state.camera.y = p.y;
  // Locals spread across the sidewalks around the plaza.
  for (const ped of state.peds) {
    ped.x = 1000 + state.rng() * 800;
    ped.y = 700 + state.rng() * 560;
    ped.state = 'walk';
  }
  scatterTraffic(state, 1400, 1000, 5);
  const idle = {
    axis() { return { x: 0, y: 0 }; },
    mouse: { x: 0, y: 0, down: false, clicked: false, moved: false },
    _interact: false,
    takeActions() { return 0; },
  };
  for (let i = 0; i < 1.2 / STEP; i += 1) {
    state.mouseWorldX = p.x;
    state.mouseWorldY = p.y - 200;
    stepGameShim(state, idle);
  }
  state.dialogue.active = false;
  state.message = { text: '', t: 0 };
  return { screen: SCREEN_PLAY };
}

function stageChase(state) {
  state.clock = 18 * 60 + 30; // dusk, sirens in the orange light
  state.heat = 130;
  state.wanted = 3;
  state.player.money = 2100;
  state.player.health = 100;
  // The chase is the marina getaway: lose the PD, reach the safehouse.
  state.mission.index = 2;
  state.mission.stage = 2;
  state.dialogue.active = false;
  const car = putPlayerInCar(state, 1200, 1400, 0, 0);
  car.speed = 380;
  state.player.speed = 380;
  // Two interceptors on the player's tail, still a little way back, and one
  // cutting across ahead — a chase, not a pile-up.
  const tail1 = makePoliceCar(state, 820, 1400);
  tail1.angle = 0;
  tail1.speed = 400;
  const tail2 = makePoliceCar(state, 700, 1422);
  tail2.angle = 0;
  tail2.speed = 390;
  const ahead = makePoliceCar(state, 2100, 1000);
  ahead.angle = Math.PI / 2;
  ahead.speed = 360;
  state.cars.push(tail1, tail2, ahead);
  state.cops.push({
    x: 1560, y: 1330, angle: Math.PI, speed: 0, health: 3,
    arrestT: 0, shootCd: 0, dead: false, deadT: 0, walkPhase: 0,
  });
  state.copSpawnT = 99; // keep the staged cast exactly as placed
  driveForward(state, 0.8, true);
  state.dialogue.active = false;
  state.message = { text: 'The PD is on you — lose them!', t: 4 };
  return { screen: SCREEN_PLAY };
}

function stageMission(state) {
  clearPolice(state);
  state.clock = 12 * 60; // high noon at the docks
  state.heat = 0;
  state.wanted = 0;
  state.mission.index = 1;
  state.mission.stage = 2;
  state.mission.kills = 1;
  state.dialogue.active = false;
  const p = state.player;
  p.x = LANDMARKS.docks.x + 180;
  p.y = 1420;
  p.angle = Math.PI; // facing west, down the avenue at the crew
  p.onFoot = true;
  p.car = null;
  p.ammo = 24;
  // Frame the player and the crew together.
  state.camera.x = LANDMARKS.docks.x + 90;
  state.camera.y = 1450;
  spawnThugs(state, LANDMARKS.docks.x, 1400, 4);
  // One thug already down so the counter reads 1/4.
  state.enemies[0].dead = true;
  state.enemies[0].deadT = 0.5;
  state.message = { text: 'The Kessler crew is here. Take them out!', t: 4 };
  const idle = {
    axis() { return { x: 0, y: 0 }; },
    mouse: { x: 0, y: 0, down: false, clicked: false, moved: true },
    _interact: false,
    takeActions() { return 0; },
  };
  for (let i = 0; i < 0.8 / STEP; i += 1) {
    state.mouseWorldX = LANDMARKS.docks.x;
    state.mouseWorldY = 1400;
    stepGameShim(state, idle);
  }
  return { screen: SCREEN_PLAY };
}

/**
 * Stage the named scene (cover, street, chase or mission; any other name
 * is cover) on a fresh game and return the screen to draw over it.
 */
export function stageShot(name, state) {
  if (name === 'street') return stageStreet(state);
  if (name === 'chase') return stageChase(state);
  if (name === 'mission') return stageMission(state);
  return stageCover(state);
}

export { POLICE_MODEL };
