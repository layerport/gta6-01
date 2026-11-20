// Boot and the one loop: input is read every frame, the world advances in
// fixed 1/60 s steps (several in a slow frame, none in a fast one), and the
// renderer paints what is there. The game moves between title, play, paused,
// busted and wasted screens.
//
// ?seed=N fixes the city and the traffic. ?shot=cover|street|chase|mission
// (with &seed=N) stages that scene instead of running the loop, paints it
// twice and sets window.__shotReady for a screenshot.
import { STEP } from './config.js';
import { createAudio } from './audio.js';
import { ACTION_CONFIRM, ACTION_INTERACT, ACTION_MUTE, ACTION_PAUSE, createInput } from './input.js';
import { EVENT_BUSTED, EVENT_WASTED, createGame, resetGame, stepGame } from './game.js';
import { applySave, clearSave, hasSave, loadSave, saveGame } from './save.js';
import { createRenderer, SCREEN_BUSTED, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WASTED, pauseButtons } from './render.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall is dropped. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const audio = createAudio();
const state = createGame(seed, audio);
const renderer = createRenderer(canvas);

function announce(message) {
  status.textContent = message;
}

function runShot(name) {
  const scene = stageShot(name, state);
  let painted = 0;
  function paint() {
    renderer.draw(state, scene.screen);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let accumulator = 0;
  let last = performance.now();

  function startGame(fresh) {
    if (fresh) resetGame(state);
    audio.unlock();
    audio.engineStop();
    accumulator = 0;
    screen = SCREEN_PLAY;
    announce('Playing Solmar City. Steal a car and drive to Lena’s garage.');
  }

  function loadGame() {
    const data = loadSave();
    if (!data) {
      state.message = { text: 'No saved game in this browser yet.', t: 3 };
      return;
    }
    resetGame(state);
    applySave(state, data);
    audio.unlock();
    screen = SCREEN_PLAY;
    announce('Save loaded.');
  }

  function respawn(penalty, label) {
    const p = state.player;
    p.money = Math.max(0, p.money - penalty);
    p.health = 100;
    p.ammo = Math.max(p.ammo, 12);
    p.x = 1400 + 60;
    p.y = 1240 + 80;
    if (p.car) {
      p.car.kind = 'parked';
      p.car.speed = 0;
      p.car = null;
    }
    p.onFoot = true;
    p.vx = 0;
    p.vy = 0;
    state.heat = 0;
    state.wanted = 0;
    state.busted = false;
    state.wasted = false;
    state.cops.length = 0;
    state.cars = state.cars.filter((c) => c.kind !== 'police');
    state.camera.x = p.x;
    state.camera.y = p.y;
    state.message = { text: `${label} -$${penalty}. Back on the streets.`, t: 4 };
    screen = SCREEN_PLAY;
  }

  function handlePauseClick() {
    if (!input.mouse.clicked) return;
    const logical = renderer.toLogical(input.mouse.x, input.mouse.y);
    for (const b of pauseButtons()) {
      if (logical.x >= b.x && logical.x <= b.x + b.w && logical.y >= b.y && logical.y <= b.y + b.h) {
        audio.click();
        if (b.id === 'resume') screen = SCREEN_PLAY;
        else if (b.id === 'save') {
          try {
            saveGame(state);
            state.message = { text: 'Game saved.', t: 3 };
          } catch { state.message = { text: 'Save failed in this browser.', t: 3 }; }
        } else if (b.id === 'load') loadGame();
        else if (b.id === 'restart') {
          clearSave();
          startGame(true);
        }
        return;
      }
    }
  }

  function handleActions(actions) {
    if (actions & ACTION_MUTE) audio.setMuted(!audio.isMuted());
    if (screen === SCREEN_TITLE) {
      if (actions & ACTION_CONFIRM) {
        audio.unlock();
        startGame(false);
      }
      return;
    }
    if (screen === SCREEN_BUSTED) {
      if (actions & ACTION_CONFIRM) respawn(200, 'Bailed out.');
      return;
    }
    if (screen === SCREEN_WASTED) {
      if (actions & ACTION_CONFIRM) respawn(150, 'Hospital bill.');
      return;
    }
    if (screen === SCREEN_PAUSED) {
      handlePauseClick();
      if (actions & ACTION_PAUSE) screen = SCREEN_PLAY;
      return;
    }
    if (actions & ACTION_PAUSE) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  }

  function step(actions) {
    // The pointer's world position is what the player aims at.
    const world = renderer.toWorld(input.mouse.x, input.mouse.y);
    state.mouseWorldX = world.x;
    state.mouseWorldY = world.y;
    const events = stepGame(state, input, actions, STEP);
    if (events & EVENT_BUSTED) {
      screen = SCREEN_BUSTED;
      audio.busted();
      announce('Busted by the Solmar PD.');
    } else if (events & EVENT_WASTED) {
      screen = SCREEN_WASTED;
      announce('Wasted.');
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    // One read of the action flags per frame, shared by the menus and the step.
    const actions = input.takeActions();
    handleActions(actions);
    if (screen === SCREEN_PLAY) {
      // The one-shot flags belong to the first sub-step only; later
      // sub-steps in the same frame get none, so E never enters and
      // exits a car in one frame.
      let firstStep = true;
      while (accumulator >= STEP && screen === SCREEN_PLAY) {
        step(firstStep ? actions : 0);
        firstStep = false;
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
      // The title screen's backdrop stays alive behind the menu.
      if (screen === SCREEN_TITLE) {
        state.elapsed += STEP;
        state.clock = (state.clock + STEP * 3) % 1440;
        state.camera.x = 1600 + Math.cos(state.elapsed * 0.05) * 500;
        state.camera.y = 1200 + Math.sin(state.elapsed * 0.04) * 300;
      }
    }
    renderer.draw(state, screen);
    input.endFrame();
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  announce('Solmar City. Press Enter or click to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
