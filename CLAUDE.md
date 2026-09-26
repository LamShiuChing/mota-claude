# STRATUM

A 100-floor cyber tower RPG in the style of 新新魔塔 (2005). Plain browser JS, no build step; open `index.html`.

**Read `docs/HANDOFF.md` first.** It has the design, references (user-supplied links and screenshots), architecture, the balance model, verification steps and open work.

Rules for this project:
- Keep the UI faithful to the 2005 新新魔塔 layout (see HANDOFF §2) and keep the world and art original. Use **CC0 assets only**; never use ripped original assets.
- `js/maps.js` and `js/balance.js` are generated. Edit `js/world.js` or the tools, then run
  `node tools/genmaps.js && node tools/calibrate.js`, and the second command must print `balanced`.
- `battleCost` in `js/data.js` is the single damage formula. The Scan screen and the calibrator must keep using it.
- Keep scripts as classic globals (no ES modules) so `file://` keeps working.
