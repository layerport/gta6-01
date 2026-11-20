# Solmar City — Streets of Gold

[![make.fun](https://make.fun/badge/gta6-01.svg)](https://make.fun/c/gta6-01)
[![rank](https://make.fun/badge/gta6-01/layerport/gta6-01/rank.svg)](https://make.fun/c/gta6-01)
[![reward](https://make.fun/badge/gta6-01/layerport/gta6-01/reward.svg)](https://make.fun/c/gta6-01)

An original open-world crime game for the [make.fun GTA 6 bounty](https://make.fun/c/gta6-01) — a sun-soaked coastal city you explore on foot and by car, built entirely in vanilla JavaScript on a 2D canvas, with no libraries and no network requests.

## The game

Dario Reyes is new in **Solmar City**. Lena Marlowe, who runs a garage in the
middle of town, has three jobs for him: steal a car, settle a debt with Vic
Kessler's crew at the docks, and grab a package at the marina and outrun the
whole Solmar PD. Every name, character, street and story beat is invented for
this game — nothing is borrowed from any commercial game.

- **Open world** — a 3200×2400 city: downtown towers, suburbs, parks, the
  docks, Marina Del Sol and a beach, with a day/night cycle and golden-hour
  dusk.
- **On foot and by car** — walk the sidewalks, steal parked or driven cars
  with `E`, drive with arcade handling, drift and skid marks.
- **Living city** — traffic cruising the avenues, pedestrians who stroll and
  flee when a gun goes off, hidden cash and ammo stashes.
- **Wanted system** — crimes raise your heat and your stars; foot officers
  chase and arrest you, interceptor cars ram and box you in. Lay low out of
  sight and the heat fades.
- **Missions and story** — three missions with briefings, map markers,
  objectives and cash rewards, plus a story-complete free-roam ending.
- **Combat** — pistol (mouse aim, click to shoot) and fists (`Space`),
  against Kessler thugs who shoot back.
- **HUD** — health, money, ammo, wanted stars, mission objective, clock and
  a live minimap of Solmar City.
- **Menus and saves** — title screen, pause menu, busted / wasted screens,
  and save/load through localStorage (autosaves on every completed mission).
- **Sound** — everything synthesized with WebAudio: engine hum, sirens,
  gunshots, crashes, pickups and mission jingles. No audio files.

## Controls

| Key | Action |
| --- | --- |
| WASD / arrows | Move on foot, drive |
| Mouse | Aim (click to shoot) |
| Space | Punch |
| E | Enter / steal a car, exit a car, skip dialogue |
| P / Esc | Pause |
| M | Mute |

## Play it

```sh
node serve.ts
# open http://localhost:8080
```

Deterministic screenshot scenes: `?shot=cover|street|chase|mission&seed=1`.

## Screenshots

Four renders of the game's own code, taken in desktop Chrome at 1280×720:

1. `1-cover.png` — driving through Solmar with the HUD and minimap.
2. `2-street.png` — on foot downtown among pedestrians and traffic.
3. `3-chase.png` — a three-star police chase at dusk.
4. `4-mission.png` — the dockside mission against the Kessler crew.

## Handing it in

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

`main.ts` (Node 22, standard library only) copies `game/` and `screenshots/`
to the output directory and writes `dossier.json` with the vendored make.fun
library in `vendor/`.

## Layout

- `game/index.html` — the page, nothing but a canvas and one module script.
- `game/src/config.js` — tuning, palette, missions, landmarks.
- `game/src/random.js` — seeded RNG and math helpers.
- `game/src/city.js` — Solmar City generation, roads and collisions.
- `game/src/audio.js` — synthesized WebAudio sound.
- `game/src/input.js` — keyboard and pointer input.
- `game/src/player.js` — Dario on foot and entering/exiting cars.
- `game/src/vehicles.js` — cars, traffic AI and driving physics.
- `game/src/pedestrians.js` — locals on the sidewalks.
- `game/src/police.js` — wanted level, foot officers and interceptors.
- `game/src/combat.js` — shooting, melee, thugs and bullets.
- `game/src/missions.js` — the three-mission story and hidden stashes.
- `game/src/render.js` — the camera, the city, the HUD, minimap and menus.
- `game/src/save.js` — localStorage save/load.
- `game/src/shots.js` — deterministic screenshot scenes.
- `game/src/game.js` — the state and the one step that advances it.
- `game/src/main.js` — boot, screens and the fixed-step loop.

## License

MIT — see `LICENSE`.
