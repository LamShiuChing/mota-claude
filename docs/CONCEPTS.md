# STRATUM: Monster Roster Rework (session 3)

Brief for the sprite and rename pass. **Names and visuals only**: stats, abilities, tiers and balance don't change.
Current art: `roster-before.png` (70 roster sprites, one zone per row of 7, boss last).

## Direction (from the user)
- A grim, highly technological megastructure that **lost control and was abandoned**. BLAME! (Killy), Souls tone.
- **Enemies are machines.** Converted things read as machines now. Human traces are rare and deliberate (a face plate,
  a mannequin, the Last Heir inside his life support), never the whole enemy.
- **No medieval, no fantasy** (no knights, plumes, robes, wisps, skulls, angels), and **no cute or chibi** (no big heads,
  big round eyes, grinning teeth mouths, blobby bodies).
- Horror is psychological and uncanny: faceless, too tall, too still, wrong proportions, glitching. **No blood.**
  Nothing needs explaining; the art just has to feel right.

## Pixel rules (16×16 char grid in `js/data.js`, dark outline added automatically)
- **Silhouette first.** Each monster has to read at 32 px on the map and 48 px in the battle portrait. Use the full
  height for tall things. Keep one empty pixel at the edge where the outline needs room.
- **Adult or mechanical proportions.** A humanoid's head is at most ~1/5 of its height. Thin limbs, visible joints,
  asymmetry, cables, plates, vents.
- **Eyes** are a 1–2 px LED, a lens slit or a visor. There are no round cartoon eyes and no mouths with teeth
  (a grille, a port ring or a maw of plates is fine).
- **Palette.** Mostly the neutral darks (`h t T z Z G g`) plus **one accent** per unit, usually the zone's.
  Red (`r/R`) is only for LEDs and warnings. **Don't use `X x m M`** (the old blood and flesh letters are being retired).
  Pale synthetic skin, where a human trace needs it, is `s/S` or `q/Q`.
- **Idle frames.** A base sprite's alternate frame (`miteB`, `sanitizerL`, `serpentT`, `houndP`, `surgeonB`, `choirB`,
  `knightL`, `wardenE`, `droneB`, `wispB`, `masonB`, `turretL`, …) must be redrawn to match the new base. Check
  `IDLE` in `js/game.js`: `frame` is swapped in, and `look` is a side-facing pose that gets mirrored.
- **Palette swaps.** Tiers that reuse a base through `swap` in `ZONES` must still look right after the base is redrawn.
  Fix their `swap` maps if the base's letters changed.

## Roster
`key` is the `SPRITES` key. **new** means add a sprite: give it an `IDLE` style and an `ENEMY_FX` alias in `js/game.js`.

### Zone 1: Dead Concrete (floors 1–10, grey concrete, red accent)
| Tier | Old → New name | key | Visual |
|---|---|---|---|
| 1 | Bug → **Scrap Mite** | mite | Low, wide scavenger that strips copper: flat chassis, needle legs, cutter mandibles, one red LED |
| 2 | Power Surge → **Live Wire** (swift) | wisp | A severed high-voltage cable whipping in the air, its end arcing. No skull |
| 3 | Silicate Husk | husk | Gaunt, too-tall figure of cracked glass over a wire armature. No face: the head is a fractured shard |
| 4 | Watch Drone (swift) | drone | Lean surveillance drone: one long lens barrel on thin rotor arms. Not a round eyeball |
| 5 | Sanitizer | sanitizer | *The white ones*: tall, thin, spotless white synthetic humanoid, faceless head with a red visor slit, long arms, one ending in a nozzle |
| 6 | Builder | mason | Hulking faceless construction machine: a sensor block for a head, rivet-driver and claw arms, hazard stripes |
| B | The Janitor | janitor | Old, bent maintenance unit on a long thin frame. The mop head is fiber-optic strands; it pushes a wheeled bin. One lamp eye |

### Zone 2: Cable Nave (11–20, green)
| Tier | Old → New name | key | Visual |
|---|---|---|---|
| 1 | Cable Leech | leech | A thick braided-cable segment whose mouth is a ring of connector pins |
| 2 | Worm → **Packet Worm** (corrupt) | serpent | Long body of ribbon-cable and drive-module segments; the head is a connector with LEDs |
| 3 | Spark Drone (swift) | drone swap | — |
| 4 | Tangle | tangle | A writhing knot of cables with manipulator claws poking out |
| 5 | Sentry (aura) | turret | Tripod turret, twin barrels |
| 6 | Sanitizer Mk.II | sanitizer swap | — |
| B | Mother Worm | motherworm | A fork bomb: a massive coiled cable body whose maw is a ring of glowing ports. Smaller copies of itself hang off it |

### Zone 3: Silicate Wards (21–30, clinical blue-white)
| Tier | Old → New name | key | Visual |
|---|---|---|---|
| 1 | IV Drip → **Infuser** | drip | Autonomous IV stand on caster legs, a bag of luminous cyan fluid, lines ending in needle arms |
| 2 | Silicate Patient (corrupt) | patient | A glass body strapped into a walking gurney frame, crystal growths, a visor over the head |
| 3 | Orderly | sanitizer swap | — |
| 4 | Needle Drone (swift) | syringe | Syringe drone carrying cyan serum |
| 5 | Crystal Hound → **Glass Hound** (double) | hound swap | Base `hound` = a quadruped pursuit frame: skeletal wire chassis, heat-sink rib fins, a long sensor snout. No tongue or teeth |
| 6 | Nurse Unit → **Fine-Tuner** (corrupt) | surgeon | Tall, clean clinical android. A sensor fin shaped like a nurse cap, a lens-array face, one arm a long probe |
| B | The Surgeon | surgeonBoss | Many-armed ceiling-rig surgeon: a surgical-lamp head, arms with scalpel, saw and injector |

### Zone 4: The Foundry (31–40, orange)
| Tier | Old → New name | key | Visual |
|---|---|---|---|
| 1 | Slag Crawler | slag | Low crawler caked in cooling slag, glowing cracks |
| 2 | Welder Drone (swift) | drone swap | — |
| 3 | Rivet Crab → **Riveter** (double) | crab | Many-legged riveting machine with two rivet-gun arms |
| 4 | Walking Furnace (aura) | furnace | A furnace on piston legs, the grate glowing. No face |
| 5 | Builder Mk.II | **masonII** (new) | A heavier Builder with a riveted human face plate on its chest (the worker it built around). Fixes "looks like Builder" |
| 6 | Crane Frame | crane | Gantry walker; its hook holds a hanging, half-assembled chassis |
| B | The Foreman | foreman | Fused into its podium: a clear hard-hat dome with a hazard beacon, a megaphone arm |

### Zone 5: Drowned Archive (41–50, deep blue)
| Tier | Old → New name | key | Visual |
|---|---|---|---|
| 1 | Data Wraith → **Afterimage** (pierce) | ghost | A burned-in screen image of a person: flat, scan-lined, faceless, flickering. Base for Echo and Dead Record |
| 2 | Index Hound → **Index Crawler** (double) | **crawler** (new) | Spider-like indexing bot, many thin legs, a sweeping scanner head |
| 3 | Archive Worm → **Bit Rot** (corrupt) | **bitrot** (new) | A decaying eel of storage media: corroded plates, holes of missing pixels |
| 4 | Drowned Diver → **Salvage Diver** (corrupt) | drowned | Heavy diving-suit maintenance unit. The helmet port is full of black water with one lamp; the hose is a data cable |
| 5 | Page Moth → **Page Swarm** (swift) | pages | Torn punched pages whirling around a small drone core |
| 6 | Lantern Reader → **Read Head** | angler | A long jointed actuator arm on a spindle base, a read head at the tip, sweeping |
| B | The Librarian | librarian | Tall archive frame, book-slot shelving in its torso, one reading-lamp head. Not robed |

### Zone 6: Choir of Static (51–60, violet)
| Tier | Old → New name | key | Visual |
|---|---|---|---|
| 1 | Static Choir → **Chorus Array** (pierce) | choir | A hovering cluster of small speaker heads on one spine |
| 2 | Arc Seraph → **Arc Emitter** (swift, pierce) | seraph | A floating ring emitter with radiating arc vanes. Angelic only by shape |
| 3 | Surge Wisp → **Feedback** (swift) | **feedback** (new) | A microphone and speaker fused face to face, a crackling ring between them |
| 4 | Hymn Horn → **Broadcast Horn** (aura) | speaker | A tall PA horn tower. A gaunt stretched face shows faintly on the diaphragm (the one human trace) |
| 5 | Bell Knight → **Resonator** (double) | bell | A heavy walker whose torso is a bell-shaped resonance chamber, with hammer arms |
| 6 | Echo (pierce) | ghost swap | — |
| B | The Choir Mother | choirmother | An attention head: a large head of many speaker-grille mouths, a crown of microphones on cables, hanging |

### Zone 7: Quarantine (61–70, white and red)
| Tier | Old → New name | key | Visual |
|---|---|---|---|
| 1 | Specimen | specimen | A sealed specimen pod walking on four legs, a dark folded shape inside, a blinking label light |
| 2 | Sanitizer Mk.III | sanitizer swap | — |
| 3 | Containment Cage (swift) | cage | A flying capture cage with claw arms |
| 4 | Purge Sprayer (aura) | sprayer | Sanitizer-type whose arms were replaced by a spray lance, a foam tank on its back |
| 5 | Enforcer (double) | knight (own base) | Riot-armoured security frame: shield plate, baton, visor slit. No helmet plume, nothing medieval |
| 6 | Hunter Hound (swift, double) | hound swap | Its swap can't use `X/x` any more; use red LEDs |
| B | The Gatekeeper | gatekeeper | A machine built into a massive gate frame: arms, one central lens |

### Zone 8: Graveyard of Signatures (71–80, grey-green)
| Tier | Old → New name | key | Visual |
|---|---|---|---|
| 1 | Signed Ghost → **Dead Record** (pierce) | ghost swap | — |
| 2 | Hollow Citizen (corrupt) | **citizen** (new) | A civic-service mannequin android: smooth blank face, suit-like shell, cracked, one hand raised to greet no one |
| 3 | Grave Worm → **Zombie Process** (corrupt) | burrow | A half-buried frame dragging itself out of the ground: dead, still running |
| 4 | Mourner (pierce) | mourner | A thin funerary android veiled in hanging cables, head bowed |
| 5 | Tombkeeper → **Caretaker** (double) | tomb | A squat grave-maintenance machine carrying a registry slab |
| 6 | Obituary Crow (swift) | crow | A bird-shaped drone of black plates, an antenna for a beak |
| B | The Last Heir | heir | A frail, pale human, small, enthroned inside a life-support machine. The machine (arms, tubes) is the threat |

### Zone 9: Silent Stratum (81–90, white and grey)
| Tier | Old → New name | key | Visual |
|---|---|---|---|
| 1 | Lacuna | lacuna | A hole in space inside a ring frame, pixels missing around it |
| 2 | Void Wisp → **Null Pointer** (swift, pierce) | **pointer** (new) | A thin floating black needle with a white tip, pointing |
| 3 | Dust Husk | husk swap | — |
| 4 | Stilt Stalker (swift, double) | stalker | Very tall thin legs, a small body |
| 5 | Monolith (aura) | monolith | A black slab with one vertical light seam |
| 6 | Faceless | faceless | A tall suited android with a smooth blank head |
| B | The Mirror | mirror | Rho's copy, glitched (keeps copying Rho's blade) |

### Zone 10: The Root (91–100, red and cyan)
| Tier | Old → New name | key | Visual |
|---|---|---|---|
| 1 | Kernel Bug → **Kernel Panic** | kernel | A lacquered red chip-scarab with a glaring core and spasming legs. The red is carapace, not blood |
| 2 | Daemon (pierce) | daemon | A background process given a body: forked arms around a floating core. No horns |
| 3 | Root Sanitizer | sanitizer swap | — |
| 4 | Firewall (aura) | firewall | A wall of burning grid blocks |
| 5 | Root Hound → **Watchdog** (swift, double) | hound swap | — |
| 6 | Garbage Collector | collector | A big compactor machine with a maw of crushing plates |
| B | WARDEN//ROOT | warden | The copy in the chair: a white mask face on a throne of cables, spine cables into the chair |

## Also in this pass
- **Death decals and hit particles** (`js/game.js`: `OILY`, `bleed`, `GORE`, `splat`, the `burst` in `landFx`):
  - no blood anywhere
  - machines leave oil, sparks and a burnt mark
  - glitch and ghost types leave dead-pixel squares or spilled 0/1
  - cable types leave cut cable ends
- Boss dialog keeps its current text. The `who` names in `STORY` stay the same because no boss is renamed.
