# STRATUM: Design Doc & Handoff

Handoff for the next session doing polish work. It covers what the game is, how it's built, every decision
and reference gathered so far, what was verified, and what's still open.

- Repo: https://github.com/LamShiuChing/mota-claude (branch `main`, first commit `e335ce5`)
- Local path: `D:\魔塔` (Windows 11, PowerShell + Git Bash)
- Owner: LamShiuChing
- Play: open `index.html` in a browser (works from `file://`; fonts need internet)

---

## 1. What the game is

**STRATUM** is a 100-floor tile tower RPG (魔塔 genre), modelled on **新新魔塔 (2005)**. Its UI and mechanics
stay faithful to the original. The world, story, art and sound are original.

- **World:** a BLAME!-style megastructure that machines never stopped building. Humans lost the
  *Signature* (a genetic key to the Net). The city's immune system, the **Sanitizers**, purges
  anything without one.
- **Player:** **Rho**, a silent wanderer. **LAMBDA** is an AI fragment in Rho's visor. They climb
  Relay Tower 7's 100 strata to a Root Terminal so LAMBDA can forge a Signature.
- **Tone** (user's words): *hopeless + dark + warm*, inspired by Dark Souls and BLAME!. The world
  is cruel, with a few good moments.
- **Language:** English UI and text (the user picked English).

### Story beats (all text in `js/world.js`: `STORY`, `LORE`, `NOTES`, `SECRET_HINTS`, `VAULT_NOTES`, `ITEM_LORE`)
Souls-style delivery (user direction): **no tutorials, no hints, nobody explains**. The story comes in fragments,
out of chronological order, from unreliable sources. Few words; silence is fine; LAMBDA talks less as it degrades.

| Floor | Beat |
|---|---|
| 1F | Two-line intro ("The Builders never stopped." LAMBDA: "Up."). The **Archivist** (a ghost that mistakes Rho for someone) gives an Amber keycard. No mechanics explained. |
| 2F | **Broker** and **Fabricator** (shop text is flavor only). |
| 4F / 25F / 58F / 87F | **Brann** chases a "Sun". Found dead smiling at a heat lamp ("FOUND IT. ISN'T IT WARM."). Gives his Drill. His "B. WAS HERE. UP." marks trail between meetings (`LORE`). |
| 13F / 35F / 45F | **Archivist**: wrote the Sanitizer firmware; forgets his daughter; finds his drowned body; "Tell the little walking man I'm sorry." |
| 16F / 53F | **Sister Ohm** lights a candle for each infant she "carried up" and the door never opened for. |
| 22F / 37F / 68F | **Pip** finds its mother: the nursery lullaby server. LAMBDA: "...I know that song." |
| 9, 27, 44, 73, 92F | The **Stranger** (identity deliberately ambiguous; possibly the original Warden). |
| 11, 21 … 91F, 95F | One short line (or narration) per zone entry (`ON_ENTER`). |
| 10, 20 … 100F | Bosses: short intros; **dying lines recontextualize** earlier fragments (Janitor asks for a countersign; Surgeon's patients begged for glass; Foreman asks who "everyone" is; Gatekeeper and Heir mention a mother who never came down; Warden kept it clean "for her"). |
| Most generated floors | **`LORE[floorNumber]`**: one authored fragment replaces that floor's first ordinary floor note (`readNote` in game.js). Other notes are random graffiti from `NOTES`; notes near fake walls are oblique whispers from `SECRET_HINTS`. |
| Vaults | Each vault: two scraps in the girl's hand (`VAULT_NOTES`) + a **Memory Shard**. The shards are LAMBDA's memories in *found* order, not chronological. |
| 100F | Ending A "Forge the Signature" (LAMBDA goes in; Rho sits in the chair). With all 5 shards a choice appears; "Walk away" gives Ending B (grey sky, small far sun). |

### Story bible (hidden truth; keep new content consistent, never state it outright in game)
- **The Signature** is the Root's countersign on a human genome, given at birth by a *living human hand* in the Root
  chair (the Warden). Signed humans are served by the Net. It is not lost: nobody has issued one in ~1100 years.
- **The Warden** was a human. Chair-bound for ~30,000 days, she asked to go down to her son. The chair made a copy
  of her first (Candidate Copy 0001, reason "for her") and seated it. A copy isn't a living hand, so it can't
  countersign. From then on every newborn was unsigned. WARDEN//ROOT is that copy, keeping the city "clean for her".
  The original walked down. The Stranger might be her; this is never confirmed.
- **The Sanitizers** ("the white ones") run hygiene firmware written by **the Archivist** (initial "H.") to purge the
  Rot, a data/flesh corruption: "purge what has no Signature. The Rot has none; every one of us does." Once signing
  stopped, children became indistinguishable from the Rot. It isn't hate, it's hygiene.
- **Consequences:** Sister Ohm (a nursery carrier unit) carried ~900,000 infants up for a countersign that never came.
  Silicate Husks are people who asked the Surgeon to turn them into glass, because glass isn't purged. The Choir is the
  purged voices. The Builders obey Work Order #1, "SHELTER FOR EVERYONE", where everyone means the signed: one person
  is left, so they never finish. **The Last Heir** (80F) is the Warden's son, the last signed human, kept alive by a Net
  that answers him but doesn't listen.
- **LAMBDA** was written by the Archivist's unsigned daughter (age ~9, fate unrecorded). She named it for the glyph λ,
  "a little person, walking", read it stories, and hid in it her father's ENGINEER key. When the white ones came
  she hid it in a visor: "Keep someone warm for me." Centuries in the dark followed. A Broker later sold the cracked visor to
  "a loud man with a drill" (Brann), who gave it to a child, Rho. Brann half-recognizes the visor; neither says so.
  The key lets LAMBDA forge a single countersign by spending itself (Ending A). The last shard: she gave it "the key,
  and a reason not to use it".
- **The Mirror**: from the Silent Stratum up, the tower copies climbers as replacement candidates. Copies with an empty
  "reason field" are unsuitable. "Two went in. One came out. The door did not record which." Whether Rho is the
  original is left open.
- **Brann's Sun**: nurseries got "solar-substitute" heat lamps so no child grew up without a sun. Brann died at one.
  The real sun exists (Ending B), small and far. The sky may be 10,000 strata up (Brann's map), so the climb out is long.
- **Pip's mother** is the nursery lullaby server ("hmmm-hm-hmmm"). The girl learned the song there, so LAMBDA knows it.
- **Endings:** A: Rho is signed and sits in the chair as the new living Warden, so the cycle continues but a hand is there.
  B: they leave the chair empty and the city unchanged, and go see the sky.
- **Motifs:** warm / cold; "keep someone warm"; the λ "little person walking"; countersign / no reply; "up".
  Fragment voices: H.'s firmware notes, OHM-7 carrier logs, Warden diary pages (older pages are found *higher*,
  the page she carried down is at 7F), candidate logs, registry and purge records, Brann's marks, and the girl.

### Zones (`js/world.js` → `ZONES`)
| # | Floors | Name | Music | Theme / enemy flavor |
|---|---|---|---|---|
| 1 | 1–10 | Dead Concrete | stratum | grey panels; Bug, Power Surge, Silicate Husk, Watch Drone, Sanitizer, Builder |
| 2 | 11–20 | Cable Nave | nave | green, falling 0/1 data; Worm (corrupt), Sentry turret (field) |
| 3 | 21–30 | Silicate Wards | ward | clinical blue; Crystal Hound (twin), Nurse Unit (corrupt) |
| 4 | 31–40 | The Foundry | foundry | rust/embers; Furnace Turret, Crane Frame |
| 5 | 41–50 | Drowned Archive | archive | deep blue bubbles; Data Wraith (pierce) |
| 6 | 51–60 | Choir of Static | choir | purple; Static Choir / Arc Seraph (pierce) |
| 7 | 61–70 | Quarantine | quarantine | red/white hazard; Enforcer, Hunter Hound |
| 8 | 71–80 | Graveyard of Signatures | grave | grey-green ash; Signed Ghost, Mourner |
| 9 | 81–90 | Silent Stratum | silent | near black; Void Wisp, Faceless |
| 10 | 91–100 | The Root | core | red + cyan; Daemon, Garbage Collector |

---

## 2. Reference material (from the user and from research)

### What the user supplied
1. **Background on 新新魔塔** (pasted Wikipedia-style text):
   - Released 2005 by a Hong Kong netizen. The original name was just 「魔塔」, and 「新新魔塔」 is a nickname.
   - 56 floors: 20 above ground, 25 underground, 10 "mystery floors" (神秘樓), plus floor 0.
   - The hero clears the upper floors, then goes underground, beats the Demon King on B25, and finds the princess on 神秘樓 8F.
   - Mystery floors are reached by special teleport points (8F's from B25, 10F's from 10F above ground).
   - **Damage is not fixed: MISS and critical hits happen.**
   - 2012: 「魔塔·Ver1.1續」 (a.k.a. 新新魔塔2).
2. **itch.io remake** (the user's layout reference): https://ruichenz.itch.io/mota ("Mota Remake 新新魔塔重制版" by ruichenz, Windows/macOS download, YouTube demo "Mota Remake Demo" by Ruichen Zhang).
   - Status panel shows Status (Normal), Level, HP, ATK, DEF, **CRIT**, **AGI**, EXP.
   - Keys panel shows key × n rows plus a coin row. Buttons: Save / Load / Controls / Settings.
   - The "God of Greed" shop reads "Human! Give me 20 gold, I'll enhance your power!" with HP+500, ATK+3, DEF+3, Leave.
   - Its page describes "fully animated turn-based combat" and says moving into an entity triggers the interaction.
3. **Remake battle screenshot** (the battle UI we copied): https://img.itch.zone/aW1hZ2UvNDU4MzY4NS8yNzMwODI4OC5qcGc=/original/LZumJ4.jpg
   - A wide box over the map with the monster on the left (label 自己, a mirror monster) and the hero on the right (勇者).
   - Each side has a **square portrait frame**. Both list 體力 / 攻擊力 / 防禦力 / 暴擊 / 敏捷 (HP / ATK / DEF / CRIT / AGI). The hero's labels sit to the right of the values (":體力").
   - **VS** at the top center. **撤退(Q)** (Retreat) in yellow, bottom right. A red slash mark over the portrait being hit.
4. **Bahamut walkthrough of the original**: https://home.gamer.com.tw/artwork.php?sn=5803796
   - Title: 「（考古）童年一個永不通關的噩夢！？魔塔（新版）通關心得」 by SleepyZz, 2023-10-01. It originally ran on the "史萊姆好玩遊戲區" Flash portal.
   - Screenshots (full-size), which show the **original 2005 layout** we copied:
     - https://truth.bahamut.com.tw/s01/202310/2610f15597e9a105eeeb9af8c77abc18.JPG (主塔 3F, full layout)
     - https://truth.bahamut.com.tw/s01/202310/cc394fb479a39c5770cb897aa4854dfd.JPG (5F: 神秘老人 gives the monster book: 「這個給你....有了這個，就可看清楚怪物的能力....」)
     - https://truth.bahamut.com.tw/s01/202310/6a204027f0bb81c3d81ae72ca2485681.JPG (8F: 「取得 黃金色羽根,按'F'鍵可啟動飛行功能」 banner)
     - https://truth.bahamut.com.tw/s01/202310/881d16692bbf587304abee891d949a17.JPG (14F: 老人 teaches a reflect-damage skill)
     - https://truth.bahamut.com.tw/s01/202310/811684e85f5747ed7d2b8f20a5368d8f.JPG (地下 7F: 「取得 隨意門,按'T'使用」; a red blood splatter decal on the floor)
     - https://truth.bahamut.com.tw/s01/202310/a3988878771a32ed7fba1019cdc64ac2.JPG (地下 25F final area, princess)
     - Not yet viewed: …/39844e4edbdfe61aa7e2d0193b321598.JPG, …/81092fc7cf2dfa01e9c82acfba68d94f.JPG, …/b4253ff8c6ad94e7f53d4b378e9aad21.JPG (same folder)
5. **User direction during the session** (in order):
   - "Faithful juice, sound and effect"
   - A 3-floor prototype first
   - 新新-style random combat
   - English UI
   - "Create your own universe… the game mechanic, overall style, UI can be faithful"
   - Then: "AI and computer… cyber tech fantasy, like BLAME!"
   - "UI more faithful to 新新魔塔"
   - "No need to show the HP for monster… a skill… buy from NPC"
   - "Battle UI should show all the stats, two icon frames, square"
   - "Full cyber, the potion is not matching the theme… real-world terms (computer components)"
   - Asked whether original audio/PNG could be downloaded (see §6)
   - Chose "Mix: CC0 SFX + own art" and "Original 2005" layout
   - "Loop yourself… full game (100+ levels)… hidden paths, NPCs, dialogue… Dark Souls + BLAME!… hopeless + dark + warm"

### What research turned up
- **Original 2005 layout** (from the Bahamut screenshots):
  - The whole screen is a patterned lavender stone backdrop.
  - **Left status panel:** portrait at top-left, `狀態:` with a rounded box showing `正常`, then rows 等級 / 體力 / 攻擊力 / 防禦力 / 敏捷 / 經驗值 with **italic values right-aligned**.
  - **Keys panel** below it: key icon **X** count ×3, plus a coin row.
  - **Floor tab** centered above the map (`主塔 3F`, `地下 7F`).
  - The map has a **cyan border**. **`-Press L-`** sits bottom right in maroon.
  - **Dialog:** a box in the upper-middle of the map, square portrait frame (cyan), speaker name centered, `-Enter-` at bottom right.
  - **Item pickup:** a full-width center banner `取得 xxx … -Enter-` that waits for Enter.
  - Palette: panels are dark cobblestone with a cyan (#1ea4d4-ish) border; walls light grey stone, floors dark cobble.
- **新新魔塔2 layout** (Bing image search results: 9game, ZOL, pcsoft, bilibili, zhihu, 3dmgame): a top status bar with icon rows. **Not used**; the user picked the 2005 layout.
- Original mechanics worth borrowing later:
  - the monster book is an item given on 5F
  - feather flight (F key)
  - the 隨意門 "anywhere door" (T key)
  - old men teaching skills (e.g. reflect damage)
  - blood decal where monsters die
  - floor naming 主塔 / 地下 / 神秘樓
- **Kenney assets are CC0:** https://kenney.nl/support ("all game assets on the asset pages are public domain licensed (CC0)… even in commercial projects… Attribution is not required").
  - Sci-fi Sounds: https://kenney.nl/assets/sci-fi-sounds (zip: https://kenney.nl/media/pages/assets/sci-fi-sounds/6b296f9ecf-1677589334/kenney_sci-fi-sounds.zip)
  - Interface Sounds: https://kenney.nl/assets/interface-sounds (zip: https://kenney.nl/media/pages/assets/interface-sounds/fa43c1dd4d-1677589452/kenney_interface-sounds.zip)
  - License text copied to `assets/LICENSE-kenney.txt`.

---

## 3. Architecture

Plain browser JS with no build step or modules, so it works from `file://`. Scripts load in this order (`index.html`):

| File | Role |
|---|---|
| `js/data.js` | Core rules: `PAL` palette, `SPRITES` (16×16 char art, auto-outlined), `VARIANTS` (palette swaps), `ITEMS` kinds, `DOORS`, `ABILITIES`, `hitChances`, **`battleCost`** (the single luck-aware damage formula, shared by the Scan screen and the calibrator), `HERO_START`, `expToNext`, `levelGain`, `fabricatorCost` |
| `js/world.js` | Content: `ZONES` (theme, music, gear names, 6-tier roster + boss with abilities/swaps/dialog keys), hand-made maps (`MAP_1F`/`2F`/`3F`, `AUTHORED` = 60 authored floors keyed by floor number, `VAULT_MAPS[5]`), `FLOOR_PLAN` (per-floor specials; `.map` = authored layout), `VAULTS`, `ON_ENTER`, `NPCS`, `PORTRAITS`, `NOTES`, `SECRET_HINTS`, `STORY`, `zoneMonster()` |
| `js/maps.js` | **Generated** by `tools/genmaps.js`: `MAPS[105]` (100 main + 5 vaults) and `MAP_META` (npcs / notes / vault links per floor) |
| `js/balance.js` | **Generated** by `tools/calibrate.js`: `BALANCE[zone]` = monster stats per tier, item values, poison, shop, broker prices |
| `js/music.js` | `MUSIC` score: 14 tracks as 8-bar eighth-note strings (`C#5`, `-` hold, `.` rest), optional `wave`, `hat` |
| `js/samples.js` | 12 Kenney CC0 sound effects as base64 (embedded so `file://` works) |
| `js/audio.js` | `Sound`: WebAudio synth SFX with sample fallback, and a music sequencer |
| `js/game.js` | Engine: state, input, movement, combat, UI, rendering. Art/FX tables: `IDLE`/`IDLE_STYLES`/`idlePose` (per-sprite map idle animation), `WEAPON_FX` (player attack per `G.weapon`), `ENEMY_FX`/`enemyFx` (enemy attack by sprite → ability → default), `stairFacing`/`stairSprite`, `OILY`/`splat` (death decals) |

### Map tokens (zone-relative)
`#` wall · `.` floor · `%` fake wall (looks like a wall, bump to reveal) · `U`/`D` stairs · `^` vault stairs ·
`P` start · `S` Fabricator · `M` Broker · `O` NPC (id in `MAP_META.npcs`) · `L` Root Terminal · `n` floor note ·
`y b r` keycards · `Y B R` shutters · `h H` cells (HP) · `a` CPU (ATK) · `d` RAM (DEF) · `w` weapon · `e` armor ·
`v` antivirus · `c` Phase Compass · `*` memory shard · `1–6` monster tiers of the zone · `9` zone boss.
Item and monster numbers come from `BALANCE[zone]`, so the same map token scales automatically with depth.

### Engine notes (`js/game.js`)
- Logical canvas **576×432** (4:3). Map origin `MX=192, MY=48`, 11×11 tiles of 32 px. Left panels start at x=24.
  The canvas scale snaps to half-steps of device pixels.
- Modal UI types: `dialog | banner | battle | shop | book | help | fade | goal | fly | choice`.
- Combat: the hero swings first unless the monster is `swift`. Per swing: miss/crit come from `hitChances` (CRIT% ×2, each AGI point of
  advantage adds 3% dodge, clamped 2–40%), damage is ±10%. `double` = two attacks per turn, `pierce` ignores DEF,
  `surge` = every 3rd hit ×2 (bosses), `corrupt` = poison for 60 steps (refreshed on re-infection, auto-cured by stored
  antivirus, never kills: minimum 1 HP), `aura` = damage when you step next to it (minimum 1 HP).
- Save: `localStorage['stratum-save-v3']` holds the whole `G` state (maps included). `G.weapon` (zone index of best weapon, -1 = none) and
  `G.decals[floor]` were added later; `load()` back-fills both for old saves.
- New sprites just work: unknown sprite names fall back to the `breathe` idle and to an ability-based (or default) attack effect.
  To give one a specific look, add it to `IDLE` or to the alias list after `ENEMY_FX`.
- Keys: arrows, Enter/Space/Z, Q retreat, M scan (needs firmware), F Phase Compass, S/L, N mute, R twice restart, H help.
  The touch pad appears on `(pointer: coarse)`.
- Movement: one cell per key press (held keys only step again via OS key-repeat, and only when idle). Items are taken
  from the adjacent cell without moving. Changing floor puts the hero on the arrival stair tile itself.

---

## 4. Content pipeline & balance model

```
node tools/genmaps.js     # js/maps.js from world.js (FLOOR_PLAN); per-floor seed overrides in tools/seeds.json
node tools/calibrate.js   # js/balance.js; must end with "balanced: all 10 zones cleared"
TRACE=1 node tools/calibrate.js   # prints every simulated fight
node tools/checkmaps.js [--all] [floor…]   # validates tokens, stair rules, specials, lore notes, key-order softlocks
```
`tools/load.js` loads the browser scripts into one Node `vm` context, so the tools use exactly the game's data and formulas.

**Generator** (`tools/genmaps.js`):
- Recursive division: walls on odd lines, doorway gaps on even cells, rooms with even bounds.
- Down stairs go in a roomy region, up stairs in the farthest region. Stairs only go on room corners or corridor
  dead ends away from doorways, because stairs trigger on touch; there was a bug here once.
- Gaps on the main path get guard monsters or Amber shutters, and the keys for main-path shutters are placed where
  you can reach them without opening any door. Side gaps get shutters (Y/B/R), guards, or stay open.
- Secret rooms are dead-end regions sealed with `%`, holding loot, a hint note outside, and vault stairs where the plan
  asks for them.
- Specials are placed per `FLOOR_PLAN` (shops, gear, compass, NPCs). Monster tiers rise with the floor's position in its zone.

**Calibrator** (`tools/calibrate.js`):
- Works zone by zone from the hero's simulated state at the zone's start.
- Each tier has targets (`TIERS`: swings to kill, DEF as a share of hero ATK, fight cost as a share of HP, and the
  floor it's tuned for). A binary search sets each monster's **ATK** so the luck-aware `battleCost` hits that target exactly.
- The simulated player is realistic: it climbs floor by floor, takes cheap fights, prefers doors toward the stairs,
  skips costly optional fights once the stairs are reachable, and only backtracks to spend credits at a Fabricator
  or buy a key from a Broker.
- Growth rates go through a fixed-point loop: simulate, measure growth, re-tune, repeat. If the simulated player gets
  stuck, it backs off.
- Bosses are tuned when first reached, against a reference hero with `BOSS_MARGIN` (85% HP, 95% ATK), so they cost
  `BOSS.f` (45%) of that reference.
- Secret rooms, vaults and NPC gifts are **not** in the simulation, so they are pure bonus.

**Last verified numbers** (calibrator, realistic player):
```
zone  1 hp 1000->3441  atk 10->41     zone  6 hp 3438->3667   atk 246->392
zone  2 hp 3441->1690  atk 41->72     zone  7 hp 3667->7008   atk 392->592
zone  3 hp 1690->2264  atk 72->104    zone  8 hp 7008->9980   atk 592->912
zone  4 hp 2264->2353  atk 104->151   zone  9 hp 9980->27606  atk 912->1469
zone  5 hp 2353->3438  atk 151->246   zone 10 hp 27606->62815 atk 1469->2381
bosses cost 30–36% of HP; "balanced: all 10 zones cleared"
```
**In-engine bot** (`tools/playbot.js`, real game code with random combat) cleared **all 100 floors and WARDEN//ROOT**:
1,193 kills, HP about 3.4k at 10F → 152k at 100F. The bot does better than the calibrator, so the game leans slightly easy for competent players.

---

## 5. Verification & testing tips

- Serve locally for browser tests: `python -m http.server 8765 --bind 127.0.0.1` from the repo root.
- Playwright MCP screenshots may only be saved under `D:\魔塔\.playwright-mcp` (delete it afterwards; it's not committed).
- **Background tabs throttle `requestAnimationFrame`**, so fades and battles crawl in automation. Step the loop manually:
  `for (let i = 0; i < 40; i++) update(0.05); render();`
- Top-level `let/const` in the scripts are reachable from `page.evaluate` (e.g. `G`, `ui`, `newGame()`, `changeFloor(f, 'D')`,
  `tryMove(dx, dy, dir)`, `monsterAt(ch)`, `battleCost(G, m)`).
- Smoke test: `eval(await (await fetch('/tools/playbot.js')).text()); newGame(); await playbot(100)`.
- Mechanics individually verified: fake walls, notes, vault stairs both ways, shard pickup + dialog, Phase Compass,
  NPC gifts/leave, corruption, field damage, twin attacks, Scan screen, Broker/Fabricator, boss intro/outro, both endings, save/load, death screen.

---

## 6. Decisions & constraints

- **No ripped 新新魔塔 assets.** The user asked about downloading the original PNG/audio. We declined because it's
  unlicensed third-party work (partly taken from older games itself) and doesn't fit the cyber theme anyway. The user
  accepted. Use **CC0 only** (Kenney, or OpenGameArt filtered to CC0).
- Art is procedural and hand-drawn 16×16 character-grid sprites with an automatic dark outline and palette swaps. Maps are original.
- Monster stats are hidden until the player buys **Scan firmware** (20 CR) from the Broker (2F). No damage numbers are shown on the map.
- Retreat (Q) in battle restores nothing: the monster keeps full HP. This is borrowed from the remake.
- Earlier iterations, now replaced: "PHAROS: The Drowned Lighthouse" (sea/lighthouse theme), then a 3-floor
  STRATUM prototype with the sidebar UI. The prototype's balance is gone.

---

## 7. Known issues & limitations

- **Audio has never been heard by a human.** Samples decode and play (tested programmatically); the mix and volume are untuned.
- Fonts (`Press Start 2P`, `VT323`) load from Google Fonts. Offline, the game falls back to monospace.
- 63 of 100 main floors are hand-made (1F–3F + 60 in `AUTHORED`: every boss arena, zone intro, NPC floor) plus 5 unique vaults.
  The other 37 are generated; 10 of those can softlock if keys are spent badly (Broker sells keys; `checkmaps --all` lists them).
- 84F's diagonal stair and 100F's roots read as scattered blocks (walls touch only at corners).
- Playbot (fresh page per run) won 7/8 after all the art/story/floor merges; the loss stalled on 94F with no Cyan key and low HP.
  The bot can't walk to `L`, so a "win" = `G.flags.boss99`.
- Grim sprite redraw: weakest reads are Drowned Diver, Lantern Reader, the Foreman's hat; Builder Mk.II ≈ Builder; oil splats are faint on 81–90F floors.
- Gold piles up late (the sim ends with about 12k unspent). The Fabricator cost curve `20+10n+2n²` could be retuned, or more sinks added.
- The Scan screen has room for about 7 monster rows. A floor with more distinct types would overflow (hasn't happened yet).
- "Status" only shows NORMAL / CORRUPT. There are no other status effects yet.
- No floor-0 / underground / mystery-floor structure like the original.
- `~` renders as `≈`-ish in VT323 on the Scan screen (cosmetic).
- Git warns about CRLF line endings on Windows (harmless).
- The title screen has no credits page for Kenney (CC0 doesn't require one, but a credit is nice).

---

## 8. Polish ideas / next steps (suggested priority)

1. **Listen and mix audio.** Balance music vs SFX volume and check each zone track. Consider more Kenney samples (pickups, level up).
2. **Hand-design the remaining generated floors** (start with the 10 softlock-prone ones), then regenerate and recalibrate.
3. **Watch the new animations/effects in real time** (idle, weapon FX, hit-stop were only checked frame-by-frame).
4. **Original-style features** from §2: floor-teleport item as the 飛行 feather (already done: Phase Compass),
   an 隨意門-style item, NPC-taught skills (e.g. reflect), and a hidden "mystery" floor chain like 神秘樓.
5. **Sprite polish**: hero walk frames; the weak grim sprites listed in §7.
6. **Difficulty options** (a scale on `TIERS.f` / `BOSS.f`) and a credits screen.
7. **Offline fonts**: self-host OFL fonts in `assets/`.
8. **Deploy** with GitHub Pages from `main` (not set up yet).
9. Mobile: test the touch pad layout on real phones.
