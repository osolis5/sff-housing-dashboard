# SFF + Dashboard — Prototype

SFF + Dashboard is the Steans Family Foundation's interactive housing data
dashboard for North Lawndale and West Side communities. Everything in this
folder is self-contained — **no internet connection is required.**

## How to open it

**Easiest — double-click `index.html`.**
The dashboard opens in your default browser. Everything works.

**Best — use the launcher for your system:**

- **Mac:** double-click `Start Dashboard (Mac).command`
  (If macOS says it's from an unidentified developer: right-click it, choose
  *Open*, then *Open* again. You only need to do this once.)
- **Windows:** double-click `Start Dashboard (Windows).bat`

The launcher starts a tiny local web server and opens the dashboard — this
enables the fully polished Material tab animations. Close the terminal window
(or press Ctrl+C) when you're done. If your machine doesn't have Python, the
launcher simply opens `index.html` directly instead, which is also fine.

## What's inside

| File / folder            | What it is                                              |
|--------------------------|---------------------------------------------------------|
| `index.html`             | **The dashboard** (Material Design 3 version)           |
| `v1-report.html`         | Earlier version styled like IHS's five-year-plan site   |
| `v2-gradient.html`       | Earlier navy-gradient dashboard version                 |
| `bronzeville-csv.html`   | Companion explorer for the Bronzeville Trail CSV export |
| `styleguide/`            | Material Design style guide + SVG asset library         |
| `vendor/`                | All local assets: D3, Material components, fonts, hero video |

## Notes

- Data was transcribed from `IHS_NLawndale_Dashboard_Presentation_05182026.pdf`
  (Institute for Housing Studies at DePaul University). Only values printed
  in the presentation are shown; charts whose values the deck does not label
  are not included.
- Hover any chart mark for exact values. The **Data Appendix** tab contains
  the full data table behind every chart.
- Works in any modern browser (Chrome, Edge, Safari, Firefox).
