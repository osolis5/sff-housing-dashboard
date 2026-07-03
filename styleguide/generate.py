#!/usr/bin/env python3
"""Generate the Material Design style-guide SVG assets for the North Lawndale
Housing Dashboard.

Single source of truth: the TOKENS dict below mirrors the CSS custom properties
in ../index.html. To update the guide after a design change: edit the values
here (and in index.html), then run  python3 generate.py  from this folder.
Every asset is written to assets/*.svg as a standalone file (hex values baked
in, no CSS variables) so the SVGs can be dropped into decks, Figma, or diffs.
"""
import os

# ---------------------------------------------------------------- tokens ----
TOKENS = {
    # M3 system color tokens (light scheme, blue seed) — from index.html :root
    "primary": "#415F91", "on-primary": "#FFFFFF",
    "primary-container": "#D6E3FF", "on-primary-container": "#001B3E",
    "secondary": "#565F71", "secondary-container": "#DAE2F9",
    "on-secondary-container": "#131C2B",
    "error": "#BA1A1A",
    "surface": "#F9F9FF", "surface-dim": "#D9D9E0",
    "surface-container-lowest": "#FFFFFF", "surface-container-low": "#F3F3FA",
    "surface-container": "#EDEDF4", "surface-container-high": "#E7E8EE",
    "surface-container-highest": "#E2E2E9",
    "on-surface": "#191C20", "on-surface-variant": "#44474E",
    "outline": "#74777F", "outline-variant": "#C4C6D0",
    "inverse-surface": "#2E3036", "inverse-on-surface": "#F0F0F7",
}
CHART = {
    "navy (primary bars)": "#33518A", "navy-mid": "#5578AE",
    "navy-light": "#91AAD4", "gray-bar (benchmark)": "#C4C6D0",
    "red (focus / error)": "#BA1A1A", "pos (increase)": "#146C2E",
    "neg (decrease)": "#A63B00",
}
SERIES_EXTRA = {  # price-index dot series + the 5-step stacked-series ramp
    "Austin": "#1F2F47", "East Garfield Park": "#547BB6",
    "West Garfield Park": "#304970", "City of Chicago": "#8F9193",
    "ramp step 1 (darkest)": "#1F3A66", "ramp step 5 (palest)": "#C3D2EA",
}
def t(k):
    return TOKENS[k]


FONT = "Roboto, Arial, sans-serif"
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "assets")
os.makedirs(OUT, exist_ok=True)


def shade(hexcolor, f):
    """Same formula as shade() in index.html (bar gradient stops)."""
    n = int(hexcolor.lstrip("#"), 16)
    r, g, b = (n >> 16) & 255, (n >> 8) & 255, n & 255
    t = 255 if f > 0 else 0
    a = abs(f)
    r, g, b = (round(c + (t - c) * a) for c in (r, g, b))
    return f"#{r:02X}{g:02X}{b:02X}"


def grad(gid, color):
    """3-stop gradient: bright top, base mid, deeply darkened bottom (depth).
    Mirrors fillFor() in index.html."""
    return (f'<linearGradient id="{gid}" x1="0" y1="0" x2="0" y2="1">'
            f'<stop offset="0%" stop-color="{shade(color, .28)}"/>'
            f'<stop offset="40%" stop-color="{shade(color, .02)}"/>'
            f'<stop offset="100%" stop-color="{shade(color, -.42)}"/></linearGradient>')


# Bar corner radius + grain texture — mirrors BAR_RX and ditherFilter() in index.html
BAR_RX = 4


def dither(fid):
    """Film-grain texture filter def (same chain as ditherFilter in index.html):
    dense fractal noise, desaturated, contrast-tamed, soft-light over the fill."""
    return (f'<filter id="{fid}" x="0%" y="0%" width="100%" height="100%">'
            f'<feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" '
            f'stitchTiles="stitch" seed="11" result="noise"/>'
            f'<feColorMatrix in="noise" type="matrix" '
            f'values="0.33 0.33 0.33 0 0  0.33 0.33 0.33 0 0  0.33 0.33 0.33 0 0  0 0 0 0 1" result="grey"/>'
            f'<feComponentTransfer in="grey" result="grain">'
            f'<feFuncR type="linear" slope="0.7" intercept="0.15"/>'
            f'<feFuncG type="linear" slope="0.7" intercept="0.15"/>'
            f'<feFuncB type="linear" slope="0.7" intercept="0.15"/>'
            f'</feComponentTransfer>'
            f'<feBlend in="grain" in2="SourceGraphic" mode="soft-light" result="blended"/>'
            f'<feComposite in="blended" in2="SourceGraphic" operator="in"/>'
            f'</filter>')


def svg(name, w, h, body, defs=""):
    doc = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" '
           f'font-family="{FONT}">\n<defs>{defs}</defs>\n'
           f'<rect width="{w}" height="{h}" fill="#FFFFFF"/>\n{body}\n</svg>\n')
    with open(os.path.join(OUT, name), "w") as f:
        f.write(doc)
    print("wrote", name)


def is_dark(hexcolor):
    n = int(hexcolor.lstrip("#"), 16)
    r, g, b = (n >> 16) & 255, (n >> 8) & 255, n & 255
    return (0.299 * r + 0.587 * g + 0.114 * b) < 150


def swatch_grid(items, w, cols, sw_h=64, label_h=34, pad=12):
    cell_w = (w - pad * (cols + 1)) / cols
    rows_out, x, y, i = [], pad, pad, 0
    for label, color in items:
        tx_fill = "#FFFFFF" if is_dark(color) else "#191C20"
        rows_out.append(
            f'<g><rect x="{x:.1f}" y="{y}" width="{cell_w:.1f}" height="{sw_h}" rx="8" '
            f'fill="{color}" stroke="#C4C6D0" stroke-width="{0 if is_dark(color) else 1}"/>'
            f'<text x="{x+10:.1f}" y="{y+sw_h-10}" font-size="11" font-weight="500" fill="{tx_fill}">{color}</text>'
            f'<text x="{x:.1f}" y="{y+sw_h+15}" font-size="10.5" fill="#44474E">{label}</text></g>')
        i += 1
        x += cell_w + pad
        if i % cols == 0:
            x, y = pad, y + sw_h + label_h
    height = y + (sw_h + label_h if i % cols else 0) + pad
    return "\n".join(rows_out), height


# ------------------------------------------------- 1. system color tokens ---
items = [(f"--md-sys-color-{k}", v) for k, v in TOKENS.items()]
body, h = swatch_grid(items, 720, 4)
svg("colors-system.svg", 720, h, body)

# -------------------------------------------------- 2. chart palette --------
items = [(k, v) for k, v in CHART.items()] + [(k, v) for k, v in SERIES_EXTRA.items()]
body, h = swatch_grid(items, 720, 4)
svg("colors-chart.svg", 720, h, body)

# -------------------------------------------------- 3. bar gradients --------
defs, cells = [], []
gx = 16
for i, (label, color) in enumerate([("navy", "#33518A"), ("navy-mid", "#5578AE"),
                                    ("navy-light", "#91AAD4"), ("gray-bar", "#C4C6D0"),
                                    ("red focus", "#BA1A1A")]):
    gid = f"g{i}"
    defs.append(grad(gid, color))
    cells.append(f'<rect x="{gx}" y="26" width="110" height="120" rx="4" fill="url(#{gid})"/>'
                 f'<text x="{gx}" y="170" font-size="11" fill="#44474E">{label}</text>'
                 f'<text x="{gx}" y="185" font-size="9.5" fill="#74777F">{shade(color,.16)} → {shade(color,-.14)}</text>')
    gx += 140
head = ('<text x="16" y="16" font-size="12" font-weight="500" fill="#191C20">'
        'Bar fill gradients — 3-stop: +0.28 top · +0.02 mid (40%) · −0.42 bottom (depth)</text>')
svg("colors-gradients.svg", 720, 205, head + "".join(cells), "".join(defs))

# -------------------------------------------------- 4. typography -----------
rows = [
    ("Display / page headline", 36, 400, "#191C20", "North Lawndale Housing Dashboard", "Roboto 400 · 36/1.15"),
    ("KPI value", 30, 400, "#191C20", "+10.6%", "Roboto 400 · 30/1"),
    ("Card title", 16, 500, "#191C20", "Change in Occupied Housing Units, 2010 to 2024", "Roboto 500 · 16/1.4"),
    ("Body / intro", 14, 400, "#191C20", "Housing affordability and trends in North Lawndale.", "Roboto 400 · 14/1.5"),
    ("Bar value label", 14.5, 500, "#44474E", "53.9%", "Roboto 500 · 14.5 · on-surface-variant"),
    ("Axis / legend", 12.5, 400, "#44474E", "NEAR WEST SIDE · 2010 · 2024", "Roboto 400 · 12.5 · on-surface-variant"),
    ("Source line", 12, 400, "#44474E", "Source: IHS Data Clearinghouse", "Roboto 400 · 12 · on-surface-variant"),
    ("KPI label / chip (uppercase)", 11, 500, "#44474E", "OCCUPIED UNITS, 2010–24", "Roboto 500 · 11 · +5% tracking"),
]
y, parts = 14, []
for name, size, weight, fill, sample, spec in rows:
    y += size + 26
    parts.append(f'<text x="16" y="{y}" font-size="{size}" font-weight="{weight}" fill="{fill}">{sample}</text>'
                 f'<text x="16" y="{y+15}" font-size="10" fill="#74777F">{name} — {spec}</text>')
svg("typography.svg", 720, y + 34, "".join(parts))

# -------------------------------------------------- 5. KPI card -------------
defs = ('<filter id="e1" x="-20%" y="-20%" width="140%" height="160%">'
        '<feDropShadow dx="0" dy="1" stdDeviation="1.5" flood-color="#000" flood-opacity="0.3"/></filter>')
body = f'''
<rect x="24" y="20" width="200" height="104" rx="12" fill="{t("surface-container-low")}" filter="url(#e1)"/>
<text x="40" y="46" font-size="11" font-weight="500" fill="#44474E" letter-spacing="0.6">OCCUPIED UNITS, 2010–24</text>
<text x="40" y="84" font-size="30" fill="#191C20">+10.6%</text>
<text x="40" y="106" font-size="12" font-weight="500" fill="#A63B00">City +12.3%</text>
<g font-size="10" fill="#74777F">
  <text x="250" y="40">container: surface-container-low {t("surface-container-low")}</text>
  <text x="250" y="56">shape: 12px radius · elevation: level 1</text>
  <text x="250" y="72">label: Roboto 500/11 uppercase · on-surface-variant</text>
  <text x="250" y="88">value: Roboto 400/30 · on-surface</text>
  <text x="250" y="104">delta: pos #146C2E / neg #A63B00</text>
</g>'''
svg("component-kpi-card.svg", 640, 144, body, defs)

# -------------------------------------------------- 6. chart card + chip ----
body = f'''
<rect x="24" y="20" width="330" height="150" rx="12" fill="#FFFFFF" stroke="{t("outline-variant")}"/>
<rect x="44" y="38" width="74" height="22" rx="8" fill="{t("secondary-container")}"/>
<text x="55" y="53" font-size="11" font-weight="500" fill="{t("on-secondary-container")}">Chart 1.1</text>
<text x="44" y="86" font-size="16" font-weight="500" fill="#191C20">Card title, Roboto 500/16</text>
<rect x="44" y="100" width="180" height="8" rx="4" fill="{t("surface-container-high")}"/>
<rect x="44" y="114" width="140" height="8" rx="4" fill="{t("surface-container-high")}"/>
<text x="44" y="150" font-size="12" fill="#44474E">Source: … (on-surface-variant, 12px)</text>
<g font-size="10" fill="#74777F">
  <text x="380" y="40">outlined card: surface-container-lowest #FFFFFF</text>
  <text x="380" y="56">border: outline-variant {t("outline-variant")} · radius 12</text>
  <text x="380" y="72">chip: secondary-container {t("secondary-container")}</text>
  <text x="380" y="88">chip text: on-secondary-container {t("on-secondary-container")}</text>
  <text x="380" y="104">chip shape: 8px radius · Roboto 500/11</text>
</g>'''
svg("component-chart-card.svg", 640, 190, body)

# -------------------------------------------------- 7. tabs -----------------
body = f'''
<rect x="0" y="20" width="640" height="49" fill="{t("surface")}"/>
<line x1="0" y1="68.5" x2="640" y2="68.5" stroke="{t("outline-variant")}"/>
<text x="90" y="50" font-size="14" font-weight="500" fill="{t("primary")}" text-anchor="middle">Demographics</text>
<rect x="40" y="65" width="100" height="3" rx="1.5" fill="{t("primary")}"/>
<text x="230" y="50" font-size="14" font-weight="500" fill="#44474E" text-anchor="middle">Property &amp; Parcels</text>
<text x="390" y="50" font-size="14" font-weight="500" fill="#44474E" text-anchor="middle">Data Appendix</text>
<g font-size="10" fill="#74777F">
  <text x="40" y="100">md-tabs / md-primary-tab (material-web, bundled at vendor/material-tabs.min.js)</text>
  <text x="40" y="116">active: primary {t("primary")} text + 3px indicator · inactive: on-surface-variant {t("on-surface-variant")}</text>
</g>'''
svg("component-tabs.svg", 640, 132, body)

# -------------------------------------------------- 8. data table -----------
rows_html, y0 = [], 52
data = [("Near West Side", "+53.9%", "#146C2E"), ("City of Chicago", "+12.3%", "#146C2E"),
        ("West Garfield Park", "−2.6%", "#A63B00")]
for i, (name, val, col) in enumerate(data):
    y = y0 + 28 * i
    rows_html.append(f'<text x="40" y="{y+18}" font-size="13" fill="#191C20">{name}</text>'
                     f'<text x="330" y="{y+18}" font-size="13" fill="{col}" text-anchor="end">{val}</text>'
                     f'<line x1="24" y1="{y+27}" x2="346" y2="{y+27}" stroke="{t("outline-variant")}"/>')
body = f'''
<rect x="24" y="24" width="322" height="28" fill="{t("surface-container")}"/>
<text x="40" y="43" font-size="12.5" font-weight="500" fill="#44474E">Community</text>
<text x="330" y="43" font-size="12.5" font-weight="500" fill="#44474E" text-anchor="end">Percent change</text>
{''.join(rows_html)}
<g font-size="10" fill="#74777F">
  <text x="380" y="44">header: surface-container {t("surface-container")}</text>
  <text x="380" y="60">header text: Roboto 500/12.5 on-surface-variant</text>
  <text x="380" y="76">rules: outline-variant {t("outline-variant")}</text>
  <text x="380" y="92">numerals: tabular-nums, right-aligned</text>
  <text x="380" y="108">pos #146C2E · neg #A63B00</text>
</g>'''
svg("component-table.svg", 640, 160, body)

# -------------------------------------------------- 9. tooltip --------------
defs = ('<filter id="e2" x="-30%" y="-30%" width="160%" height="180%">'
        '<feDropShadow dx="0" dy="2" stdDeviation="3" flood-color="#000" flood-opacity="0.25"/></filter>')
body = f'''
<rect x="24" y="24" width="190" height="58" rx="8" fill="{t("inverse-surface")}" filter="url(#e2)"/>
<text x="38" y="47" font-size="13" font-weight="500" fill="{t("inverse-on-surface")}">North Lawndale</text>
<text x="38" y="66" font-size="12.5" fill="{t("inverse-on-surface")}">2024: 10.6%</text>
<g font-size="10" fill="#74777F">
  <text x="240" y="40">container: inverse-surface {t("inverse-surface")}</text>
  <text x="240" y="56">text: inverse-on-surface {t("inverse-on-surface")}</text>
  <text x="240" y="72">shape: 8px · elevation level 2 · Roboto 12.5</text>
</g>'''
svg("component-tooltip.svg", 640, 106, body, defs)

# -------------------------------------------------- 10. chart specimens -----
defs = grad("rb", "#33518A") + grad("rgr", "#C4C6D0") + dither("dth")
bars = [(46, 52, "url(#rb)", "53.9%"), (116, 88, "url(#rb)", "31.6%"),
        (186, 118, "url(#rgr)", "12.3%"), (256, 122, "url(#rb)", "10.6%"),
        (326, 138, "url(#rb)", "7.3%")]
parts = []
for x, y, fill, lab in bars:
    parts.append(f'<rect x="{x}" y="{y}" width="44" height="{170-y}" rx="{BAR_RX}" ry="{BAR_RX}" '
                 f'fill="{fill}" filter="url(#dth)"/>'
                 f'<text x="{x+22}" y="{y-8}" font-size="12" font-weight="500" fill="#44474E" text-anchor="middle">{lab}</text>')
parts.append(f'<rect x="252" y="118" width="52" height="56" rx="{BAR_RX+2}" fill="none" stroke="#BA1A1A" stroke-width="3"/>')
parts.append('<line x1="30" y1="170" x2="400" y2="170" stroke="#74777F"/>')
parts.append('<text x="420" y="60" font-size="10" fill="#74777F">ranked bars · deep gradient + film grain</text>')
parts.append('<text x="420" y="76" font-size="10" fill="#74777F">rounded 4px · gray benchmark · red focus (3px)</text>')
svg("chart-ranked.svg", 640, 195, "".join(parts), defs)

parts = []
rows = [(50, 120, 300, "$61K", "$70.3K", "$90K")]
for i, (y, x1, x2, l1, lmid, l2) in enumerate([(50, 120, 300, "$61K", "$70.3K", "$90K"),
                                               (98, 150, 340, "$62K", "$68K", "$88K")]):
    xm = (x1 + x2) / 2
    parts.append(f'<line x1="{x1}" y1="{y}" x2="{x2}" y2="{y}" stroke="#C9CBCD" stroke-width="2.5"/>'
                 f'<circle cx="{x1}" cy="{y}" r="7" fill="#91AAD4" stroke="#fff" stroke-width="1.5"/>'
                 f'<circle cx="{xm}" cy="{y}" r="7" fill="#5578AE" stroke="#fff" stroke-width="1.5"/>'
                 f'<circle cx="{x2}" cy="{y}" r="7" fill="#33518A" stroke="#fff" stroke-width="1.5"/>'
                 f'<text x="{x1-13}" y="{y+4}" font-size="12" font-weight="500" fill="#44474E" text-anchor="end">{l1}</text>'
                 f'<text x="{xm}" y="{y-13}" font-size="12" font-weight="500" fill="#44474E" text-anchor="middle">{lmid}</text>'
                 f'<text x="{x2+13}" y="{y+4}" font-size="12" font-weight="500" fill="#44474E">{l2}</text>')
parts.append('<text x="420" y="60" font-size="10" fill="#74777F">dumbbell · dot per period, flat fills</text>')
parts.append('<text x="420" y="76" font-size="10" fill="#74777F">min label left · max right · middle above</text>')
svg("chart-dumbbell.svg", 640, 140, "".join(parts))

defs = grad("dv1", "#33518A") + grad("dv2", "#91AAD4") + dither("dth2")
parts = [f'<line x1="210" y1="24" x2="210" y2="140" stroke="#74777F"/>']
for i, (occ_w, vac_w, tot) in enumerate([(150, 40, 116), (60, 70, -6), (30, 90, -56)]):
    y = 34 + i * 38
    parts.append(f'<rect x="210" y="{y}" width="{occ_w}" height="24" fill="url(#dv1)" filter="url(#dth2)"/>')
    parts.append(f'<rect x="{210-vac_w}" y="{y}" width="{vac_w}" height="24" fill="url(#dv2)" filter="url(#dth2)"/>')
    x0, x1 = (210, 210 + tot) if tot >= 0 else (210 + tot, 210)
    parts.append(f'<rect x="{x0}" y="{y-2}" width="{abs(tot)}" height="28" fill="none" stroke="#BA1A1A" stroke-width="2.5"/>')
parts.append('<text x="420" y="56" font-size="10" fill="#74777F">diverging stacked · occupied right / vacant left</text>')
parts.append('<text x="420" y="72" font-size="10" fill="#74777F">film grain · square ends (segments abut)</text>')
parts.append('<text x="420" y="88" font-size="10" fill="#74777F">red hollow rect = net total marker</text>')
svg("chart-diverging.svg", 640, 160, "".join(parts), defs)

defs = grad("s1", "#33518A") + grad("s2", "#5578AE") + grad("s3", "#91AAD4") + dither("dth3")
parts = []
for i, segs in enumerate([[(52, "s1", "51.7%"), (33, "s2", "33.3%"), (15, "s3", "15.0%")],
                          [(30, "s1", "30.2%"), (25, "s2", "25.3%"), (45, "s3", "44.6%")]]):
    x = 60 + i * 110
    y = 30
    for hpct, gid, lab in segs:
        hh = hpct * 1.3
        parts.append(f'<rect x="{x}" y="{y}" width="64" height="{hh}" fill="url(#{gid})" filter="url(#dth3)"/>'
                     f'<text x="{x+32}" y="{y+hh/2+4}" font-size="11" font-weight="500" fill="#fff" text-anchor="middle">{lab}</text>')
        y += hh
parts.append('<rect x="56" y="26" width="72" height="138" fill="none" stroke="#BA1A1A" stroke-width="3"/>')
parts.append('<text x="330" y="56" font-size="10" fill="#74777F">100% stacked · navy tonal ramp + grain</text>')
parts.append('<text x="330" y="72" font-size="10" fill="#74777F">white segment labels (≥6% only)</text>')
parts.append('<text x="330" y="88" font-size="10" fill="#74777F">red outline = focus geography</text>')
svg("chart-stacked.svg", 640, 190, "".join(parts), defs)

import math
parts = ['<line x1="30" y1="90" x2="400" y2="90" stroke="#A7A9AC"/>']
series = [("#BA1A1A", 6.5, [0, 20, -35, -62, -60, -40, -10, 30, 55]),
          ("#8F9193", 4, [0, 8, -18, -38, -30, -12, 8, 22, 34]),
          ("#1F2F47", 4, [0, 12, -28, -55, -48, -30, -5, 15, 22])]
for color, r, vals in series:
    for i, v in enumerate(vals):
        x = 40 + i * 44
        y = 90 - v * 0.7
        parts.append(f'<circle cx="{x}" cy="{y:.0f}" r="{r}" fill="{color}" opacity="{1 if r>5 else .85}"/>')
parts.append('<text x="420" y="60" font-size="10" fill="#74777F">index dots · data points only, no lines</text>')
parts.append('<text x="420" y="76" font-size="10" fill="#74777F">focus series red, r 5.5 · others r 4 @ 85%</text>')
svg("chart-dots.svg", 640, 165, "".join(parts))

# -------------------------------------------------- 11. shape + elevation ---
defs = ('<filter id="s_e1" x="-20%" y="-20%" width="140%" height="160%">'
        '<feDropShadow dx="0" dy="1" stdDeviation="1.5" flood-color="#000" flood-opacity="0.3"/></filter>'
        '<filter id="s_e2" x="-30%" y="-30%" width="160%" height="180%">'
        '<feDropShadow dx="0" dy="2" stdDeviation="3" flood-color="#000" flood-opacity="0.25"/></filter>')
body = f'''
<g>
  <rect x="30" y="30" width="90" height="60" rx="8" fill="{t("surface-container-low")}" stroke="{t("outline-variant")}"/>
  <text x="75" y="110" font-size="10" fill="#44474E" text-anchor="middle">8px · chip, badge, tooltip</text>
  <rect x="160" y="30" width="90" height="60" rx="12" fill="{t("surface-container-low")}" stroke="{t("outline-variant")}"/>
  <text x="205" y="110" font-size="10" fill="#44474E" text-anchor="middle">12px · cards</text>
  <rect x="300" y="30" width="90" height="60" rx="0" fill="#FFFFFF" filter="url(#s_e1)"/>
  <text x="345" y="110" font-size="10" fill="#44474E" text-anchor="middle">elevation 1 · KPI cards</text>
  <rect x="440" y="30" width="90" height="60" rx="0" fill="#FFFFFF" filter="url(#s_e2)"/>
  <text x="485" y="110" font-size="10" fill="#44474E" text-anchor="middle">elevation 2 · tooltip</text>
</g>'''
svg("shape-elevation.svg", 640, 130, body, defs)

# -------------------------------------------------- 12. bar texture & shape -
defs = grad("tb", "#33518A") + dither("dth4")
body = f'''
<text x="16" y="18" font-size="12" font-weight="500" fill="#191C20">Bar treatment — flat → deep gradient → rounded → rounded + grain</text>
<rect x="30"  y="40" width="80" height="130" fill="#33518A"/>
<text x="70"  y="188" font-size="10" fill="#44474E" text-anchor="middle">flat</text>
<rect x="150" y="40" width="80" height="130" fill="url(#tb)"/>
<text x="190" y="188" font-size="10" fill="#44474E" text-anchor="middle">gradient</text>
<rect x="270" y="40" width="80" height="130" rx="{BAR_RX}" fill="url(#tb)"/>
<text x="310" y="188" font-size="10" fill="#44474E" text-anchor="middle">rounded {BAR_RX}px</text>
<rect x="390" y="40" width="80" height="130" rx="{BAR_RX}" fill="url(#tb)" filter="url(#dth4)"/>
<text x="430" y="188" font-size="10" fill="#44474E" text-anchor="middle">+ film grain (applied)</text>
<g font-size="10" fill="#74777F">
  <text x="500" y="60">rounding: rx {BAR_RX} on standalone bars</text>
  <text x="500" y="76">(stacked/diverging stay square)</text>
  <text x="500" y="96">grain: feTurbulence fractalNoise 0.9</text>
  <text x="500" y="112">desaturated · soft-light blend</text>
  <text x="500" y="128">over gradient · clipped to the mark</text>
</g>'''
svg("bar-texture.svg", 640, 210, body, defs)

print("\nAll assets in", OUT)
