# North Lawndale Housing Dashboard — Prototype

An interactive recreation of the IHS baseline data presentation (May 21, 2026)
for the Steans Family Foundation. Everything in this folder is self-contained —
**no internet connection is required.**

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
  (Institute for Housing Studies at DePaul University). Values that the deck
  did not label were digitized from the presentation's vector geometry; each
  chart's source line states its precision.
- Hover any chart mark for exact values. The **Data Appendix** tab contains
  the full data table behind every chart.
- Works in any modern browser (Chrome, Edge, Safari, Firefox).
