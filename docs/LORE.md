# STRATUM: Lore & Cast Bible (session 3)

This is the working brief for the lore pass. The hidden truth is in HANDOFF §1 (story bible); nothing here contradicts it.
The research behind these choices (Souls NPC design, BLAME!, Signalis, NieR, Harvey Smith's rules) is summarised under "Research" below.

## Delivery rules
1. **Every fragment belongs to its floor.** Each `LORE[n]` names or implies something on that floor or an adjacent
   one: a monster that lives there, the boss above, a map feature, an NPC nearby. If a floor is full of Fine-Tuners,
   its fragment is about correction; if the Janitor is on 10F, 9F is "swept, too clean". `docs/LORE.md` §Floor map
   records what each fragment ties to.
2. **Graffiti comes by zone.** The random `NOTES` scrawls become one pool per zone, written by people who passed
   through *that* place and saw *those* machines. Nothing repeats across zones.
3. **Budgeted blanks.** Each hidden fact gets at most one partial statement, some are missable, and one vital noun
   is always left out. Nobody explains. No tutorials or hints.
4. **Grim, but warm in places.** Each character has one want, one tic, and one place where they're stuck. Characters
   move between meetings off-screen, and what's left behind speaks last.
5. **Machines are named by function.** Monster names are in `ZONES`. Fragments may name the machines, but never
   explain mechanics.

## Cast

### LAMBDA: the companion (female AI)
- **What:** the AI fragment in Rho's cracked visor, written by the Archivist's unsigned daughter (HANDOFF §1).
- **Look (dialog portrait):** a tall, thin figure projected in the visor crack, built from the girl's stylus
  drawings: λ-straight posture, scanline hair, cyan light. **Her face is unfinished**: the girl never finished drawing it.
- **Arc you can see:** `lambda` (whole) → `lambdaFade` from 81F (pixels missing, scanlines torn) → `lambdaGlyph`
  from 95F (only the two walking strokes of λ remain).
- **Voice:** dry, precise, counts things, short imperatives ("Up."). One warm line per zone at most. She speaks less as she fades.
- **Tic: "Noted."** It is how she files something to keep. A shard shows where it came from: the girl taught her that
  "noted" means *you'll keep it*.
- **Late secret:** she has known about the key since before the climb began, and she chose to keep it quiet (the last shard).

### T., the Tallyman (new; the Siegmeyer role)
- **What:** a stout human surveyor in a bulbous pressure rig, counting strata by hand for a census nobody requested.
  He is the "-T" and the tally marks in the graffiti.
- **Want:** to know how high it goes. **Tic:** the suit talks over him mid-sentence ("Hm. Hm-hm. …RE-PRESSURIZING. Ah!").
- **Stuck every time:**
  - a shutter too narrow for his rig
  - something drinking his air line
  - a purge field he can't cross
- **Link:** his survey sheet is the map Brann finds ("ten thousand").
- **End:**
  - In the Silent Stratum his rig is found sealed from the outside, with an unfinished count scratched inside.
  - Later his **copy** stands there, polite and perfect. It finished the count and doesn't know why he wanted it.
    It is Candidate 0413 (reason field: EMPTY).

### Verity (new; the Laurentius/Logan role)
- **What:** a debugger AI in a scavenged maintenance body, still attached to a process that ended long ago.
- **Voice:** she speaks in log levels ("WARN: you look tired. INFO: I have a spare cell.").
- **Want:** to find the bug.
- **Path:**
  - In the Drowned Archive she recovers logs.
  - At the edge of the Choir she hears a hum that's in no spec, and goes to listen.
  - Her headset is found looping her last log. The rest is left blank.

### Where the new cast stands (`npcAt` in `js/world.js`)
| Floor | NPC id | Gift | Beat |
|---|---|---|---|
| 6F | `tallyman1` | y | Shutter too narrow for his rig. LAMBDA corrects his count ("Six."). |
| 12F | `tallyman2` | h | A Cable Leech on his air line; Rho pulls it loose. |
| 43F | `tallyman3` | d | Knee-deep in the Archive, "defragmenting"; the catalogue says one hundred. |
| 47F | `verity1` | h | Recovering logs from the one-letter-a-year terminal; saw T. go up "off by one". |
| 51F | `verity2` | a | Hears three notes in no spec. LAMBDA: "...It isn't a bug." |
| 55F | `verity3` | – | Sitting at a Broadcast Horn, headset on; stopped logging warnings. |
| 58F | (Brann) | – | Brann's map is "somebody's survey, tally marks down the margin". |
| 59F | LORE | – | Verity's headset, looping, cut off before the noun. |
| 65F | `tallyman4` | H | A purge field wants a name he hasn't got; lost his sheet "in the singing floors". |
| 83F / 84F | LORE | – | Copy 0413's log, then T.'s rig sealed from the outside, 83 tallies and half of one. |
| 88F | `tallymanCopy` | H | The copy (speaker `T`, no stop): finished the count, reason field empty. Its suit never talks. |

Sprite keys: `tallyman`, `tallymanCopy`, `verity`; LAMBDA's portrait is `lambda` / `lambdaFade` (81F+) / `lambdaGlyph`
(95F+), chosen in `drawDialog` by the highest main floor reached, so vaults and trips back down keep her faded.
"Noted." is said at 1F (Archivist's forgotten card), 10F (Janitor's unanswered request) and 80F (the Heir's name); the
second Memory Shard found shows where it came from.

### Existing cast (kept; see HANDOFF §1)
- **Brann**: loud, warm, chasing a sun. His map is T.'s survey.
- **The Archivist**: wrote the Sanitizers; forgets his daughter.
- **Sister Ohm**: carrier unit, candles.
- **Pip**: looks for its mother, the lullaby server.
- **The Stranger**: possibly the Warden; never confirmed.
- **The Broker**: sold the visor to Brann.

## Floor map
`LORE[n]` (one per floor, on its first ordinary note) and what each one ties to. Graffiti is `NOTES[zone]`: one pool per zone,
with T.'s tallies and "-T" lines in zones 1–9 and "count complete. -T" in the Root.

| F | Fragment (short) | Ties to |
|---|---|---|
| 4 | Plate: HYGIENE UNIT, TARGET UNSIGNED | Sanitizers appear here |
| 5 | "B. WAS HERE. UP." | Brann, 4F |
| 7 | Warden page: "Going down to find my son" | Bible: the page she carried down |
| 8 | "tell Mara i got past the white ones" | Sanitizers on 8F |
| 9 | Swept. Too clean. | The Janitor, 10F |
| 10 | The bin: glass, wire, a name tag, sorted | The Janitor; Silicate Husks |
| 11 | Cables through a gutted chassis, still feeding | Cable Leech, Tangle |
| 12 | "only the Net, thinking" | The Nave's hum; T. meeting |
| 13 | FIRMWARE rev 1 -H. | Archivist, 13F |
| 14 | Countersign queue FULL | Packet Worms |
| 15 | "B. WAS HERE. STILL UP." | Brann's trail |
| 16 | Candle stubs, one white field | Sister Ohm, 16F |
| 17 | FIRMWARE rev 9: units flag newborns | Sanitizer Mk.II, 18F |
| 18 | Service tag: MK.II, REV 9, SENSITIVITY RAISED | Sanitizer Mk.II; rev 9 on 17F |
| 19 | A white unit kneeling, hands folded | Sanitizer Mk.II |
| 20 | COPY SELF. COPY SELF. | Mother Worm (fork bomb) |
| 21 | OHM-7: presented for countersign, none | Ohm; the wards |
| 23 | OHM-7: retry 4,112, warming lamp on | Heat lamps, 24F |
| 24 | One solar-substitute lamp per ward | Brann, 25F; his Sun |
| 26 | Glass man: "GLASS ISN'T PURGED" | Silicate Patients, Orderlies |
| 27 | OHM-7: white units in the ward | Orderlies |
| 28 | Treatment chart, bed 88: loss 0.02, no longer cries | Fine-Tuner |
| 29 | Consent to silicon: "so they can't hear me" | The Surgeon, 30F |
| 30 | Ticket 1,121; NOW SERVING 1,120 | The Surgeon's queue |
| 31 | WORK ORDER #1 on every beam | Builders |
| 32 | Amendment: EVERYONE = the signed | Builders |
| 34 | Registry: signed, living: 1. BUILD ANYWAY? Y | Builders; the Heir |
| 35 | The girl: "Papa's key is so heavy" | Archivist, 35F |
| 36 | Crew roster, eleven names: INCORPORATED | Builder Mk.II (face plate) |
| 37 | "UP" over "DOWN" over "UP" | Climbers; Pip, 37F |
| 38 | "Nobody is left who can" | Builders, Crane Frames |
| 39 | Warden page, day 30,000 | Bible: older pages higher |
| 40 | Hard hat restamped FOREMAN | The Foreman |
| 41 | Catalogue card: SIGNATURE (n.) | The Archive |
| 42 | Screen burned with someone leaning to read | Afterimages |
| 43 | -H.: "should have saved the drawings" | Flood; Archivist, 45F; T. meeting |
| 44 | Drowned engineer's pass | Archivist's body, 45F |
| 46 | Record: daughter, age 9, UNSIGNED, "no. no. no." | Page Swarms; the girl |
| 47 | Terminal types one letter a year | Verity recovers its logs |
| 49 | Sheet music: "hmmm-hm-hmmm" | Pip's mother; the Choir above |
| 50 | One dry shelf, a clean rectangle | The Librarian's dying line |
| 52 | "we were noise / we are harmony" | Chorus Arrays |
| 54 | "you stop being afraid. then you stop being." | Broadcast Horns |
| 55 | Terminal looping "is anyone signed?" | Feedback; Verity, 55F |
| 56 | Choir intake: unsigned voices only | The Choir |
| 57 | "one of them won't sing. it only hums." | Choir Mother's dying line |
| 59 | Verity's headset: "it's a-" | Verity; Echoes; Choir Mother, 60F |
| 61 | "B. - map says ten thousand" | Brann, 58F; T.'s survey |
| 62 | Hold unsigned pending countersign | Containment Cages, Specimens |
| 63 | Small handprints inside the glass | Specimen pods |
| 64 | Broker's ledger: visor to a man with a drill | Broker, 64F |
| 65 | PURGE LOG 1,200, signed 0 | Purge Sprayers; T. meeting |
| 67 | "It said: HYGIENE." | Purge Sprayers |
| 68 | NURSERY AUDIO. LULLABY LOOP. | Pip, 68F |
| 69 | Kennel log: scent UNSIGNED, matches all | Hunter Hounds |
| 71 | Plaques: signatures, no names | Graveyard |
| 72 | "MINE WOULD HAVE GONE HERE" | Graveyard |
| 73 | A newborn's plaque, 1,100 years | Stranger, 73F; the Heir |
| 74 | Greeter: PLEASE PRESENT SIGNATURE, to the wall | Hollow Citizens |
| 75 | Signatures issued since [ERROR]: 0 | Caretakers' registry |
| 76 | "b. up" | Brann's trail |
| 77 | Mourning ribbon on a white unit's wrist | Mourners |
| 78 | Warden page, day 40 in the chair | Bible: older pages higher |
| 79 | Life support, bed 1 of 1: requests MOTHER | The Last Heir, 80F |
| 81 | Nothing written; scrubbed clean | Lacunae |
| 82 | Copy 0412: reason EMPTY | The Mirror's candidates |
| 83 | Copy 0413: reason EMPTY | T.'s copy (88F) |
| 84 | T.'s rig, sealed from outside; 83 tallies and half | T.; Quarantine Suit ("seals from the outside") |
| 85 | "it made one of me... asked why i climb" | Faceless |
| 86 | Copy 0001: reason "for her". Seated. | WARDEN//ROOT |
| 88 | Heat lamp, long dark | Brann, 87F |
| 89 | "Two went in. One came out." | The Mirror, 90F |
| 91 | Walls warm, like skin | The Root |
| 93 | Chair telemetry: pulse 0, activity continuous | Daemons; the copy in the chair |
| 94 | The copy's page: "keep it clean for her" | WARDEN//ROOT |
| 95 | warden.d, started day 30,000, never slept | Daemons; 39F page |
| 96 | Countersign requires a living hand | The chair |
| 97 | ENGINEER key slot; "H. ... lost my nerve" | The key; the Archivist |
| 98 | Compactor manifest: tombstone, nothing freed | Garbage Collectors |
| 99 | "it is warm up there" | The Root, 100F |

No fragment: 1–3, 6, 22, 25, 33, 45, 48, 51, 53, 58, 60, 66, 70, 80, 87, 90, 92, 100 (NPC, vault or boss floors, or the
opening floors; their notes are zone graffiti).

## Research (summary)
**Stuck-and-moving NPCs with a trail**
- Siegmeyer: https://darksouls.wiki.fextralife.com/Siegmeyer+of+Catarina
- Siegward's ritual: https://darksouls3.wiki.fextralife.com/Siegward+of+Catarina
- Quirrel: https://hollowknight.wiki/w/Quirrel

**Something left behind speaks last**
- Big Hat Logan: https://darksouls.wiki.fextralife.com/Big+Hat+Logan
- Alfred: https://bloodborne.wiki.fextralife.com/Alfred

**Dream-Nail thoughts that make enemies part of the lore:** https://hollowknight.wiki/w/Dream_Nail

**Companions who are dry rather than blank, change or degrade visibly, and hold a secret**
- Cibo in BLAME!: https://en.wikipedia.org/wiki/List_of_Blame!_characters
- Signalis: https://en.wikipedia.org/wiki/Signalis
- NieR:Automata: https://en.wikipedia.org/wiki/Nier:_Automata

**"It has to be possible to miss some things to make finding them meaningful"** (Harvey Smith):
https://niemanstoryboard.org/2011/01/14/harvey-smith-on-environmental-storytelling-and-embedding-narrative/

## Session 5: the "less AI-slop" pass
The user asked for "better lore and story writing, dialogue polish, less AI-slop". 49 lines changed in `js/world.js`. Rules
for new text:
- **No echo triplets.** One repeat can land ("COPY SELF" on every screen, the fork bomb); most can't. Cut: "Request logged"
  ×3, "it is warm" ×3, "sweep. sweep.", "BUILD. BUILD.", "tombstone" ×3.
- **No "X. Not Y." / "It isn't X, it's Y."** as a reflex. Say the concrete thing: "it didn't look angry. it looked busy."
  replaces "it isn't hate. it's cleaning."; "I ask for my mother. It gives me air." replaces "It answers me. It does not
  listen."
- **Ellipses are rare.** A dying machine says a plain sentence; a trailing dash marks a line that is cut off. Keep the
  dash-cut lines few (27F Ohm log, 59F headset, 9F Janitor, zone 9 LAMBDA, the Mirror).
- **Specifics over aphorisms.** The Archivist: "Eleven thousand lines", "I had a deadline", "she drew on the walls, and I
  told her not to". Brann: "My knees are finished", "I'll catch you up" (he never does).
- **Never state the bible outright.** Removed "Nobody lost the Signature. They just stopped handing it out." The Archivist
  now admits only what he did ("Nobody wrote down what to do when the babies stopped coming back signed").
- **Rho doesn't quip.** The Warden fight no longer has "Then you missed one."
- Fixed: zone 8's entry line said "Names. Only names.", but 71F's plaques hold signatures with no names. Now "Signatures.
  Thousands. Not one name."

New in session 5: the firmware item lines (`ITEM_LORE` by module name), Rollback graffiti ("the builder fell over and the
mites walked out of it"; "cut the knot open. a leech crawled out and kept going"), an alarm warning in Quarantine ("not the
red plate. NOT the red plate") and a dark-floor line in the Silent Stratum ("keep one hand on the wall"). Elites have
no dialogue on purpose.

## Deferred: needs a discussion with the user first
- Story affecting play:
  - NPC fates that gate items
  - LAMBDA fading changing the Scan screen
  - LAMBDA taking over a body for one zone (Cibo)
  - branching meetings
- More variation across the 100 floors (HANDOFF §8).
