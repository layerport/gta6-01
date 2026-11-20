// Save and load through localStorage: money, health, position, mission
// progress, collected stashes and the clock. Everything else (traffic,
// pedestrians, police) is rebuilt fresh from the seed on load.
import { MISSIONS, SAVE_KEY } from './config.js';

export function saveGame(state) {
  const data = {
    version: 1,
    seed: state.seed,
    money: state.player.money,
    health: state.player.health,
    ammo: state.player.ammo,
    x: state.player.x,
    y: state.player.y,
    missionIndex: state.mission.index,
    missionStage: state.mission.stage,
    missionKills: state.mission.kills,
    clock: state.clock,
    stats: state.stats,
    takenPickups: state.pickups.map((p) => (p.taken ? 1 : 0)),
  };
  window.localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  return true;
}

export function loadSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || data.version !== 1) return null;
    return data;
  } catch {
    return null;
  }
}

export function hasSave() {
  return loadSave() !== null;
}

/** Apply a loaded save onto a fresh state (traffic and peds stay fresh). */
export function applySave(state, data) {
  state.player.money = data.money;
  state.player.health = data.health;
  state.player.ammo = data.ammo;
  state.player.x = data.x;
  state.player.y = data.y;
  state.camera.x = data.x;
  state.camera.y = data.y;
  state.clock = data.clock;
  state.stats = { ...state.stats, ...data.stats };
  if (Array.isArray(data.takenPickups)) {
    data.takenPickups.forEach((taken, i) => {
      if (taken && state.pickups[i]) state.pickups[i].taken = true;
    });
  }
  // Resume the saved mission from its briefing so the player knows the job.
  state.mission.index = data.missionIndex;
  state.mission.stage = 0;
  state.mission.kills = data.missionKills || 0;
  const mission = MISSIONS[data.missionIndex];
  if (mission) {
    state.dialogue = { lines: mission.brief.slice(), index: 0, t: 0, active: true };
  }
  return state;
}

export function clearSave() {
  try { window.localStorage.removeItem(SAVE_KEY); } catch { /* ignore */ }
}
