# Before the Smoke — Design Elements

This document describes only what the ten-level prototype renders. Where it previously specified states, props or systems the simulation does not have, those are listed in §16 as explicitly deferred rather than left in as aspiration — a visual promise the engine does not keep teaches the player a false model of the rules.

---

## 1. Design vision

**Before the Smoke** should feel like a lit architectural plan on a dark ground rather than a conventional puzzle game. The player observes a calm public space, notices the beginnings of a disaster, and changes the outcome by placing one directional signal.

The visual direction is **Living Floor Plan**:

- A dark shell. The building is the only lit thing on screen: warm floor plates inside thin structural walls, glowing as if seen from above at night.
- Top-down rooms and corridors built from clean geometric forms.
- Simplified people whose roles and intentions remain readable at a small scale.
- Light is reserved for the three things that carry meaning: **teal** for safety, **amber** for the player's one intervention, **red** for the moment it went wrong. Everything else stays quiet.
- Smoke and crowd movement create the tension. No large flames.
- The player should feel like an emergency-flow analyst making one precise intervention.

**Framing.** Levels are authored on a common 13 × 20 grid but most use a fraction of it. The camera frames the occupied rectangle with a one-cell margin, so every incident fills the screen at the largest cell size it can rather than floating in empty ground.

Each level progresses through four visual states: **calm order**, **small warning**, **crowd disruption**, **relief or failure**. The original list also included "growing uncertainty — blocked sightlines". There is no visibility system in the simulation; smoke does not occlude anyone's sight, and rendering it as if it did would misrepresent how people choose routes. Uncertainty is communicated through hesitation at junctions and through the event strip, not through fog of war.

---

## 2. Colour system

| Purpose | Colour | Hex | Usage |
|---|---|---:|---|
| Shell | Near-black | `#15181B` | Behind everything, and the chrome |
| Panel | Charcoal | `#1B1F23` | The dock and archive cards |
| Panel edge | Slate | `#2A2F35` | Hairline borders and the timeline track |
| Ground | Cool black | `#1E2226` | Outside the building footprint |
| Floor | Warm bone | `#C9C0B1` | Walkable plates — the only large light area |
| Wall | Graphite | `#22262B` | Structural boundary line |
| Wall trim | Steel | `#3A4149` | Thin light line inside the wall, so the plan keeps its outline against the dark ground |
| Fixtures | Steel grey | `#8A9299` | Door leaves and secondary structure |
| Player signal | Industrial amber | `#F2A93B` | The player's intervention and primary interaction |
| Signal glow | Bright amber | `#FFC85E` | The arrow face and beam head |
| Safe | Bright teal | `#3FD9AE` | Exit signs, rescued people, resolved routes |
| Safe deep | Teal shadow | `#1E6A57` | Exit sign plate, earned marks |
| Smoke | Cool grey | `#9AA3AB` | Hazard volume |
| Danger | Ember red | `#E04B39` | The failure, the decision that caused it, a shut door |
| Route history | Bone | `#D8DCE0` | Observed movement |
| Text | Off-white | `#E8EBED` | Labels and readable interface text |
| Muted text | Slate grey | `#7C848C` | Secondary labels |

Three notes on the system:

- **Walls need two lines.** A dark wall against a dark ground is invisible; the plan only reads because a heavy graphite line is centred on the boundary and a thin steel trim sits just inside it, catching the light floor.
- **Amber is reserved for the player's single intervention.** If amber appears anywhere else, the signal loses its psychological weight.
- **Red does two jobs and must distinguish them.** A reticle marks the *decision*; a cross marks the *consequence*. A player who only ever looks at the cross will keep trying to fix the symptom, which is the failure mode Level 10 is built to break.

Colour is never the only carrier of information. Icons, outlines, movement patterns and shape reinforce every important state.

---

## 3. Environment

The prototype needs seven drawable things:

| Element | Notes |
|---|---|
| Floor | Walkable cell |
| Wall | Visually heavier than everything else |
| Door | Immediately distinguishable open and closed states |
| Junction | Reads as a decision point without being decorated |
| Exit | Teal plate, jamb-and-arrow pictogram, and a glow spilling onto the surrounding floor so it is findable through light smoke |
| Smoke | See §5 |
| Signal socket | Dark and inert during observation; an amber ring with a bright core once placement opens |

That is the whole kit. The original document also specified stairwells, turnstiles, security gates, glass dividers, benches, vending machines, reception desks, plants, luggage, counters, floor arrows, fire extinguishers and emergency lights, plus ten candidate location themes. None of it is used by any of the ten levels, stairwells contradict the multi-floor exclusion in the mechanical spec, and turnstiles imply capacity and delay mechanics that do not exist. All deferred — see §16.

The prototype uses one coherent theme: a compact office floor. Walls read heavier than fixtures. Nothing decorative may resemble a walkable cell, an exit, a socket or a hazard.

---

## 4. Characters

Viewed from above, legible while moving through a one-tile corridor.

Base construction: a circular head, a compact capsule torso, a small directional notch showing where their attention is, a soft contact shadow, a two-to-four frame walk cycle.

| Type or state | Visual marker | Behaviour it represents |
|---|---|---|
| Navigator | Forward-facing notch | Chooses routes independently |
| Follower | Paired footprint marker | Turns shortly after a nearby leader |
| Slow | Double movement ring | Moves once every two ticks |
| Exposed | Grey outline, thickening in three steps at exposure 1, 2 and 3 | Ticks accumulated on smoke |
| Safe | Teal outer ring | Reached an exit |
| Incapacitated | Assistance icon, movement stops | Exposure reached 4; the run has failed |

The body's facing should reveal what currently holds a person's attention — they visibly look towards a signal, a leader, a door or an exit before acting. This is what makes the behavioural rules legible without opening a panel.

Two states from the original table are removed because the simulation does not implement them:

- **"Movement weakens as exposure increases."** There is no speed penalty from exposure; it is a counter. Animating a person slowing down would teach the player a rule the engine does not run, and would be indistinguishable from the Slow character, which is a different thing entirely.
- **"Incapacitated — cannot continue without the required level rule."** There is no assist or rescue rule. Incapacitation ends the run. The icon marks where it happened; nothing can be done about it except replay.

---

## 5. Smoke

Smoke is both a threat and a readable simulation system. It must feel organic without hiding the grid.

Built from soft overlapping volumes rather than filled cells, so it reads as something seeping through the building: two blurred masses per affected cell, offset by a fixed per-cell hash so neighbours never pulse in lockstep and nothing is random.

A crisp inner square marks each affected cell so the boundary stays countable beneath the volume. The player must be able to tell exactly which cell becomes dangerous and when — the difference between three cells of smoke and four is the difference between a survivable corridor and a lethal one.

Exposure reads in three steps against a limit of four:

1. **1** — faint grey outline, subtle breathing.
2. **2** — stronger pulse, reduced posture.
3. **3** — broken movement rhythm, near-opaque outline. One person-tick from incapacitation.

No coughing on every tick. One restrained cue when a person first reaches step 3.

---

## 6. Phase-specific visual states

### Observation

Full brightness, minimal interface, normal ambience. No sockets or interaction markers visible. The camera is static so the player can learn the ordinary behaviour first.

### Analysis

The run has finished and frozen on its failure frame. Background saturation drops slightly. Previous routes appear; the failed route turns dusty coral. The authored critical junction is emphasised. A **read-only event strip** shows when doors closed and smoke spread.

The strip is not a scrubber. The original document specified a scrubbable timeline whose markers seek the scene to that moment and emphasise related objects, which is a seek control with hit-testing and an emphasis system — and it contradicted the mechanical spec, which described a compact event strip appearing from Level 4. The strip is the version that ships.

### Intervention

Valid sockets appear and grow by roughly 8%, with a slow pulse. The signal becomes the brightest object on screen. Non-essential route lines fade. Placement and direction preview respond immediately to touch.

### Replay

The level returns to its calm starting state with the signal already installed. The new route draws alongside the ghost of the previous attempt. Differences emerge through people's decisions, never through explanatory pop-ups.

### Success

Rescued people receive teal rings. Ambient tension fades and smoke motion slows. A brief route comparison shows the decisive change.

Copy: `EVERYONE OUT` — secondary: `Before the smoke.`

### Failure

Time is already stopped on the failure frame. Audio narrows, then quiets. The **authored critical junction** is highlighted, not merely the last victim. The failure line is one of four, matching the engine's four end conditions:

- `The way out closed while they were still in the corridor.`
- `Smoke exposure reached the limit.`
- `Could not move against the opposing flow.`
- `The building did not clear in time.`

Where someone failed while stationary — a deadlock, or waiting at a shut door — show a pulsing stall marker rather than a movement trail, which would otherwise be one cell drawn eight times.

---

## 7. Route and social-influence visualisation

Show enough history to support reasoning without turning the map into a diagram editor.

Previous routes draw in slate indigo at 30–40% opacity, the most recent slightly stronger. A route stays solid up to the decision that produced the failure and becomes dashed after it.

When one person influences another:

- A thin curved line appears briefly between them.
- The person being copied receives a short-lived leader ring.
- A small footprint icon marks the copied movement.
- The effect fades quickly once the turn is understood.

This is the central psychological mechanism: under uncertainty people do not only follow signs, they follow people who look confident. Level 9 depends entirely on the player seeing it.

---

## 8. Interface

An emergency-analysis instrument, not a mobile puzzle game.

Top bar: incident number and title on the left; elapsed clock, sound toggle and pause on the right. The safe count sits over the plan itself, top-right, where the player is already looking.

The dock at the bottom is a single panel that changes with the phase, and its label states the phase in one word: `WATCH`, `ANALYZE`, `PLACE ONE SIGNAL`, `REPLAY`, `EVERYONE OUT`. Analysis and placement are deliberately separate steps — sockets stay hidden while the player is still reading what went wrong, so the interface never answers the question before it has been asked.

| Phase | Primary controls |
|---|---|
| Observation | Pause, speed |
| Analysis | Event strip, route inspection, proceed to intervention |
| Intervention | Signal tray, rotate, reset |
| Replay | Pause, speed, compare routes |
| Result | Retry, next incident, review cause |

Buttons use clean rectangular or softly chamfered shapes. No bright gradients, oversized counters, confetti, or casino-style reward effects.

---

## 9. Typography

Use the iOS system font. Do **not** name "SF Pro Display" and "SF Pro Text" as separate families: iOS selects the optical size automatically above and below 20 pt, and Apple's font files are not freely redistributable, so naming them invites someone to bundle fonts the app does not need.

For the tick counter and other numeric readouts, the requirement is not a monospaced family but **stable digit width** — use `fontVariant: ['tabular-nums']` on the system font. SF Mono is not reachable from React Native's `fontFamily`; the reachable monospaced faces are `Menlo` and `Courier`, and reaching `monospacedSystemFont` would require native code for no visible gain.

Short system labels may be uppercase: `OBSERVE`, `ANALYZE`, `PLACE SIGNAL`, `REPLAY`, `EVERYONE OUT`. Body copy stays in sentence case. No long paragraphs during play.

---

## 10. Level selection

Presented as an **Incident Archive**. Each card carries an incident number, a location name, a compact floor-plan thumbnail, the primary complication, and a small `RESOLVED` stamp after success.

No padlocks. Future incidents appear as muted archive entries with a short prerequisite, which keeps the tone professional and preserves curiosity.

---

## 11. Motion

| Element | Duration | Character |
|---|---:|---|
| Person moves one cell | 220 ms | Linear or softly eased |
| Person turns | 80–120 ms | Quick directional pivot |
| Socket snap | 140 ms | Firm magnetic placement |
| Signal rotation | 120 ms | Mechanical notch |
| Available socket pulse | 1.6 s | Slow, restrained loop |
| Route drawing | 250–400 ms | Progressive reveal |
| Panel transition | 220 ms | Clean slide or fade |
| Success resolution | 600–900 ms | Calm decompression |

The 220 ms step against a 250 ms tick is deliberate: the 30 ms gap is the pause in which a decision visibly happens.

Elastic motion is limited to the socket snap. Everything else feels controlled rather than playful. Panel transitions use core `Animated`; the simulation clock is never an animation driver.

---

## 12. The signal

The hero object. It must feel more deliberate than anything else on screen.

Construction: graphite metal casing, bright amber arrow face, thin illuminated edge, a small mounting stem, high contrast that survives light smoke.

Empty sockets are dark and inert during observation — lighting them would reveal the interaction before the analysis phase. Once placement opens they become amber rings with a bright core, breathing at 8% and expanding sharply under a drag.

Placement:

1. The map darkens slightly.
2. Valid sockets expand and become interactive.
3. Dragging near a socket creates a mild magnetic pull, snapping to the **nearest** eligible socket within 32 pt.
4. An amber guide line confirms the target.
5. Placement produces a precise metallic click and a medium haptic.
6. A glowing beam leaves the unit and ends in an arrowhead three cells along — enough to state a direction, far short of showing where the corridor goes.
7. Rotation feels mechanical, with distinct notches.

The signal never bounces or behaves like a toy. Its motion is engineered, reliable, consequential.

---

## 13. Sound

Four effects, and nothing else. The mechanical spec requires that no critical information is lost when audio is off, which makes the whole soundscape optional by construction; a five-layer ambient bed of HVAC, reverb, distant footsteps, creaks and public murmur is asset work that cannot change an outcome.

| Event | Sound | Synthesis |
|---|---|---|
| Signal snaps into socket | Precise metallic click | 2.6 kHz square + 3.9 kHz triangle, 45 ms |
| Signal rotates | Mechanical notch | 1.15 kHz square, 28 ms |
| Door closes | Low mechanical impact | 150 → 62 Hz triangle glide, 240 ms, over a short transient |
| Everyone exits | Restrained three-note resolution | C5–E5–G5 sines, staggered 130 ms |

All four are generated from oscillators rather than loaded from files. Four short mechanical cues do not justify shipping, licensing and maintaining audio assets, and synthesis keeps them tunable in the same place they are described. A mute control sits in the top bar and its setting persists.

Silence is part of the design. At the first irreversible failure, narrowing the sound field is more powerful than an alarm. No music in the prototype.

---

## 14. Haptics

Haptics communicate decisions and thresholds, never continuous simulation activity. React Native ships no haptics API, so this requires a haptics module.

- Socket drag-over: light impact. (There is no hover on a touch screen; this fires on drag entry.)
- Signal snap: medium impact
- Rotation: selection feedback
- A person first reaches exposure 3: one warning notification
- Success: success notification
- Failure: muted warning notification

Never on a per-step, per-smoke-tick or per-frame basis.

---

## 15. Production priority

1. Floor and wall readability
2. Person readability and movement direction
3. Signal and socket interaction
4. Smoke readability and timing
5. Decision-point and route visualisation
6. Phase transitions
7. Success and failure feedback
8. Sound and haptics
9. Incident Archive

The core contrast must survive all of it: a calm architectural world interrupted by one precise amber intervention. If that relationship holds, **Before the Smoke** keeps a distinct identity on a very small asset set.

---

## 16. Deferred

Not cancelled, but out of scope for a prototype that exists to test one mechanic, and removed from the sections above so nobody builds them by accident:

- **Environment kit and props** — stairwells, turnstiles, security gates, glass dividers, benches, vending machines, reception desks, plants, luggage, counters, floor arrows, fire extinguishers, emergency lights.
- **Alternative themes** — metro, airport, mall, hospital, hotel, ferry, car park, museum, industrial.
- **Fire** — art, the ember-red palette entry, and the wavering flame treatment. No level uses it.
- **Visibility and occlusion** — smoke blocking sightlines. The simulation has no visibility system.
- **Exposure-driven movement changes** — no speed penalty exists.
- **Assist and rescue** — incapacitation ends the run.
- **Scrubbable timeline** — replaced by a read-only event strip.
- **Ambient sound bed** and music.
