import json, os, html

data = json.load(open('/home/claude/icons/icons.json'))
ICONS = data['icons']
OUT = '/mnt/user-data/outputs'
os.makedirs(f'{OUT}/icons', exist_ok=True)

# ---------------------------------------------------------------- icons.ts
lines = ['''/**
 * Icon path registry.
 *
 * Every glyph is authored on a 24 x 24 grid with a 20 x 20 live area and a
 * 1.5 stroke, butt caps, miter joins. Paths are centrelines and are NOT
 * outlined: the stroke is applied at render time, so one definition serves
 * every size and colour.
 *
 * `fill` paths are painted solid. `stroke` paths are painted as 1.5-wide
 * centrelines and scale with the icon, so a 48 pt icon gets a 3 pt stroke.
 * Some glyphs use both.
 *
 * Generated from icons.json. Edit the source, not this file.
 */

export interface IconDefinition {
  /** Solid paths. */
  fill: string[];
  /** Centreline paths, stroked at render time. */
  stroke: string[];
}

export const ICON_GRID = 24;
export const ICON_STROKE_WIDTH = 1.5;

export const ICONS = {''']

for icon in ICONS:
    note = icon.get('note')
    if note:
        lines.append(f'  /** {note} */')
    f = ', '.join(f"'{d}'" for d in icon['fill'])
    s = ', '.join(f"'{d}'" for d in icon['stroke'])
    lines.append(f"  '{icon['id']}': {{")
    lines.append(f"    fill: [{f}],")
    lines.append(f"    stroke: [{s}],")
    lines.append('  },')

lines.append('} as const satisfies Record<string, IconDefinition>;')
lines.append('')
lines.append('export type IconName = keyof typeof ICONS;')
lines.append('')
lines.append('''/** Marks have an earned and an unearned silhouette, never one at low opacity. */
export const markIcon = (
  mark: 'rescue' | 'flow' | 'swift',
  earned: boolean,
): IconName =>
  (earned ? `mark-${mark}` : `mark-${mark}-outline`) as IconName;
''')

open(f'{OUT}/icons/icons.ts', 'w').write('\n'.join(lines))

# ------------------------------------------------------- contact sheet HTML
def svg_markup(icon, color, sw=1.5):
    parts = []
    for d in icon['fill']:
        parts.append(f'<path d="{d}" fill="{color}"/>')
    for d in icon['stroke']:
        parts.append(f'<path d="{d}" fill="none" stroke="{color}" stroke-width="{sw}" '
                     'stroke-linecap="butt" stroke-linejoin="miter" stroke-miterlimit="4"/>')
    return ''.join(parts)

def cell(icon, color, sizes, grid=False):
    out = [f'<div class="cell">']
    out.append('<div class="row">')
    for px in sizes:
        g = ''
        if grid:
            g = ('<g class="kl">'
                 + ''.join(f'<line x1="{i}" y1="0" x2="{i}" y2="24"/><line x1="0" y1="{i}" x2="24" y2="{i}"/>'
                           for i in range(0, 25, 2))
                 + '<rect x="2" y="2" width="20" height="20" class="live"/>'
                 + '<rect x="3" y="2" width="18" height="20" class="key"/>'
                 + '<rect x="2" y="3" width="20" height="18" class="key"/>'
                 + '<circle cx="12" cy="12" r="10" class="key"/></g>')
        out.append(f'<svg viewBox="0 0 24 24" width="{px}" height="{px}">{g}{svg_markup(icon, color)}</svg>')
    out.append('</div>')
    out.append(f'<div class="name">{html.escape(icon["id"])}</div>')
    if icon.get('note'):
        out.append(f'<div class="note">{html.escape(icon["note"])}</div>')
    out.append('</div>')
    return ''.join(out)

sections = []

def section(title, blurb, bg, color, sizes, grid=False, gray=False):
    cells = ''.join(cell(i, color, sizes, grid) for i in ICONS)
    cls = 'grid' + (' gray' if gray else '')
    return f'''<section>
  <h2>{title}</h2>
  <p>{blurb}</p>
  <div class="{cls}" style="background:{bg}">{cells}</div>
</section>'''

sections.append(section(
    'Panel, at render sizes',
    'The sizes these actually appear at in the dock and top bar. If a glyph fails here it fails in the app.',
    '#1B1F23', '#E8EBED', [16, 24, 48]))

sections.append(section(
    'Small-size stress test',
    'Marks render around 12 px and timeline events around 10 px. Anything that muds here needs simplifying, not scaling.',
    '#1B1F23', '#E8EBED', [10, 12, 14, 16]))

sections.append(section(
    'Against the map floor',
    'palette.floor is the only large light area in the game. Any glyph that can appear near the plan is checked here.',
    '#C9C0B1', '#22262B', [16, 24, 48]))

sections.append(section(
    'Construction',
    'Live area 20 x 20 in slate. Keyline shapes in red: square 18, portrait 16 x 20, landscape 20 x 16, circle 20. Nothing may breach the live area; circular glyphs go to the circle keyline, square ones to the square.',
    '#15181B', '#F2A93B', [96], grid=True))

sections.append(section(
    'Greyscale',
    'Earned and unearned marks must be distinguishable without colour. Outline versus solid does this; opacity alone does not.',
    '#1B1F23', '#E8EBED', [16, 24, 48], gray=True))

doc = f'''<!doctype html>
<meta charset="utf-8">
<title>Before the Smoke — icon contact sheet</title>
<style>
  :root {{
    --shell:#15181B; --panel:#1B1F23; --edge:#2A2F35;
    --text:#E8EBED; --muted:#7C848C; --signal:#F2A93B;
  }}
  * {{ box-sizing:border-box }}
  body {{
    margin:0; padding:40px 32px 80px;
    background:var(--shell); color:var(--text);
    font:15px/1.5 ui-sans-serif, -apple-system, system-ui, sans-serif;
  }}
  header {{ max-width:60ch; margin-bottom:48px }}
  h1 {{ font-size:22px; font-weight:600; margin:0 0 8px }}
  header p {{ color:var(--muted); margin:0 }}
  section {{ margin-bottom:56px }}
  h2 {{ font-size:15px; font-weight:600; margin:0 0 4px }}
  section > p {{ color:var(--muted); font-size:13px; margin:0 0 14px; max-width:70ch }}
  .grid {{
    display:grid; grid-template-columns:repeat(auto-fill, minmax(210px, 1fr));
    border:1px solid var(--edge); border-radius:4px;
  }}
  .cell {{ padding:18px 16px 16px; border-right:1px solid var(--edge); border-bottom:1px solid var(--edge) }}
  .row {{ display:flex; align-items:center; gap:14px; min-height:52px }}
  .name {{ margin-top:12px; font-size:12px; color:var(--muted) }}
  .note {{ margin-top:4px; font-size:11px; line-height:1.45; color:#5C646C }}
  .gray {{ filter:grayscale(1) }}
  .kl line {{ stroke:#2A2F35; stroke-width:.25 }}
  .kl .live {{ fill:none; stroke:#3A4149; stroke-width:.4 }}
  .kl .key {{ fill:none; stroke:#E04B39; stroke-width:.25; opacity:.55 }}
  @media (prefers-reduced-motion:no-preference) {{ }}
</style>

<header>
  <h1>Icon contact sheet</h1>
  <p>Twenty-two glyphs on a 24 grid, 1.5 stroke, butt caps, miter joins.
     Open this before wiring anything up: path data can be geometrically correct and
     optically wrong, and that only shows here.</p>
</header>

{''.join(sections)}
'''
open(f'{OUT}/icon-contact-sheet.html', 'w').write(doc)
print('wrote icons.ts and icon-contact-sheet.html')
