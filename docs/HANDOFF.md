# STRATUM: Design Doc & Handoff

Handoff between sessions. It covers what the game is, how it's built, every decision and reference gathered so far,
what was verified, and what's next. **Read §0 first.**

- Repo: https://github.com/LamShiuChing/mota-claude (branch `main`)
- Local path: `D:\魔塔` (Windows 11, PowerShell + Git Bash)
- Owner: LamShiuChing
- Play: `python tools/serve.py` then http://127.0.0.1:8765/index.html (or open `index.html` from `file://`; fonts need internet).
  Dev preview: `lab.html` (§5).

---

## 0. Next session: brief

### Where session 5 left off (mechanics, big machines, balance, lore polish)
The user asked for four things: (1) more game mechanics ("you propose some, then I choose"), (2) multi-cell big bosses and
strong enemies, (3) balance, (4) lore/dialogue polish with "less AI-slop". All four are built. **Nothing from session 5 has
been reviewed by the user in the browser yet**, so ask for their verdict on the art, the mechanics and the rewrites.

What the user chose (their words in quotes):
- **Enemy ability.** The user turned down my four proposals and asked for their own: "higher tier enemy, if they are killed,
  there is a ability that let them spawn at the same cell as their lower tier correspondence". Built as **Rollback**
  (`rollback: t` in `ZONES`; one family per zone, e.g. Builder → Scrap Mite, Tangle → Cable Leech, Watchdog → Daemon).
- **Floor mechanics:** dark floors, flood tiles, alarm + switches. For the early zones: "better not something that will
  block the map or very game changing", so **zones 1–4 got no new mechanics.**
- **Build system:** "let the player customize their playstyle throughout the game and experiment… hybrid… more RPG like,
  but keep the mota style". Built as **firmware modules** (below). Swaps happen **at Fabricators** (user's pick), and the
  Fabricator sells **CRIT and AGI** too (user's pick).
- **Big machines:** "3×3 bosses + 2×2 elites".

What was built:
- **Big machines.** Bosses fill a 3×3 block of `9`; each zone has one 2×2 **elite** (`7`, optional, guarding a side room)
  that drops that zone's firmware module. Art is in `js/bigsprites.js` (48×48 bosses replacing the old 16px ones,
  32×32 elites), drawn by five parallel art agents from `docs/CONCEPTS.md`'s direction. The engine draws each body once
  from its top-left cell. `bodyAnchor`/`bodyCells`/`bodySize` in `data.js` are shared by engine, calibrator and
  checkmaps, and checkmaps rejects any 7/9 patch that isn't one square body. The 10 boss floors were re-laid around 3×3
  bosses. Elites sit at 9, 12, 23, 35, 46, 59, 68, 79, 84, 92F.
- **Firmware** (`MODS` in `data.js`). Twelve modules, levels I–III bought at a Fabricator ("Rewire firmware"), run only
  while slotted:
  - Slots: you start with one, and the bosses at 10/30/50/70F each add one (`slot: true`), so five by 71F.
  - Sources: ten come from elite drops; Scavenger and Compiler are sold by the Broker.
  - Checksum, Prefetch and Sandbox are single-level. Checksum only ever absorbs one blow, because more made trash fights
    free and broke the HP economy.
  - `kit(hero)` turns the slotted modules into combat numbers. `battleCost` models all of them, the battle engine plays
    them, and a Monte-Carlo check showed the engine within ±10% of the formula.
  - Slotted chips show under the map, left of `-Press H-`.
- **Floor mechanics.**
  - **Flood**, 41–49F (`FLOOR_PLAN[i].flood` = rows of water from the bottom): the generator turns `.` into `~` and
    places a pump `k` on a dry cell that blocks nothing. Each step in water costs `BALANCE[z].flood`; the pump drains
    the floor.
  - **Alarm plates** `!`, 64F and 69F: stepping on one opens every sealed pod `z` in the walls, and a Sanitizer Mk.III
    steps out beside the plate (`podsWaking`). Each plate sits on the cheaper route; there is a longer way round.
  - **Lever** `j`, 66F: swaps every shut gate `=` with every open gate `-` (`GATE_SWAP`). Checkmaps requires the goal or
    the lever to stay reachable in both gate states.
  - **Dark floors**, 81–89F (`DARK` in `world.js`): Rho sees about two cells around, and seen cells stay dimly
    remembered (`G.seen`). Scan lists only what has been seen.
- **Balance.** See §4. The big fixes:
  - Level-up HP is now a fixed curve by level (`40 × 1.045^lv`), not 4% of current HP, which made any lead snowball.
  - The calibrator charged 30 steps of poison on *every* corrupt fight; now it's about one dose per floor, like the
    engine.
  - Monsters are tuned against a hero **without** firmware, with each zone's target raised by the saving firmware is
    expected to give by then (`FIRMWARE` in `calibrate.js`). Every build meets the same monsters.
  - The calibrator's player takes any elite it can afford (under 40% HP), because a real player wants the firmware.
- **Lore.** 49 lines rewritten (tricolon echoes, "X. Not Y." antitheses, reflexive ellipses, "Only …" tags, lines that
  stated the hidden truth, Rho's hero quip, and the graveyard "Names" contradiction). Added: 12 firmware item lines,
  Rollback graffiti (zones 1 and 2), an alarm warning (zone 7) and a dark-floor line (zone 9). See `docs/LORE.md`
  §Session 5.

- **Follow-up requests (same session).**
  - "Some type of enemy should ignore defense to encourage other play style": Pierce already existed only from 41F, so the
    early drones got it too: Live Wire (z1), Spark Drone (z2), Needle Drone (z3), Welder Drone (z4).
  - "At some empty cell that seems nothing will happen… a transparent stair tp them to somewhere special, like level 7 top
    left cell… some can be easter egg ish": **hidden warps** (`&`). A plain-looking cell warps you to an **Unallocated
    sector** (`SECTOR_MAPS`/`SECTOR_NOTES`, stored after Relay 0 from index `SECTOR_BASE` = 106). Once used, both ends
    show a faint translucent stair (`G.warps`), and the first use chimes. `WARPS[i]` = the main-floor end of sector i:
    - **7F (0,0):** Lost & Found (keys; the Broker claimed the visor)
    - **24F (0,5):** Ward 9 (the lamp the girl's notes mention; her coat)
    - **38F (10,0):** a sector "reserved for future expansion", with one Builder Mk.II
    - **52F (4,0):** walls in the shape of λ
    - **77F (0,4):** a crack in the outer wall and something flapping in the grey
    - **95F (0,0):** SECTOR 0xFF, one dusty chair

    One zone-1 graffiti hints at the 7F corner. The sector loot is bonus (the calibrator ignores warps and treats `&` as
    a wall). Each warp sits on a dead-end cell so it can't cut a floor.

- **Third round of requests.**
  - Floor names now read "Zone name - nF" (e.g. "Graveyard of Signatures - 71F"; Relay 0 is "RELAY - 0F"). The tab sizes
    itself to the text.
  - **Stat pickups with tiers:** `x` Targeting Lens (+CRIT) and `g` Servo (+AGI) are named Mk.I–IV by depth
    (`itemTier`) and give more deeper down. `o` is one named implant per zone (`gear.o`: Salvaged Optic … Root Spur) that
    gives CRIT + AGI. `genmaps` scatters them on floor offsets 1/3/5/6/8 (the farthest free cell). Crit chance is capped
    at 50%.
  - **Statuses:** besides Corrupt there are **Breach** (DEF −20%), **Throttle** (ATK −15%) and **Lag** (AGI −50%), each
    60 steps (`STATUS`, `afflicted` in data.js; `G.fx`). One machine per zone carries one (Tangle, Riveter, Page Swarm,
    Resonator, Purge Sprayer, Mourner, Dust Husk, Garbage Collector). The status box cycles through active statuses, and
    cut stats show in orange.
  - **Immunity:** Sandbox firmware blocks corruption, and **patches** (`q t u i`, one per status) give permanent immunity.
    The patches sit in the Unallocated sectors.
  - Balance fixes found along the way:
    - Bosses are tuned against the real arriving hero (firmware and statuses), capped at 2.5× the zone's starting HP.
    - The ATK search starts at a Breached hero's DEF.
    - The sim pays full-length corruption, Field damage on about two steps per fight, and statuses that last into the
      next floor.
    - The bot also takes affordable elites.

  Final numbers: the calibrator is balanced with bosses at 20–38%, and the bot cleared 100F in 4/4 runs (HP ~2.3–3.5k at
  20F, ~4–8k at 40F, 44–73k at the end: comfortable for an optimal player late on).

Verification done this session: `genmaps` → `calibrate` (**balanced**) → `checkmaps` (**all floors ok**); headless bot runs
of the real engine (4/4 cleared 100F on the final balance); screenshots of every boss/elite in place, each mechanic, the
firmware screen and the lab gallery.

### Where session 4 left off (audio rework)
The user asked to overhaul every sound effect ("the sword is really a sword slash… attacking, getting item, effect etc."),
keeping the footstep and the dialogue text blip. Done and pushed (`a36572d`):
- **Sources live in `assets/sfx/<name>_<n>.ogg`**, credits in `assets/sfx/CREDITS.txt`. `node tools/gensamples.js` embeds
  them into `js/samples.js` (generated; don't hand-edit). Every file is CC0 (Kenney + OpenGameArt; each license page checked).
- **Blows were picked by the user, by ear.** Two rounds of Claude's picks-by-meter were rejected ("too high noise, need a more
  solid sound… more satisfying, juice feedback", then "not good, need to find again"). A loudness-matched audition of 55 CC0
  candidates settled it: `hit 3, hurt 6, crit 10, kill 2, battle 1` = retro 8-bit damage hit, qubodup meat impact, qubodup
  wood impact, retro robot death scream, seax unsheathe. They play dry, one recording each (`sfx.hit` etc. in `js/audio.js`).
  **Lesson: for anything the user must like the sound of, audition candidates and let them choose.** Numbers (band energy,
  RMS) were useful for levels, not for taste.
- **Unchanged by request:** `step`, `blip` (dialogue), `deny` (user: "the deny can stay the old sfx"). `potion` is only the
  latch click ("just the 'tick' sound is ok, no need that synth sound followed").
- Rest (Claude's design, not yet explicitly approved or rejected by the user): Rho's weapons launch with `swing` (real blade
  swish), enemies with `whoosh`; `block` is a sword clash; keycard/chip/coin/door/gear/stairs/level/roar/death are CC0
  samples with synth layers (`ring` struck metal, `powerDown`, `crackle`); a short convolver hall on everything not in `DRY`.
- Levels in `LEVEL` were set by meter in the lab after warm-up (first runs mis-read while samples were still decoding):
  hit/hurt ≈ −18 dBFS loudest-43 ms RMS, kill −17, crit −15, battle −19.
- The user asked for LF2 and 新新魔塔 audio. Claude would not download or add them (not licensed; the repo is public), but
  on request searched and gave the user links (§2). **The user will decide whether to use them**; any such file just goes in
  `assets/sfx/` under the slot's name, then run `gensamples`.

### Where session 3 left off
The user asked for this order, and the first three steps are done and merged:
1. **Rename and rework every monster, visuals and names only** (stats and balance untouched).
   - All 70 roster entries are grim machines now; brief in `docs/CONCEPTS.md`, the old art in `docs/roster-before.png`.
   - 20 monsters were renamed and 6 got new sprites (`masonII crawler bitrot feedback citizen pointer`).
   - The blood/flesh palette letters `X x m M` are gone.
   - Death decals are oil, glitch (dead pixels, 0/1) or cut cable (`remains`/`DECAL_ART` in game.js), and hit sparks match them.
2. **SFX:**
   - levels set by meter (`LEVEL` table), colder pickups, blade-on-metal hits, Kenney Impact/Interface CC0 samples
   - a **Sound Board** in `lab.html`
   - **still unheard by a human** (§7)
3. **Lore:** see `docs/LORE.md`, the cast bible, delivery rules and a floor-by-floor fragment map.
   - Every `LORE[n]` ties to its floor's machines, boss or feature.
   - `NOTES` is one graffiti pool per zone.
   - New cast: **T., the Tallyman** (a Siegmeyer-style surveyor counting strata; 6/12/43/65F, his sealed rig at 84F,
     his empty-reasoned **copy** at 88F) and **Verity** (a debugger AI who follows a hum into the Choir; 47/51/55F,
     her headset at 59F).
   - **LAMBDA** is the visible female AI companion: a projected cyan figure with an unfinished face. Her portrait frays
     from 81F (`lambdaFade`) and is only the λ strokes from 95F (`lambdaGlyph`). Her tic is "Noted."
   - Every NPC was redrawn (no cute/chibi), except the Broker, whose original sprite the user wanted kept.
   - The generator now places NPCs last, so adding one to a generated floor never reshapes the floor or moves the balance.
4. **Relay 0** (user request after the session): a quiet entrance floor below 1F where new games start.
   - What's on it: one forced Scrap Mite, one guarding a key, a cell, a door, and two story notes. See §1 and §3 Engine notes.
   - The user asked for it "for player to know what to play and how to battle… also for a bit story telling".

### Start of next session
- **Serve with `python tools/serve.py`, not `python -m http.server`.**
  - The plain server lets the browser cache the scripts. After Relay 0 was added, the user's browser kept running the old
    `maps.js` (105 floors) on :8765, even on reload.
  - `tools/serve.py` sends `Cache-Control: no-store`.
  - If a browser still shows old code, empty the cache and hard reload (DevTools open, right-click reload), or use another port.
  - Quick check in the console: `MAPS.length` should be **106**.
- The user reviewed the session-3 art in the browser and approved it, except the Broker (reverted).
- **Commits.** The user asks for commits and pushes explicitly; in session 3 they let Claude run unattended through
  commit and push. Everything through the session-4 audio rework is on `origin/main`.

**Still to do: step 4 and variation. Discuss with the user before building either.**
- **Step 4: how the main story affects play mechanics** (the user wants this *after* lore is done). Deferred candidates are in
  `docs/LORE.md` §Deferred:
  - NPC fates that depend on the player and gate items
  - LAMBDA's fading changing Scan/Compass
  - LAMBDA taking a body for one zone
  - missable meetings
- **More variation across 100 floors**, since "100 levels is quite many". See §8.

### The user's direction (session 3, verbatim intent)
- "a grim, highly technological, cyber world but lost control and abandon. dark, grim, psychological horror (the style
  only), but somehow warm in lore can be found, like interaction with npc can have different personality" (the Onion Knight
  from Dark Souls as the model).
- "no medieval, no cute, no chibi". Enemies fit best as robotic; humans can exist, "but not the enemy maybe".
- Coolant vs oil: "no need to specify… it's just an AI, cyber, grim universe, where main character is like Killy in BLAME!.
  not too much should be explained."
- Lore must connect: "if that floor is around some horrible enemy, the message lore would talk about something related".
- "a protagonist along with player, maybe a female AI that looks cool"; all lore interconnected, grim, fragmented, "leave some
  blank for imagination".
- Earlier (session 2): the game feels good to 27F, then "hollow and repetitive". Gore means **cyber/psychological, not blood**.

### Technical-term bank (use sparingly, must fit)
- **AI/ML:** transformer, attention head, token, embedding, latent space, weights, gradient, loss, overfitting,
  hallucination, checkpoint, fine-tune, dropout, epoch, inference, prompt, context window, seed.
- **Systems:** kernel panic, segfault, null pointer, stack overflow, heap, memory leak, garbage collector, zombie process,
  orphan process, daemon, fork bomb, deadlock, race condition, watchdog, bootloader, firmware, cache miss.
- **Data/network:** bit rot, checksum, parity, sector, tombstone, orphaned inode, cold storage, rollback, merge conflict,
  handshake, packet loss, TTL, timeout, 404, loopback.
- **Now in-game:**
  - Fine-Tuner, Packet Worm, Bit Rot, Zombie Process, Null Pointer, Kernel Panic, Watchdog, Afterimage, Feedback
  - Daemon, Garbage Collector, Firewall, Mother Worm (fork bomb)
  - COPY SELF, `warden.d`, tombstone manifest, loss values on a treatment chart

---

## 1. What the game is

**STRATUM** is a 100-floor tile tower RPG (魔塔 genre), modelled on **新新魔塔 (2005)**. Its UI and mechanics
stay faithful to the original. The world, story, art and sound are original.

- **World:** a BLAME!-style megastructure that machines never stopped building. Nobody has been issued a
  *Signature* (the Net's countersign on a human) for ~1100 years. The city's immune system, the **Sanitizers**, purges
  anything without one.
- **Player:** **Rho**, a silent wanderer. **LAMBDA** is an AI fragment in Rho's cracked visor. They climb
  Relay Tower 7's 100 strata to the Root.
- **Tone** (user's words): *hopeless + dark + warm*, inspired by Dark Souls and BLAME!. The world
  is cruel, with a few good moments.
- **Delivery** (user's words): "no need hint, make it darksouls… player need to figure out everything… the story is
  piece by piece, it will be revealed shattered, not linear."
- **Language:** English UI and text.

### Story beats (all text in `js/world.js`: `STORY`, `LORE`, `NOTES`, `SECRET_HINTS`, `VAULT_NOTES`, `ITEM_LORE`)
**No tutorials, no hints, nobody explains.** The only usage text allowed: the key list on H, and a one-line usage on
the Scan firmware / Phase Compass banners (user asked for those). The story comes in fragments, out of chronological
order, from unreliable sources. Few words; silence is fine; LAMBDA talks less as it degrades.

| Floor | Beat |
|---|---|
| 0F | **Relay 0**, the entrance (user request): the intro plays here. One forced Scrap Mite, one guarding a key, a cell, a door, and two notes (the intake plate whose newest name is "only two lines"; the outer gate with no handle on this side). No text hints: the floor teaches by layout. |
| 1F | The **Archivist** (a ghost that mistakes Rho for someone) gives an Amber keycard. |
| 2F | **Broker** and **Fabricator** (shop text is flavor only). |
| 4F / 25F / 58F / 87F | **Brann** chases a "Sun". Found dead smiling at a heat lamp ("FOUND IT. ISN'T IT WARM."). Gives his Drill. His "B. WAS HERE. UP." marks trail between meetings (`LORE`). |
| 13F / 35F / 45F | **Archivist**: wrote the Sanitizer firmware; forgets his daughter; finds his drowned body; "Tell the little walking man I'm sorry." |
| 16F / 53F | **Sister Ohm** lights a candle for each infant she "carried up" and the door never opened for. |
| 22F / 37F / 68F | **Pip** finds its mother: the nursery lullaby server. LAMBDA: "...I know that song." |
| 9, 27, 44, 73, 92F | The **Stranger** (identity deliberately ambiguous; possibly the original Warden). |
| 6F / 12F / 43F / 65F | **T., the Tallyman** counts strata in a pressure rig; stuck each time (narrow shutter, a leech on his air line, a purge field). His suit talks over him. His tallies and "-T" are the graffiti trail. His survey is Brann's "ten thousand" map. |
| 84F / 88F | T.'s rig, sealed from the outside, with 83 tallies and half of one (`LORE`); his **copy** (Candidate 0413, speaker `T`) finished the count and doesn't know why. |
| 47F / 51F / 55F / 59F | **Verity**, a debugger AI who speaks in log levels, recovers Archive logs, hears a hum in no spec at the Choir's edge, goes to listen. Her headset loops her last log at 59F. |
| LAMBDA | Dry, counts things, "Noted." (keeps what others forget: 1F, 10F, 80F; the 2nd shard found shows the girl taught it). Portrait `lambda` → `lambdaFade` from 81F → `lambdaGlyph` from 95F (highest floor reached). A few lines at T., Verity, and the Janitor / Librarian / Heir / Mirror deaths. |
| 11, 21 … 91F, 95F | One short line (or narration) per zone entry (`ON_ENTER`). |
| 10, 20 … 100F | Bosses: short intros; **dying lines recontextualize** earlier fragments. |
| 80 floors | **`LORE[floorNumber]`**: one authored fragment on that floor's first ordinary note (`readNote`), tied to a monster, boss, NPC or feature on or next to that floor (`docs/LORE.md` §Floor map). Other notes are graffiti from that zone's pool (`NOTES[zone]`); notes near fake walls are oblique whispers (`SECRET_HINTS`). Notes auto-show once; after that E re-reads (dimmed note + E keycap over Rho). |
| Items | Weapons, armor, Compass, Drill show one cryptic `ITEM_LORE` line in the ACQUIRED banner. |
| Vaults | Two scraps in the girl's hand (`VAULT_NOTES`) + a **Memory Shard**: LAMBDA's memories in *found* order. |
| 100F | Ending A "Forge the Signature". With all 5 shards a choice appears; "Walk away" gives Ending B (grey sky, small far sun). |

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
  The real sun exists (Ending B), small and far. The sky may be 10,000 strata up (Brann's map).
- **Pip's mother** is the nursery lullaby server ("hmmm-hm-hmmm"). The girl learned the song there, so LAMBDA knows it.
- **Endings:** A: Rho is signed and sits in the chair as the new living Warden, so the cycle continues but a hand is there.
  B: they leave the chair empty and the city unchanged, and go see the sky.
- **Motifs:** warm / cold; "keep someone warm"; the λ "little person walking"; countersign / no reply; "up".
  Fragment voices: H.'s firmware notes, OHM-7 carrier logs, Warden diary pages (older pages are found *higher*,
  the page she carried down is at 7F), candidate logs, registry and purge records, Brann's marks, and the girl.

### Zones, rosters, gear (`js/world.js` → `ZONES`)
Abilities: swift = strikes first, double = attacks twice, pierce = ignores DEF, corrupt = poison, aura = hurts when adjacent,
rollback = an older build (a lower tier of the same zone) boots on the cell when it dies (session 5).

Elites (2×2, token `7`, one per zone, each drops a firmware module): Pile Driver (Cache), Patch Bay (Sandbox), Triage
(Overclock), Drop Forge (Checksum), Tape Library (Exploit), Pipe Organ (Faraday), Incinerator (Dropout), Pallbearer
(Backprop), Blind Spot (Prefetch), Hypervisor (Multithread). Rollback pairs: Builder→Scrap Mite, Tangle→Cable Leech,
Fine-Tuner→Silicate Patient, Crane Frame→Builder Mk.II, Salvage Diver→Afterimage, Broadcast Horn→Feedback,
Enforcer→Sanitizer Mk.III, Caretaker→Zombie Process, Faceless→Dust Husk, Watchdog→Daemon.

| # | Floors | Zone | Weapon / Armor | Tiers 1–6 | Boss |
|---|---|---|---|---|---|
| 1 | 1–10 | Dead Concrete | Rebar Machete / Faraday Vest | Scrap Mite, Live Wire (swift), Silicate Husk, Watch Drone (swift), Sanitizer, Builder | The Janitor |
| 2 | 11–20 | Cable Nave | Arc Cleaver / Cable Mesh | Cable Leech, Packet Worm (corrupt), Spark Drone (swift), Tangle, Sentry (aura), Sanitizer Mk.II | Mother Worm |
| 3 | 21–30 | Silicate Wards | Scalpel Edge / Ceramic Plate | Infuser, Silicate Patient (corrupt), Orderly, Needle Drone (swift), Glass Hound (double), Fine-Tuner (corrupt) | The Surgeon |
| 4 | 31–40 | The Foundry | Rivet Greatsword / Slag Armor | Slag Crawler, Welder Drone (swift), Riveter (double), Walking Furnace (aura), Builder Mk.II, Crane Frame | The Foreman |
| 5 | 41–50 | Drowned Archive | Index Rapier / Archive Cloak | Afterimage (pierce), Index Crawler (double), Bit Rot (corrupt), Salvage Diver (corrupt), Page Swarm (swift), Read Head | The Librarian |
| 6 | 51–60 | Choir of Static | Resonance Blade / Choir Shroud | Chorus Array (pierce), Arc Emitter (swift, pierce), Feedback (swift), Broadcast Horn (aura), Resonator (double), Echo (pierce) | The Choir Mother |
| 7 | 61–70 | Quarantine | Purge Saber / Quarantine Suit | Specimen, Sanitizer Mk.III, Containment Cage (swift), Purge Sprayer (aura), Enforcer (double), Hunter Hound (swift, double) | The Gatekeeper |
| 8 | 71–80 | Graveyard of Signatures | Grave Scythe / Mourning Coat | Dead Record (pierce), Hollow Citizen (corrupt), Zombie Process (corrupt), Mourner (pierce), Caretaker (double), Obituary Crow (swift) | The Last Heir |
| 9 | 81–90 | Silent Stratum | Null Edge / Silence Weave | Lacuna, Null Pointer (swift, pierce), Dust Husk, Stilt Stalker (swift, double), Monolith (aura), Faceless | The Mirror |
| 10 | 91–100 | The Root | Root Brand / Kernel Plate | Kernel Panic, Daemon (pierce), Root Sanitizer, Firewall (aura), Watchdog (swift, double), Garbage Collector | WARDEN//ROOT |

Every monster is a machine (session 3 rework, `docs/CONCEPTS.md`). Palette-swap families: the Sanitizer line (Mk.II, Orderly,
Mk.III, Root), drones (Spark, Welder), hounds (Glass, Hunter, Watchdog), ghosts (Echo, Dead Record), husks (Dust Husk).

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
5. **User direction, session 1** (in order):
   - "Faithful juice, sound and effect"; a 3-floor prototype first; 新新-style random combat; English UI
   - "Create your own universe… the game mechanic, overall style, UI can be faithful"
   - "AI and computer… cyber tech fantasy, like BLAME!"; "UI more faithful to 新新魔塔"
   - "No need to show the HP for monster… a skill… buy from NPC"; "Battle UI should show all the stats, two icon frames, square"
   - "Full cyber, the potion is not matching the theme… real-world terms (computer components)"
   - Asked whether original audio/PNG could be downloaded (see §6); chose "Mix: CC0 SFX + own art" and "Original 2005" layout
   - "Loop yourself… full game (100+ levels)… hidden paths, NPCs, dialogue… Dark Souls + BLAME!… hopeless + dark + warm"
6. **User direction, session 2** (in order):
   - Idle animation: "more variation, apart from blobbing up and down. maybe flip the sprite or add other animation"
   - Tiles: "more pixel art like, and more minimalist… easy to understand, like the key, the door… variation on stair
     according to their facing side… handle all cases beautifully"
   - Attacks: "for player, make it more special and epic… changed… if they acquire different weapon. for enemy, add
     different attack effect too"
   - "no need hint, make it darksouls… player need to figure out everything… story… revealed shattered, not linear"
   - "add more enemies"; "add more level" → clarified as **hand-craft more floors** (keep 100)
   - "the sprites (character) are still too cute. need to be more cyber dark, gore" → later corrected to **cyber/psychological
     gore, not blood** (§0)
   - "move once cell when I press once"; arrive **on** the stair tile; take items **without stepping onto them**
   - Notes: don't re-show every time; **E to re-read**, with a small E tooltip
   - "some floor should not be reach with compass, by design… abandon level" → boss floors, lore floors, floors with hidden passages
   - When acquiring Scan / Compass, show what they do
   - Weapon pickup looked like a sword but attacks didn't read as changing → **all weapons are blades**
   - Enemy (and then player) attacks: **no ray/projectile lines**, "just the effect"; **no charge/recoil**; "the whole square
     can stay untouched… the character or enemy can have impact effect but not the whole icon frame cell"
   - A separate dev page to preview effects → `lab.html`
   - Playtest to 27F: feels good; later "hollow and repetitive" (§0)

### What research turned up (session 1; no new web research in session 2)
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
- Original mechanics worth borrowing (status now):
  - monster book item (done: Scan firmware from the Broker)
  - feather flight, F key (done: Phase Compass, with ABANDONED floors)
  - blood decal where monsters die (done, but must become cyber-gore, §0)
  - the 隨意門 "anywhere door" (T key): **not done**
  - old men teaching skills (e.g. reflect damage): **not done**
  - floor naming 主塔 / 地下 / 神秘樓, hidden mystery-floor chain: **not done**
- **Kenney assets are CC0:** https://kenney.nl/support ("all game assets on the asset pages are public domain licensed (CC0)… even in commercial projects… Attribution is not required").
  - Sci-fi Sounds: https://kenney.nl/assets/sci-fi-sounds (zip: https://kenney.nl/media/pages/assets/sci-fi-sounds/6b296f9ecf-1677589334/kenney_sci-fi-sounds.zip)
  - Interface Sounds: https://kenney.nl/assets/interface-sounds (zip: https://kenney.nl/media/pages/assets/interface-sounds/fa43c1dd4d-1677589452/kenney_interface-sounds.zip)
  - Impact Sounds: https://kenney.nl/assets/impact-sounds (zip: https://kenney.nl/media/pages/assets/impact-sounds/87b4ddecda-1677589768/kenney_impact-sounds.zip)
  - License text copied to `assets/LICENSE-kenney.txt`.
  - For SFX polish: other Kenney audio packs and OpenGameArt (filter by CC0) are candidates; **verify each license page** before use.
- **Session 4 audio research.** CC0 packs, license checked on each page. The used ones are listed with files in `assets/sfx/CREDITS.txt`.
  - Used: Kenney [RPG Audio](https://kenney.nl/assets/rpg-audio); OpenGameArt
    [Swishes](https://opengameart.org/content/swishes-sound-pack), [RPG Sound Pack](https://opengameart.org/content/rpg-sound-pack),
    [20 Sword SFX](https://opengameart.org/content/20-sword-sound-effects-attacks-and-clashes), [Punch](https://opengameart.org/content/punch),
    [Impact](https://opengameart.org/content/impact), [512 SFX 8-bit](https://opengameart.org/content/512-sound-effects-8-bit-style)
    (Juhani Junkala; best fit for a 2005 魔塔 feel), [Fantasy weapons library](https://opengameart.org/content/fantasy-weapons-and-apparel-sfx-library).
  - Auditioned, not picked: [37 hits/punches](https://opengameart.org/content/37-hitspunches) (slow onsets),
    [40 wet towel hits](https://opengameart.org/content/40-wet-towel-clubpoundhitattack-sounds), [5 hit sounds](https://opengameart.org/content/5-hit-sounds-dying),
    [NES sounds](https://opengameart.org/content/nes-sounds), [Metal clang/explosions](https://opengameart.org/content/metal-clang-explosions-zing),
    [crash](https://opengameart.org/content/crash-collision), [100 CC0 SFX](https://opengameart.org/content/100-cc0-sfx).
  - Not CC0 (skip): several OGA hit packs are CC-BY 3.0 / GPL (e.g. punch-slap-n-kick, wall-impact, osare-10, jute-dh-rpgsounds).
  - The fantasy library's 43 sword-knife clashes are ~99% energy above 3 kHz (thin, hissy); fine as a layer, not as a blow.
  - Windows' `C:\Windows\System32	ar.exe` extracts `.7z`; ffmpeg (WinGet) is on PATH.
- **LF2 audio:** copyrighted (Marti Wong / Little Fighter Co); no reuse license found ([Wikipedia](https://en.wikipedia.org/wiki/Little_Fighter_2)).
- **新新魔塔 audio links the user asked for** (no license stated; for the user's own decision, not added by Claude):
  4399 Flash https://www.4399.com/flash/1783.htm · 3DM PC https://dl.3dmgame.com/pc/87774.html ·
  v1.42 Flash https://www.wanyx.com/game/20593.html · h5mota HTML5 remake https://h5mota.com/tower/?name=xinxin ·
  h5mota asset library https://h5mota.com/collection/ · mota-js template sounds (repo BSD-3-Clause; sounds' origin unverified)
  https://github.com/ckcz123/mota-js/tree/master/project/sounds
- **Inspiration list** (for tone only; never copy): BLAME!, Biomega, NOiSE, Knights of Sidonia (Tsutomu Nihei);
  Dark Souls item-description lore; Hollow Knight; Signalis; SOMA; NieR:Automata; Serial Experiments Lain; Ghost in the Shell.
  (From memory, not researched this session.)

---

## 3. Architecture

Plain browser JS with no build step or modules, so it works from `file://`. Scripts load in this order (`index.html`,
and `lab.html` loads the same list):

| File | Role |
|---|---|
| `js/bigsprites.js` | Big machines' art (session 5): 48×48 bosses (replacing their 16px sprites) and 32×32 elites, `Object.assign(SPRITES, …)`. Loaded right after `data.js` |
| `js/data.js` | Core rules (session 5 adds `BODY_SIZE`/`bodyAnchor`/`bodyCells`, `MODS`/`kit`/`heroBlow`/`monsterBlow`, `podsWaking`, `GATE_SWAP`): `PAL` palette, `SPRITES` (16×16 char art, auto-outlined; idle frames sit right after their base, e.g. `miteB`, `sanitizerL`), `VARIANTS` (palette swaps), `ITEMS` kinds, `DOORS`, `ABILITIES`, `hitChances`, **`battleCost`** (the single luck-aware damage formula, shared by the Scan screen and the calibrator), `HERO_START`, `expToNext`, `levelGain`, `fabricatorCost`. `heroDw`/`heroUw`/`heroRw` = Rho holding a blade. Newer monster sprites are in the `Object.assign(SPRITES, …)` block at the end |
| `js/world.js` | Content: `ZONES` (theme, music, gear names, 6-tier roster + boss with abilities/swaps/dialog keys), hand-made maps (`MAP_1F`/`2F`/`3F`, `AUTHORED` = 60 authored floors keyed by floor number, `VAULT_MAPS[5]`), `FLOOR_PLAN` (per-floor specials; `.map` = authored layout), `ABANDONED`, `VAULTS`, `ON_ENTER`, `NPCS`, `PORTRAITS`, `NOTES`, `SECRET_HINTS`, `LORE`, `ITEM_LORE`, `STORY`, `zoneMonster()` |
| `js/maps.js` | **Generated** by `tools/genmaps.js`: `MAPS[105]` (100 main + 5 vaults) and `MAP_META` (npcs / notes / vault links per floor) |
| `js/balance.js` | **Generated** by `tools/calibrate.js`: `BALANCE[zone]` = monster stats per tier, item values, poison, shop, broker prices |
| `js/music.js` | `MUSIC` score: 14 tracks as 8-bar eighth-note strings (`C#5`, `-` hold, `.` rest), optional `wave`, `hat` |
| `js/samples.js` | Generated by `node tools/gensamples.js` from `assets/sfx/<name>_<n>.ogg` (CC0: Kenney + OpenGameArt sword packs; sources in `assets/sfx/CREDITS.txt`) as base64, embedded so `file://` works |
| `js/audio.js` | `Sound`: WebAudio SFX on CC0 samples (user-picked `hit hurt crit kill battle`; blade `swing`, `clash`, `draw`, metal, punch, coins, latch...) plus synth layers (`ring` struck metal, `powerDown`, `crackle`), a short convolver hall on everything not in `DRY`, a per-sfx `LEVEL` table in dB, a safety limiter, and a music sequencer |
| `js/game.js` | Engine: state, input, movement, combat, UI, rendering. Art/FX tables: `IDLE`/`IDLE_STYLES`/`idlePose`/`drawIdle` (per-sprite map idle), `WEAPON_FX`/`BARE_FX` (player attack per `G.weapon`), `BLADE_TINT`/`heroSprite` (Rho's blade by tier), `ENEMY_FX`/`enemyFx` (enemy attack by sprite → alias list → ability → default), `stairFacing`/`stairSprite`, `remains`/`DECAL_ART`/`decal` (death decals: oil, glitch, cable; `SPRAY` hit sparks), `drawKeyTip` |
| `lab.html` | Dev page (§5) |
| `tools/` | `genmaps.js`, `calibrate.js`, `checkmaps.js`, `playbot.js`, `load.js`, `seeds.json` (§4) |

### Map tokens (zone-relative)
`#` wall · `.` floor · `%` fake wall (looks like a wall, bump to reveal) · `U`/`D` stairs · `^` vault stairs ·
`P` start · `S` Fabricator · `M` Broker · `O` NPC (id in `MAP_META.npcs`) · `L` Root Terminal · `n` floor note ·
`y b r` keycards · `Y B R` shutters · `h H` cells (HP) · `a` CPU (ATK) · `d` RAM (DEF) · `w` weapon · `e` armor ·
`v` antivirus · `c` Phase Compass · `*` memory shard · `1–6` monster tiers of the zone · `7` elite (a 2×2 block) · `9` zone boss (a 3×3 block) ·
`~` water · `k` pump · `!` alarm plate · `z` sealed pod (in a wall) · `=` shut gate · `-` open gate · `j` lever ·
`&` hidden warp (to/from an Unallocated sector; `WARPS` in world.js).
Item and monster numbers come from `BALANCE[zone]`, so the same map token scales automatically with depth.

### Engine notes (`js/game.js`)
- Logical canvas **576×432** (4:3). Map origin `MX=192, MY=48`, 11×11 tiles of 32 px. Left panels start at x=24.
  The canvas scale snaps to half-steps of device pixels.
- Modal UI types: `dialog | banner | battle | shop | book | help | fade | goal | fly | choice`. `banner(text, color, label, then, lore, use)`.
- Combat: the hero swings first unless the monster is `swift`. Per swing: miss/crit come from `hitChances` (CRIT% ×2, each AGI point of
  advantage adds 3% dodge, clamped 2–40%), damage is ±10%. `double` = two attacks per turn, `pierce` ignores DEF,
  `surge` = every 3rd hit ×2 (bosses), `corrupt` = poison for 60 steps (refreshed on re-infection, auto-cured by stored
  antivirus, never kills: minimum 1 HP), `aura` = damage when you step next to it (minimum 1 HP).
- Save: `localStorage['stratum-save-v3']` holds the whole `G` state (maps included). Fields added in session 2:
  `G.weapon` (zone index of best weapon, -1 = none), `G.decals[floor]`, `G.read` (read notes); `load()` back-fills all three.
  **Saves from before session 2 carry old maps; start a new game.**
- **Relay 0 (`ENTRANCE`)** is stored at index 105, after the vaults, so indices 0–99 stay 1F–100F. `floorAbove`/`floorBelow` link
  it to 1F (whose old `P` is now a `D`), `depth()` gives it -1 for labels and zone, and `isMain` keeps it out of the Compass and
  LAMBDA's portrait stage. `load()` back-fills it into old saves. genmaps builds it from `MAP_0F` + `ENTRANCE_NOTES`.
- Movement: one cell per key press (held keys only step again via OS key-repeat, and only when idle). Items are taken
  from the adjacent cell without moving. Changing floor puts the hero on the arrival stair tile itself.
- Notes: shown automatically only the first time (`G.read`, keyed `floor:x,y`); after that they're dimmed, an E keycap
  shows over Rho when standing on one, and E re-reads it.
- `ABANDONED` (world.js): floors the Phase Compass can't reach (boss floors 10…100, vault-entrance floors 15/33/48/66/84,
  and 45F/68F/87F). Shown as `-- NO SIGNAL --` on the jump screen; Enter is refused. The calibrator and playbot only
  phase back to shops on reachable floors.
- Map idle: every monster/NPC has a style keyed by base sprite name (skitter, hover, glitch, shamble, stance, slither,
  stomp, sentry, pant, dread, breathe); creatures face Rho and glance away; bosses are slower with a red pulse.
  Unknown sprites default to `breathe`.
- Battle FX: every attack plays on the target portrait only (no projectiles or beams across the gap, no lunge/recoil).
  The 48px portrait frames never move or get filled: only the sprite inside is knocked back/shaken (`b.sh`), flashed
  white, or tinted (`fxFrame` = sprite silhouette). Box washes use `boxFill`/`fxOutside`, which cut the frames out.
  Crits: hit-stop, white box flash (frames excluded), speed lines, 1.5× size.
- Weapons are melee blades. Each tier has its own shape in `WEAPON_FX` (`fxSlit` straight cuts, `fxArc` curved sweeps):
  bare jab, diagonal hack, flat electric cleave, bleeding X, falling greatsword + shockwave, rapier thrust flurry,
  full-circle ring, burning Z, huge scythe hook, void tear, λ cut + light pillar. Owning a weapon swaps Rho's gun arm
  for a blade tinted by tier (map, status panel and battle portrait). The Mirror boss copies Rho's current blade.
- Enemy FX (`ENEMY_FX`): bite, zap crackle, slam + floor ring, purge splash, lash, falling slab, lock + burn, hit burst,
  claws, static, scalpel X, sound rings, cleave, light pillar (WARDEN); ability fallbacks for pierce/corrupt/double/
  surge/swift; newer sprites alias a base in the list after `ENEMY_FX`.
- **Big bodies:** tiles of a 2×2 elite / 3×3 boss all hold its token; `bodyAnchor` finds the top-left cell. `engage`
  fights from the anchor, `endBattle` clears every cell (and leaves a decal on each), `drawMap` draws the body once at
  the anchor at 2×/3× tile size. Sprites can be 16/32/48 px square; idle poses keep their meaning (band cuts in 16ths of
  the sprite, motion in art pixels). Battle portraits of big sprites fill the frame (44 px).
- **Firmware:** `G.mods` (owned, id → level), `G.slotted` (running), `G.slots`. `giveMod` slots a new module while a slot
  is free. The Fabricator's "Rewire firmware" row opens the `firmware` modal (Enter slots/unslots, → upgrades for
  `BALANCE[z].shop.upgrade`). Battle: Exploit/Faraday via `heroBlow`/`monsterBlow`, Overclock's crit multiplier in `roll`,
  Multithread's second strike (like `double`), Checksum absorbs the first landed blow, Backprop returns damage,
  Cache heals after the win, Sandbox blocks corruption, Scavenger/Compiler scale rewards. `load()` back-fills the fields.
- **Floor mechanics:** `wade`, `drain`, `tripAlarm`, `pullLever`, `reveal`/`inSight`/`seen` in game.js; `alarmT` drives
  the red strobe.
- Keys: arrows, Enter/Space/Z, Q retreat, E re-read note, M scan (needs firmware), F Phase Compass, S/L, N mute, R twice restart, H help.
  The touch pad appears on `(pointer: coarse)`.

---

## 4. Content pipeline & balance model

```
node tools/genmaps.js     # js/maps.js from world.js (FLOOR_PLAN + AUTHORED); per-floor seed overrides in tools/seeds.json
node tools/calibrate.js   # js/balance.js; must end with "balanced: all 10 zones cleared"
TRACE=1 node tools/calibrate.js   # prints every simulated fight
node tools/checkmaps.js [--all] [floor…]   # validates tokens, stair rules, specials, lore notes, key-order softlocks
```
`tools/load.js` loads the browser scripts into one Node `vm` context, so the tools use exactly the game's data and formulas.

**Authored floors:** `AUTHORED[floorNumber]` = an 11-row map; one line after `FLOOR_PLAN` applies it as `.map`.
The floor's `FLOOR_PLAN` entry still decides its NPC (→ the map's `O`), vault link (→ `^`) and required specials.
Authored: 4, 9–17, 19–33, 35, 37, 39–42, 44–46, 48–51, 53, 58–60, 64, 66, 68–71, 73, 79–81, 84, 87, 89–92, 99, 100,
plus 1F–3F (`MAP_1F/2F/3F`) and the 5 `VAULT_MAPS`. Every authored main floor needs at least one ordinary `n` (its `LORE`
fragment lands there). `checkmaps` enforces it and brute-forces every shutter-opening order for softlocks.

**Generator** (`tools/genmaps.js`), for the remaining 37 floors:
- Recursive division: walls on odd lines, doorway gaps on even cells, rooms with even bounds.
- Down stairs go in a roomy region, up stairs in the farthest region, only on room corners or corridor dead ends.
- Gaps on the main path get guard monsters or Amber shutters; main-path keys are reachable without opening any door.
- Secret rooms are dead-end regions sealed with `%`, holding loot and a whisper note outside.
- Monster tiers rise with the floor's position in its zone.

**Calibrator** (`tools/calibrate.js`):
- Works zone by zone from the hero's simulated state at the zone's start.
- Each tier has targets (`TIERS`: swings to kill, DEF as a share of hero ATK, fight cost as a share of HP, and the
  floor it's tuned for). A binary search sets each monster's **ATK** so the luck-aware `battleCost` hits that target exactly.
- The simulated player climbs floor by floor, takes cheap fights, prefers doors toward the stairs, skips costly optional
  fights once the stairs are reachable, and only backtracks (by compass, reachable floors only) to a Fabricator or Broker.
- Bosses are tuned against a reference hero with `BOSS_MARGIN` (85% HP, 95% ATK), so they cost `BOSS.f` of that reference.
- Secret rooms, vaults and NPC gifts are **not** in the simulation, so they are pure bonus.

**Session 5 changes to the model:**
- `FIRMWARE[z]`: the share of fight cost firmware is expected to save by zone z. Monsters are tuned so a hero
  *without* firmware pays `tier.f / (1 - FIRMWARE[z])`, so a typical build pays about `tier.f`. The calibrator logs
  the saving its own player's loadout actually gets on each zone ("firmware … saves n%").
- The simulated player slots firmware by a fixed taste (`MOD_TASTE`), upgrades slotted modules before buying stats,
  takes elites under 40% HP, pays one wade per flooded cell and uses a pump when it reaches one, pulls a lever or trips an
  alarm only when otherwise stuck.
- `levelGain` HP is `40 × 1.045^lv` (was 4% of current HP + 50, which let any lead snowball).
- Corruption costs one dose (poison × 30) per floor, not per corrupt fight.
- New `BALANCE` fields: `flood`, `shop.crit` (3), `shop.agi` (1), `shop.upgrade` ([150, 450] × 1.45^z), `broker.mod`.

**Session 5 numbers** (final): calibrator HP 1000 → 2.6k (10F) → 3.3k (30F) → 4.0k (50F) → 6.1k (70F) → 8.1k (90F)
→ 17k (100F); bosses cost 31–45% of the arriving hero's HP; "balanced: all 10 zones cleared". The in-engine bot
(tools/playbot.js, which now slots/upgrades firmware like the calibrator and handles pumps, levers and alarms) cleared
100F in 4/4 runs: HP ~2.2k–4k through 20–40F (tight), ~7–9k at 60F, ~15k at 70F, ~52–64k at the end. One earlier run
on a harsher curve died at 55F.

**Last verified numbers** (end of session 2, calibrator, realistic player):
```
zone  1 hp 1000->2897   atk 10->46      zone  6 hp 4228->10058  atk 342->541
zone  2 hp 2897->3027   atk 46->80      zone  7 hp 10058->12368 atk 541->826
zone  3 hp 3027->6994   atk 80->128     zone  8 hp 12368->22746 atk 826->1339
zone  4 hp 6994->4559   atk 128->210    zone  9 hp 22746->25729 atk 1339->2117
zone  5 hp 4559->4228   atk 210->342    zone 10 hp 25729->19145 atk 2117->3425
bosses cost 31–36% of the reference HP; "balanced: all 10 zones cleared"; ~10k gold unspent at the end
```
**In-engine bot** (`tools/playbot.js`, real engine, random combat, fresh page per run): after all session-2 merges it won
7/8, then 4/4 and 2/2 after later fixes. Wins end with WARDEN//ROOT dead (`G.flags.boss99`); the bot can't walk to `L`, so its
log ends "STUCK F100". The one loss stalled on 94F with no Cyan key and low HP. Typical run: ~1,120 kills, lowest HP between
floors ~800–1,250, 20k–70k HP at the end.

---

## 5. Verification & testing tips

- Serve locally: `python tools/serve.py [port]` (no-cache static server; default 8765). The plain `python -m http.server` lets the
  browser cache scripts, so edits may not show (see §0).
- **Dev lab: `lab.html`** runs the real engine with a side panel:
  - Rho's weapon tier and any of the 70 enemies
  - forced outcome (hit, crit, miss, block)
  - single swings (buttons or A / D) or auto-loop
  - slow motion (0.05×–2×) and fast mode
  - floor jump to any floor or vault
  - idle gallery of every character
  - sound toggle
  - Sound Board: plays every sfx, a few sounds that land together, and every track, with live peak / loudest-43 ms RMS in dBFS
  - For level checks in automation, wait ~4 s after the first click so every sample has decoded, and repeat each sfx a few
    times (variants are picked at random).
- **Choosing sounds:** build a throwaway audition page (candidates trimmed and loudness-matched, a pick per slot, a line to paste
  back) and serve it on another port; session 4 did this from the scratchpad, not the repo.

  Battles never end in the lab. It wraps `update`, `roll`, `updateBattle`, `render` and `resize` from outside, so game code needs no hooks.
- **Headless verification that worked well** (session 2): Python `playwright` with your own Chromium and a private server port.
  The Playwright MCP browser is shared between parallel agents, and they clobbered each other's tabs.
- **Background tabs throttle `requestAnimationFrame`**, so step the loop manually in automation:
  `for (let i = 0; i < 40; i++) update(0.05); render();`
- Top-level `let/const` are reachable from `page.evaluate` (e.g. `G`, `ui`, `newGame()`, `changeFloor(f, 'D')`,
  `tryMove(dx, dy, dir)`, `monsterAt(ch)`, `battleCost(G, m)`, `startBattle(x, y, ch)`, `pickUp(ch, x, y)`).
- Smoke test: `eval(await (await fetch('/tools/playbot.js')).text()); newGame(); await playbot(100)`.
- Console cheats for playtesting: `G.hp=1e6; G.atk=G.def=1e5; G.weapon=9; changeFloor(89,'D')` (floor index = floor − 1).
  Floors reached this way are not in `G.visited`, so the compass won't list them.
- Mechanics verified in session 2: one step per press (incl. OS key-repeat mid-move), item pickup from the adjacent cell,
  arrival on stairs, re-entering stairs, note re-read + E keycap, save/load of `read`/`decals`/`weapon`, ABANDONED jump refusal,
  Scan/Compass usage banners, every weapon tier and enemy FX (contact sheets), full bot runs.

---

## 6. Decisions & constraints

- **No ripped 新新魔塔 assets.** The user asked about downloading the original PNG/audio; declined (unlicensed third-party
  work, doesn't fit the theme). Use **CC0 only** (Kenney, or OpenGameArt filtered to CC0).
  - Session 4: the user said they don't mind using 新新魔塔 or LF2 audio. Claude still wouldn't fetch or commit it, but gave
    links (§2) so the user can decide. If the user adds such files themselves, that is their call.
- **Sound choices that matter to the user are made by ear** (session 4): audition, don't pick by measurement alone.
- Art is procedural and hand-drawn 16×16 character-grid sprites with an automatic dark outline and palette swaps.
- Monster stats are hidden until the player buys **Scan firmware** from the Broker (2F). No damage numbers on the map.
- Retreat (Q) in battle restores nothing: the monster keeps full HP.
- **Souls-style:** no tutorials or hints; only the H key list and the Scan/Compass one-line usage.
- **Gore = cyber/psychological** (session 2 correction), not literal blood. See §0.
- **Battle presentation:** melee only, effects on the target portrait, frames never move or fill, no lunge/recoil.
- **Weapons are blades** (the pickup sprite is a sword; names were changed from guns to match).
- **Abandoned floors** are deliberate (user design): compass can't reach boss, lore and hidden-passage floors.
- Movement: one cell per press; items taken from the adjacent cell; arrival on the stair tile.
- Earlier iterations, now replaced: "PHAROS: The Drowned Lighthouse", then a 3-floor STRATUM prototype.

---

## 7. Known issues & limitations

- **Audio:** the user listened in session 4 and chose the blows by ear (§0). The other new sfx (pickups, door, gear, stairs,
  level-up, roar, death, weapon launches) got no explicit verdict yet; ask. `LEVEL` in `js/audio.js` is set by meter.
- **Nobody has watched the idle animations or battle FX at real speed**; they were verified frame by frame. Use `lab.html`.
- Weakest reads after the rework: Chorus Array (looks like a lattice), Resonator's small hammers, and the dark-grey bodies of
  Scrap Mite / Mother Worm / Janitor on dark floors (readable, dim). The Archivist is deliberately faint.
- Monster *thought lines* on Scan (a Dream-Nail-style line per enemy) were proposed in research but not built.
- Rho's dialog portrait (`PORTRAITS` in world.js) still shows the gun arm, not a blade.
- Ghost and corrupt enemy FX draw scan-line/glitch marks over Rho's portrait cell (marks, not fills; user hasn't ruled on it).
- 37 floors are still generated; 10 of them can softlock if keys are spent badly (the Broker sells keys; `checkmaps --all` lists them).
  1F–3F are unchanged originals; 3F's up stair is open on three sides and can softlock with a bad door order (warning only).
- 84F's diagonal stair and 100F's roots read as scattered blocks (walls touch only at corners).
- In battle, the damage floater can overlap the monster's name at the top of the box.
- **Late game still leans easy for an optimal player** (session 5: the bot ends with 3–4× the calibrator's HP from zone 7 on; its
  firmware loadout and rewards snowball less than before but still do). Levers: `FIRMWARE` for zones 7–10, `TIERS.f`, `BOSS.f`.
- Gold piles up late (~12–15k unspent even with firmware upgrades as a sink). The Fabricator cost curve `20+10n+2n²` or
  `UPGRADE` in the calibrator could be retuned, or more sinks added.
- **Session 5 art is unreviewed by the user.** The art agents flagged: the Janitor's segmented spine may read as a ribcage;
  Mother Worm's port-ring maw may read as an eye; Triage carries a sheet-covered form with a toe tag (a deliberate human
  trace; drop it if unwanted); Blind Spot reads mostly as a lit edge at portrait size; Hypervisor is the least uncanny.
  The generator scripts live in the session-5 scratchpad only, so edit `js/bigsprites.js` directly.
- Only 64F/69F have alarms and only 66F has a lever; the other Quarantine floors (five of them generated) are plain.
- The flood pump is placed automatically (farthest dry cell that blocks nothing), so on some floors it sits right by
  the entrance and the water is trivial.
- The Scan screen has room for about 7 monster rows (fine: 6 tiers + boss per floor).
- "Status" only shows NORMAL / CORRUPT.
- The ending screen still shows "x/5 shards" (kept on purpose as post-game info).
- Fonts load from Google Fonts; offline falls back to monospace. `~` renders oddly in VT323 on the Scan screen.
- Git warns about CRLF line endings on Windows (harmless). No credits page for Kenney (CC0 doesn't require one).

---

## 8. Next steps and ideas

### Session 5: discuss first
1. **Story → mechanics** (see §0 and `docs/LORE.md` §Deferred).
2. **Variation over 100 floors**: the hooks below are still all unbuilt; zone floor mechanics and new enemy abilities
   were the session-3 recommendation (plus an Archive/Codex for collected fragments).
3. Audio: ask the user about the non-blow sfx (§0, §7). If any are disliked, audition CC0 candidates as in session 4.
   The user may drop in their own files (e.g. from the 新新魔塔 links in §2); then run `node tools/gensamples.js` and re-level.

### Candidate hooks for "hollow and repetitive" after ~27F (for discussion, none built)
- **Collect-to-understand:**
  - an in-game **Archive/Codex** that stores every fragment found (notes, shard memories, item lore, boss last words),
    ordered by *where found* with gaps shown as `[CORRUPTED]`, so missing pieces pull the player to explore
  - a **bestiary** entry per monster, unlocked by Scan or first kill, each with a lore line
- **Floor variety:**
  - per-zone floor mechanics:
    - dark floors with limited sight (Silent Stratum)
    - conveyors or one-way corridors (Foundry)
    - flooding tiles that drain HP (Drowned Archive)
    - alarm tiles that wake a Sanitizer (Quarantine)
    - switches that reroute shutters
  - 新新魔塔-style puzzle rooms
- **Build choices:**
  - NPC-taught skills like the original's reflect damage (e.g. "backprop" = reflect, "dropout" = dodge)
  - implants with trade-offs, or boss drops that grant a passive
  - choosing between two rewards on authored floors
- **Hidden chain:**
  - a 神秘樓-style secret floor chain, e.g. "unallocated sectors" reached from special points
  - an 隨意門-style item, e.g. a *loopback* that returns to the last stair
- **Risk/reward:** cursed or corrupted items; optional elite monsters guarding lore; gold sinks such as buying fragments
  from the Broker or restoring memories.
- **Pacing:**
  - a mid-zone event on every 5th floor (NPC, choice or ambush)
  - shortcut doors that open back to earlier floors (Dark Souls style) to make the tower feel connected
- **Enemy variety:** new abilities (shield/firewall absorbs the first hit, drain, summon/fork, explode on death, regen),
  so fights change between zones and not only their numbers.

### Also open
- Hand-design the 37 generated floors (start with the 10 softlock-prone ones); readability pass on 84F/100F.
- Hero walk frames; Rho's blade in the dialog portrait.
- Difficulty options (scale `TIERS.f` / `BOSS.f`) and a credits screen.
- Offline fonts: self-host OFL fonts in `assets/`.
- Deploy with GitHub Pages from `main` (not set up yet). Mobile: test the touch pad on real phones.
