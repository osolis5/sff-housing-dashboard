# West Side Foreclosure Timeline

An interactive timeline visualization of residential **foreclosure filing activity**
across nine West Side Chicago community areas, 2005–2025. Built for the Steans
Family Foundation (SFF) housing work.

Each row is a community area; each cell is one year, shaded by the number of
foreclosure filings that year. Reading left to right shows the 2007–2013
foreclosure crisis sweep across the West Side and the long, uneven recovery that
followed.

![Chart type: categorical timeline / heatmap](index.html)

---

## How to open it

The visualization is **fully self-contained and works offline** — no internet
connection and no build step required.

- **Quickest:** double-click `index.html`. It opens in your default browser and
  renders immediately.
- **For full interactivity** (hover tooltips, drag-to-zoom on the time slider),
  it's best served over a tiny local web server rather than opened as a `file://`
  page. From this folder:

  ```
  python3 -m http.server 8000
  ```

  then visit <http://localhost:8000/>. (Some browsers restrict a few features on
  `file://` pages; a local server avoids that.)

Works in any modern browser (Chrome, Edge, Safari, Firefox).

### Interactions
- **Hover** any cell → a tooltip with the exact filing count and its tier.
- **Drag** the grey window on the bottom time slider → zoom into a period. The
  grey (dithered) window is the active/visualized range; the white area is
  outside the current view.
- **Reset Zoom** (top-right) → return to the full 2005–2025 range.

---

## What's inside

| File / folder                         | What it is                                                    |
|---------------------------------------|--------------------------------------------------------------|
| `index.html`                          | **The visualization** (self-contained page + embedded data)  |
| `data/foreclosure_filings_long.csv`   | Tidy data: one row per community area × year                  |
| `data/foreclosure_filings_wide.csv`   | Same data in wide form (one column per year)                 |
| `vendor/d3.v7.min.js`                 | D3 v7 (provides the ordinal color scale)                     |
| `vendor/timelines-chart.min.js`       | Timeline chart library (see note below)                      |
| `vendor/fonts.css` + `vendor/fonts/`  | Roboto web fonts (offline)                                   |
| `README.md`                           | This file                                                    |

The chart's data is embedded directly in `index.html`, so the page renders on its
own. The CSVs in `data/` are the same values provided separately for reuse in
other tools (Excel, R, Python, etc.).

---

## Data

**Source:** `Chicago Community Areas_2026_SFF_Indicators_07022026.xlsx`, sheet
**D. Foreclosures**, table *"Foreclosure Activity for Residential Properties in
Chicago Community Areas."*

**Coverage:** 9 West Side community areas — Austin, East Garfield Park, Humboldt
Park, Lower West Side, Near West Side, North Lawndale, South Lawndale, West
Garfield Park, West Town — for years **2005–2025**.

**Measure:** annual count of residential foreclosure **filings** (the start of the
foreclosure process; an indicator of housing distress).

> All values are the real figures from the workbook. Nothing is estimated or
> synthesized. Color only *bins* the true counts into tiers — the hover tooltip
> always shows the exact number.

### Data dictionary — `foreclosure_filings_long.csv`

| Column                | Type    | Description                                             |
|-----------------------|---------|---------------------------------------------------------|
| `community_area`      | text    | Chicago community area name                              |
| `year`                | integer | Calendar year (2005–2025)                               |
| `foreclosure_filings` | integer | Number of residential foreclosure filings that year     |
| `tier`                | text    | Intensity bucket used for cell color (see below)         |

### Color tiers (severity ramp)

The five tiers are a warm sequential scale grounded in **Google Material Design 3**
tonal palettes (warm amber → deep orange → the M3 *error* palette):

| Tier      | Filings / year | Swatch (base color) |
|-----------|----------------|---------------------|
| `0-49`    | 0–49           | near-white **dither** pattern |
| `50-149`  | 50–149         | `#F6D6A8` amber     |
| `150-299` | 150–299        | `#F0A860` orange    |
| `300-599` | 300–599        | `#D9633B` deep orange |
| `600+`    | 600 or more    | `#BA1A1A` M3 error red |

---

## Design notes

- **Warm intensity ramp** grounded in Material Design 3 tonal palettes.
- **Dither texture** on the lowest tier (`0-49`) — an ordered near-white pattern
  so low-activity years read as "almost empty" without disappearing.
- **Time slider** — the inactive range is a white track; the active/selected
  window is a grey **dithered** rectangle with a stroked outline and open,
  transparent handle boxes, so it's clear what's currently visualized.
- **Group label** ("West Side community areas") is wrapped onto two lines so it's
  fully visible in the left margin.
- **Tooltip** — a white rectangle with a black border and black text, showing the
  community area, year, exact filing count, and tier. The library's redundant
  group-label and row-label hover tooltips are disabled.
- **Background** — plain white.

### Note on the vendored chart library

`vendor/timelines-chart.min.js` is [vasturiano/timelines-chart](https://github.com/vasturiano/timelines-chart)
(v2.14.3), with **one small local modification**: the bottom time slider
("brusher") is patched to render at the full chart width using the chart's own
left/right margins, so the slider aligns exactly with the timeline bars above it.
(The stock library hardcodes the slider to 80% width with fixed 20px margins.) If
this library is ever re-downloaded from npm/CDN, that one-line patch must be
re-applied. `index.html` loads it as `timelines-chart.min.js?v=2` — the `?v=`
query is a cache-buster; bump it if you edit the library again.

---

## Credits

- Timeline chart: [timelines-chart](https://github.com/vasturiano/timelines-chart) by Vasco Asturiano (MIT).
- [D3.js](https://d3js.org/) v7 (ISC).
- Data: Institute for Housing Studies at DePaul University, via the SFF indicators workbook.
