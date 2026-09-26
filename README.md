# STRATUM

A 100-floor cyber tower RPG in the style of 新新魔塔 (2005). Open `index.html` in a browser.

**Controls:** Arrows move one cell per press (bump to fight/open/take) · Enter confirm · Q retreat · E re-read note · M scan · F phase-jump · S/L save/load · N mute · H help

**Dev lab:** serve the repo (`python -m http.server 8765`) and open `/lab.html` to preview weapon/enemy battle FX, idle animations and any floor.

Design, story bible, references and open work: [`docs/HANDOFF.md`](docs/HANDOFF.md).

## Files
- `js/data.js`: sprites, item kinds, combat rules (`battleCost` is the single damage formula)
- `js/world.js`: zones, rosters, floor plan, hand-made maps, NPCs, story
- `js/maps.js`, `js/balance.js`: **generated**; don't edit by hand
- `js/music.js` + `js/audio.js`: chiptune score and synth; `js/samples.js`: Kenney CC0 sound effects (see `assets/`)
- `js/game.js`: engine

## Changing content
```
node tools/genmaps.js     # rebuild floor layouts from world.js (per-floor seeds: tools/seeds.json)
node tools/calibrate.js   # re-balance every zone by simulating a realistic player; must print "balanced"
node tools/checkmaps.js   # validate authored floors (stairs, specials, lore notes, softlocks)
```
Difficulty knobs live at the top of `tools/calibrate.js` (`TIERS`, `BOSS`, `ITEM`).
`tools/playbot.js` is an in-browser bot that plays the real engine for a smoke test.
