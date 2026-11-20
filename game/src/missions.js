// The story of Dario Reyes in Solmar City: three missions for Lena Marlowe,
// each with a briefing, a marker on the map, stages and a cash reward —
// plus the hidden cash stashes scattered around the city for free roam.
import { LANDMARKS, MISSIONS } from './config.js';
import { dist } from './random.js';
import { addHeat } from './police.js';
import { spawnThugs } from './combat.js';
import { saveGame } from './save.js';

export function missionTitle(state) {
  if (state.mission.index >= MISSIONS.length) return 'Free Roam';
  return MISSIONS[state.mission.index].title;
}

export function objectiveText(state) {
  const m = state.mission;
  if (m.index >= MISSIONS.length) return 'Solmar is yours — collect cash, cause chaos, lay low.';
  if (m.index === 0) {
    if (m.stage === 0) return 'Talk to Lena — press E to skip the briefing.';
    if (m.stage === 1) return 'Steal a car — walk up to one and press E.';
    return "Drive to Lena's Garage (yellow wrench).";
  }
  if (m.index === 1) {
    if (m.stage === 0) return 'Talk to Lena — press E to skip the briefing.';
    if (m.stage === 1) return 'Drive to the Solmar Docks (west).';
    if (m.stage === 2) return `Take out the Kessler crew (${m.kills}/4).`;
    if (m.stage === 3) return 'Grab the stolen package.';
    return "Return the package to Lena's Garage.";
  }
  // Mission 2.
  if (m.stage === 0) return 'Talk to Lena — press E to skip the briefing.';
  if (m.stage === 1) return 'Pick up the package at Marina Del Sol.';
  return 'Escape the police and reach the Safehouse.';
}

export function missionMarker(state) {
  const m = state.mission;
  if (m.index >= MISSIONS.length) return null;
  if (m.index === 0) {
    if (m.stage === 0 || m.stage === 2) return { x: LANDMARKS.garage.x, y: LANDMARKS.garage.y, label: "Lena's Garage" };
    return null;
  }
  if (m.index === 1) {
    if (m.stage === 0) return { x: LANDMARKS.garage.x, y: LANDMARKS.garage.y, label: "Lena's Garage" };
    if (m.stage === 1 || m.stage === 2) return { x: LANDMARKS.docks.x, y: LANDMARKS.docks.y, label: 'Solmar Docks' };
    if (m.stage === 3) return { x: state.mission.packageX, y: state.mission.packageY, label: 'Stolen package' };
    return { x: LANDMARKS.garage.x, y: LANDMARKS.garage.y, label: "Lena's Garage" };
  }
  if (m.stage === 0) return { x: LANDMARKS.garage.x, y: LANDMARKS.garage.y, label: "Lena's Garage" };
  if (m.stage === 1) return { x: LANDMARKS.marina.x, y: LANDMARKS.marina.y, label: 'Marina Del Sol' };
  return { x: LANDMARKS.safehouse.x, y: LANDMARKS.safehouse.y, label: 'Safehouse' };
}

function startBriefing(state) {
  const mission = MISSIONS[state.mission.index];
  state.dialogue = { lines: mission.brief.slice(), index: 0, t: 0, active: true };
  state.mission.stage = 0;
}

export function startMission(state, index) {
  state.mission.index = index;
  state.mission.stage = 0;
  state.mission.kills = 0;
  state.mission.packageX = LANDMARKS.docks.x + 60;
  state.mission.packageY = LANDMARKS.docks.y + 40;
  startBriefing(state);
}

function completeMission(state) {
  const mission = MISSIONS[state.mission.index];
  state.player.money += mission.reward;
  state.player.ammo += 12;
  state.message = { text: `Mission complete: ${mission.title} — +$${mission.reward}`, t: 4 };
  state.audio.missionDone();
  state.stats.missionsDone += 1;
  state.mission.index += 1;
  state.mission.stage = 0;
  state.mission.kills = 0;
  try { saveGame(state); } catch { /* save is best-effort */ }
  if (state.mission.index < MISSIONS.length) {
    startBriefing(state);
  } else {
    state.storyDone = true;
    state.dialogue = {
      lines: [
        'LENA: That’s it, Dario. The package is safe. Solmar is ours now.',
        'DARIO: Then let’s enjoy it. The city, the sun, the whole damn coast.',
        '— STORY COMPLETE — Free roam: collect cash stashes, drive, lay low.',
      ],
      index: 0, t: 0, active: true,
    };
  }
}

function advanceDialogue(state, dt) {
  const d = state.dialogue;
  if (!d || !d.active) return;
  d.t += dt;
  const skip = state._dialogueSkip;
  if (skip || d.t > 4.2) {
    d.index += 1;
    d.t = 0;
    if (d.index >= d.lines.length) d.active = false;
  }
}

export function updateMissions(state, dt) {
  advanceDialogue(state, dt);
  const m = state.mission;
  const p = state.player;
  if (m.index >= MISSIONS.length) {
    updatePickups(state);
    return;
  }
  // Briefing first: the stage only starts once the dialogue is done or skipped.
  if (m.stage === 0) {
    if (!state.dialogue.active) m.stage = 1;
    updatePickups(state);
    return;
  }
  if (m.index === 0) {
    if (m.stage === 1 && !p.onFoot) {
      m.stage = 2;
      state.message = { text: 'Nice wheels. Now get to the garage.', t: 3 };
    } else if (m.stage === 2 && !p.onFoot && dist(p.x, p.y, LANDMARKS.garage.x, LANDMARKS.garage.y) < 130) {
      completeMission(state);
    }
  } else if (m.index === 1) {
    if (m.stage === 1 && dist(p.x, p.y, LANDMARKS.docks.x, LANDMARKS.docks.y) < 170) {
      m.stage = 2;
      m.kills = 0;
      // The crew holds the avenue by the docks, out in the open.
      spawnThugs(state, LANDMARKS.docks.x, 1400, 4);
      state.message = { text: 'The Kessler crew is here. Take them out!', t: 3 };
    } else if (m.stage === 2 && m.kills >= 4) {
      m.stage = 3;
      state.message = { text: 'Crew down. Grab the package.', t: 3 };
    } else if (m.stage === 3 && p.onFoot && dist(p.x, p.y, m.packageX, m.packageY) < 40) {
      m.stage = 4;
      state.message = { text: 'Package secured. Bring it back to Lena.', t: 3 };
    } else if (m.stage === 4 && dist(p.x, p.y, LANDMARKS.garage.x, LANDMARKS.garage.y) < 130) {
      completeMission(state);
    }
  } else if (m.index === 2) {
    if (m.stage === 1 && dist(p.x, p.y, LANDMARKS.marina.x, LANDMARKS.marina.y) < 110) {
      m.stage = 2;
      addHeat(state, 70);
      state.message = { text: 'Package grabbed! The PD is on you — lose them!', t: 4 };
      state.audio.sirenStart();
    } else if (m.stage === 2 && dist(p.x, p.y, LANDMARKS.safehouse.x, LANDMARKS.safehouse.y) < 120) {
      completeMission(state);
    }
  }
  updatePickups(state);
}


// Hidden stashes: cash (+$100) and ammo (+12) tucked around the city.
export function spawnPickups(state) {
  const spots = [
    { x: 640, y: 240, kind: 'cash' },
    { x: 2240, y: 640, kind: 'cash' },
    { x: 240, y: 1040, kind: 'ammo' },
    { x: 2640, y: 1040, kind: 'cash' },
    { x: 1040, y: 2240, kind: 'cash' },
    { x: 2640, y: 2240, kind: 'ammo' },
    { x: 1840, y: 2640 - 560, kind: 'cash' },
    { x: 640, y: 1840, kind: 'cash' },
  ];
  for (const spot of spots) {
    state.pickups.push({ x: spot.x, y: spot.y, kind: spot.kind, taken: false, bob: 0 });
  }
}

function updatePickups(state) {
  const p = state.player;
  for (const pickup of state.pickups) {
    if (pickup.taken) continue;
    pickup.bob += 0.05;
    if (dist(p.x, p.y, pickup.x, pickup.y) < 36) {
      pickup.taken = true;
      if (pickup.kind === 'cash') {
        p.money += 100;
        state.message = { text: 'Hidden stash found: +$100', t: 3 };
        state.audio.cash();
      } else {
        p.ammo += 12;
        state.message = { text: 'Ammo stash: +12 rounds', t: 3 };
        state.audio.pickup();
      }
    }
  }
  // The docks package only shows during mission 1, stage 3.
  if (state.mission.index === 1 && state.mission.stage === 3) {
    const pack = state.pickups.find((x) => x.kind === 'package');
    if (!pack) state.pickups.push({ x: state.mission.packageX, y: state.mission.packageY, kind: 'package', taken: false, bob: 0 });
  }
}
