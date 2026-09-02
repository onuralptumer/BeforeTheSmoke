# Icon set — Before the Smoke

23 glyphs on a 24 grid, 20 × 20 live area, 1.5 stroke, butt caps, miter joins, no radius on terminals.

Butt caps and miter joins are not a style preference. `FloorLayer` draws walls with `strokeCap="square"`, so round-capped chrome would fight the map.

## Files

| File | Goes to |
|---|---|
| `icons/icons.ts` | `src/components/icons.ts` |
| `icons/Icon.tsx` | `src/components/Icon.tsx` |
| `icon-contact-sheet.html` | anywhere; open it in a browser |

`Icon.tsx` imports `../theme`, so it expects to sit in `src/components/`.

## Look at the contact sheet first

Open `icon-contact-sheet.html` before wiring anything up. It renders all 23 glyphs at the sizes they actually appear at, against `palette.panel` and against `palette.floor`, with a construction overlay and a greyscale pass.

This matters because path data can be geometrically correct and optically wrong, and nothing but looking will tell you. Four glyphs failed their first render here:

- `mark-swift` used an arc whose chord (14.49) was almost exactly its diameter (15), so it degenerated into a blob instead of a dial.
- `rotate` and `replay` were mirrored arcs, which were indistinguishable at 16 px. `replay` is now a restart bar and triangle.
- `sound-off` used a single short slash that vanished at 10 px. It is an X now.
- `play` was optically light next to `pause` at the same bounding box.

`play` is the one worth understanding, because it is the same bug as the current `View`-based glyph. A triangle's visual centre sits at one third of its width, not one half, so a bounding-box-centred triangle always looks pushed left. The path is `M8 4 L20 12 L8 20 Z`, whose centroid lands on x = 12 exactly.

## Usage

```tsx
import {Icon} from '../components/Icon';
import {markIcon} from '../components/icons';

<Icon name="play" size={20} color={palette.text} />
<Icon name="signal-arrow" size={16} color={palette.signal} />
<Icon name={markIcon('flow', earned)} size={12} color={earned ? palette.safe : palette.textMuted} />
```

The stroke scales with the glyph, so a 48 pt icon draws a 3 pt stroke. That is deliberate: constant stroke weight across sizes is what makes an icon set look assembled from different sources.

`IconButtonBody` wraps a glyph in a 44 × 44 touch target. Several current controls are 30 × 30 with `hitSlop`, which works but is easy to lose track of.

## Call sites in GameScreen.tsx

| Current | Replace with |
|---|---|
| `ActionBar glyph="eye"` → `styles.eye` (a bare ring) | `watch` |
| `PauseGlyph`, `styles.playGlyph`, `styles.playGlyphLarge` | `play` |
| `styles.pauseGlyph`, `pauseBar`, `pauseBarLarge` | `pause` |
| The five-`View` speaker stack, `!muted` branch | `sound-on` |
| The same stack, `muted` branch | `sound-off` |
| `styles.trayArrow` inside `trayChip` | `signal-arrow` |
| `styles.markDot` / `markDotEarned` | `markIcon(mark, earned)` |
| `styles.marker` / `markerFailure` on the timeline | `event-door`, `event-smoke`, `event-block`, `event-failure` by `event.kind` |
| `'NEXT INCIDENT ›'` and `'ARCHIVE ›'` | label + `chevron-right` |
| `BACK` button, text only | `chevron-left` + label |
| `ROTATE` button, text only | `rotate` + label |
| `REPLAY` buttons, text only | `replay` + label |
| Top bar exit, currently a tappable title with no affordance | `close` |

`record.ts` emits four timeline kinds (`DOOR`, `SMOKE`, `BLOCK`, `FAILURE`). All four are currently drawn as the same 9 px dot, red for failure. `BLOCK` in particular is invisible as a distinct event right now.

Styles that become dead once the swaps are done: `playGlyph`, `playGlyphLarge`, `pauseGlyph`, `pauseBar`, `pauseBarLarge`, `speaker`, `speakerMuted`, `speakerBody`, `speakerCone`, `speakerWave`, `speakerSlash`, `eye`, `trayArrow`, `markDot`, `markDotEarned`. Keep `marker` for positioning; drop only its `backgroundColor` and `borderRadius`.

Bump `markDot`'s 9 px to 12 px. The three marks are the only place the result screen shows achievement, and 9 px is below where any of these silhouettes hold.

## The marks

`RESCUE`, `FLOW` and `SWIFT` are currently the same dot, filled or hollow. Three achievements rendered identically is the clearest amateur tell on the result screen, so these three are the ones to look hardest at:

- **rescue** — three people, all accounted for
- **flow** — three darts, unobstructed
- **swift** — a dial with elapsed time removed, 300° sector open at 1 o'clock

Each has an `-outline` variant for unearned. Use the outline, not the earned glyph at low opacity: opacity alone fails in greyscale and reads as "loading" rather than "not yet".

These are the three I would expect you to redraw. They are the only glyphs in the set carrying a concept rather than a convention, so they are where your judgement beats mine. The rest are standard and can stay.

## One bug this surfaced

`arrowPath()` in `SignalLayer.tsx` builds the signal arrow from five points, but the four base points all use `baseX`/`baseY` with no offset along the facing axis, so they are collinear. The intended notched dart renders as a plain triangle. `signal-arrow` here is the shape the code appears to have been reaching for; if you want the tray chip and the map glyph to match, `arrowPath()` needs the middle pair pulled forward along `facing`.

## Regenerating

`icons.json` is the source. `build.py` emits `icons.ts` and the contact sheet; `render.py` emits PNG sheets. Edit the JSON, never `icons.ts`.
