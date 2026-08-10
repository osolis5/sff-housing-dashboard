#!/usr/bin/env python3
"""Audit 3: end-to-end — recompute every displayed value for the 8 browser states
with an independent implementation and diff against the scraped strings.
Scrape of 2026-08-10 taken from the refactored shared-component page (pc- classes)."""
import json, math

scraped = json.loads(r'''[["A",{"piti":"$1,576","pi":"$1,201","legRows":4,"needed":"$67,543 /yr","renterBurden":"52.5%","renterMax":"$89K","renterPill":"Severely burdened","ownerBurden":"20.4%"}],["B",{"piti":"$2,223","pi":"$1,741","legRows":4,"needed":"$95,262 /yr","renterBurden":"74%","renterMax":"$81K","renterPill":"Severely burdened","ownerBurden":"28.8%"}],["C",{"piti":"$916","pi":"$600","legRows":4,"needed":"$39,265 /yr","renterBurden":"30.5%","renterMax":"$89K","renterPill":"Cost-burdened","ownerBurden":"11.9%"}],["D",{"piti":"$1,268","pi":"$1,011","legRows":3,"needed":"$54,328 /yr","renterBurden":"42.2%","renterMax":"$116K","renterPill":"Cost-burdened","ownerBurden":"16.4%"}],["E",{"piti":"$2,531","pi":"$2,149","legRows":4,"needed":"$67,481 /yr","renterBurden":"84.3%","renterMax":"$96K","renterPill":"Severely burdened","ownerBurden":"32.7%"}],["F",{"piti":"$1,254","pi":"$804","legRows":3,"needed":"$75,250 /yr","renterBurden":"41.8%","renterMax":"$54K","renterPill":"Cost-burdened","ownerBurden":"16.2%"}],["G",{"piti":"$2,565","pi":"$2,113","legRows":4,"needed":"$109,941 /yr","renterBurden":"85.5%","renterMax":"$82K","renterPill":"Severely burdened","ownerBurden":"33.2%"}],["H",{"piti":"$660","pi":"$600","legRows":4,"needed":"$28,279 /yr","renterBurden":"22%","renterMax":"$127K","renterPill":"Affordable","ownerBurden":"8.5%"}]]''')

STATES = {  # price, down%, rate%, years, tax/yr, ins/yr, ratio%
  'A': (200000,  5,   6.5,   30, 1376, 1700, 28),
  'B': (290000,  5,   6.5,   30, 2011, 1700, 28),
  'C': (100000,  5,   6.5,   30, 1376, 1700, 28),
  'D': (200000, 20,   6.5,   30, 1376, 1700, 28),
  'E': (200000,  0,  10.0,   15, 1376, 1700, 45),
  'F': (290000, 50,   3.0,   20, 3000, 2400, 20),
  'G': (325000,  3.5, 7.125, 30, 1376, 1700, 28),
  'H': (100000,  5,   6.5,   30,    0,    0, 28),
}
RENTER, OWNER = 36023, 92765
PMI = 0.75

rnd = lambda n: math.floor(n + 0.5)                      # JS Math.round
fmt = lambda n: '$' + format(rnd(n), ',')                # JS fmt$
fmtK = lambda n: '$' + str(rnd(n / 1000)) + 'K' if n >= 1000 else fmt(n)
def fmt_pct(x, d=1):                                     # JS fmtPct
    s = f'{x*100:.{d}f}'
    if s.endswith('.0'): s = s[:-2]
    return s + '%'
def pnif(rate, years):
    r, n = rate / 100 / 12, years * 12
    return 1 / n if r == 0 else r * (1 + r) ** n / ((1 + r) ** n - 1)
def pill(b): return 'Affordable' if b <= .30 else 'Cost-burdened' if b <= .50 else 'Severely burdened'

fails = 0
for key, s in scraped:
    price, dp, rate, yrs, tax, ins, ratio = STATES[key]
    d = dp / 100
    loan = price * (1 - d)
    pi = loan * pnif(rate, yrs)
    pmi = loan * PMI / 100 / 12 if d < 0.2 else 0
    piti = pi + tax / 12 + ins / 12 + pmi
    needed = piti * 12 / (ratio / 100)
    def burden(inc): return piti / (inc / 12)
    def maxp(inc):
        budget = inc / 12 * ratio / 100 - tax / 12 - ins / 12
        if budget <= 0: return 0
        return budget / ((1 - d) * (pnif(rate, yrs) + (PMI / 100 / 12 if d < 0.2 else 0)))
    exp = {
        'piti': fmt(piti), 'pi': fmt(pi),
        'legRows': 4 if pmi > 0.5 else 3,
        'needed': fmt(needed) + ' /yr',
        'renterBurden': fmt_pct(burden(RENTER)), 'renterMax': fmtK(maxp(RENTER)),
        'renterPill': pill(burden(RENTER)), 'ownerBurden': fmt_pct(burden(OWNER)),
    }
    for k, want in exp.items():
        got = s[k]
        ok = str(got) == str(want)
        if not ok: fails += 1
        print(f'  {"PASS" if ok else "FAIL"}  {key}.{k:13s} page={got!s:22s} independent={want}')
print(f'\n{"ALL PASS" if fails == 0 else str(fails) + " FAILURES"} — {len(scraped)*8} displayed values checked across 8 states')
