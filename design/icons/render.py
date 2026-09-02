import json, io, cairosvg
from PIL import Image, ImageDraw, ImageFont

data = json.load(open('/home/claude/icons/icons.json'))
ICONS = data['icons']
SW = data['strokeWidth']
S = 3  # supersample

def svg(icon, color, grid=False):
    parts = []
    if grid:
        for i in range(0, 25, 2):
            parts.append(f'<line x1="{i}" y1="0" x2="{i}" y2="24" stroke="#2A2F35" stroke-width="0.25"/>')
            parts.append(f'<line x1="0" y1="{i}" x2="24" y2="{i}" stroke="#2A2F35" stroke-width="0.25"/>')
        parts.append('<rect x="2" y="2" width="20" height="20" fill="none" stroke="#3A4149" stroke-width="0.4"/>')
        parts.append('<rect x="3" y="2" width="18" height="20" fill="none" stroke="#E04B39" stroke-width="0.25" opacity="0.55"/>')
        parts.append('<rect x="2" y="3" width="20" height="18" fill="none" stroke="#E04B39" stroke-width="0.25" opacity="0.55"/>')
        parts.append('<circle cx="12" cy="12" r="10" fill="none" stroke="#E04B39" stroke-width="0.25" opacity="0.55"/>')
    for d in icon['fill']:
        parts.append(f'<path d="{d}" fill="{color}"/>')
    for d in icon['stroke']:
        parts.append(f'<path d="{d}" fill="none" stroke="{color}" stroke-width="{SW}" '
                     f'stroke-linecap="butt" stroke-linejoin="miter" stroke-miterlimit="4"/>')
    return ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">'
            + ''.join(parts) + '</svg>')

def raster(icon, px, color, grid=False):
    png = cairosvg.svg2png(bytestring=svg(icon, color, grid).encode(),
                           output_width=px*S, output_height=px*S)
    return Image.open(io.BytesIO(png)).convert('RGBA')

def sheet(path, bg, color, sizes, grid=False, label='#7C848C', cols=6):
    try:
        font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 11*S)
    except Exception:
        font = ImageFont.load_default()
    pad, gap = 14*S, 12*S
    big = max(sizes)*S
    cw = pad*2 + sum(s*S for s in sizes) + gap*(len(sizes)-1)
    cw = max(cw, 110*S)
    ch = big + 26*S + pad*2
    rows = (len(ICONS)+cols-1)//cols
    img = Image.new('RGBA', (cols*cw, rows*ch), bg)
    d = ImageDraw.Draw(img)
    for i, icon in enumerate(ICONS):
        ox, oy = (i%cols)*cw, (i//cols)*ch
        x = ox + pad
        for px in sizes:
            im = raster(icon, px, color, grid)
            img.alpha_composite(im, (x, oy+pad+(big-px*S)//2))
            x += px*S + gap
        d.text((ox+pad, oy+pad+big+8*S), icon['id'], fill=label, font=font)
        d.rectangle([ox, oy, ox+cw-1, oy+ch-1], outline='#2A2F35')
    img.save(path)

sheet('/home/claude/icons/sheet_dark.png',  '#1B1F23', '#E8EBED', [16,24,48])
sheet('/home/claude/icons/sheet_small.png', '#1B1F23', '#E8EBED', [10,12,16], cols=8)
sheet('/home/claude/icons/sheet_floor.png', '#C9C0B1', '#22262B', [24], label='#22262B', cols=8)
sheet('/home/claude/icons/sheet_grid.png',  '#15181B', '#F2A93B', [72], grid=True, cols=4)
print('ok')
