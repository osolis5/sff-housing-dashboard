#!/usr/bin/env python3
"""Audit 3: end-to-end — recompute every displayed value for the 8 browser states
with an independent implementation and diff against the scraped strings.
Scrape of 2026-08-12 taken from the price-tier / effective-tax-rate build
(tiers replace property types; taxes default to 1.5% of price, live until the
field is edited; benchmarks = NL/Chicago renter + homebuyer medians; profile
rows add a gap column = max affordable price − scenario price)."""
import json, math

scraped = json.loads(r'''[["A",{"piti":"$2,692","pi":"$1,952","legRows":4,"needed":"$115,388 /yr","taxMode":"assumption · 1.5% of price","taxField":"4,875","renterBurden":"89.7%","renterMax":"$89K","renterGap":"−$236K","renterPill":"Severely burdened","chiBuyerBurden":"25.8%","chiBuyerMax":"$354K","chiBuyerGap":"+$29K","chiBuyerPill":"Affordable"}],["B",{"piti":"$2,055","pi":"$1,464","legRows":4,"needed":"$88,059 /yr","taxMode":"assumption · 1.5% of price","taxField":"3,656","renterBurden":"68.4%","renterMax":"$89K","renterGap":"−$155K","renterPill":"Severely burdened","chiBuyerBurden":"19.7%","chiBuyerMax":"$354K","chiBuyerGap":"+$110K","chiBuyerPill":"Affordable"}],["C",{"piti":"$3,330","pi":"$2,439","legRows":4,"needed":"$142,718 /yr","taxMode":"assumption · 1.5% of price","taxField":"6,094","renterBurden":"110.9%","renterMax":"$89K","renterGap":"−$317K","renterPill":"Severely burdened","chiBuyerBurden":"32%","chiBuyerMax":"$354K","chiBuyerGap":"−$53K","chiBuyerPill":"Cost-burdened"}],["D",{"piti":"$2,191","pi":"$1,643","legRows":3,"needed":"$93,913 /yr","taxMode":"assumption · 1.5% of price","taxField":"4,875","renterBurden":"73%","renterMax":"$111K","renterGap":"−$214K","renterPill":"Severely burdened","chiBuyerBurden":"21%","chiBuyerMax":"$440K","chiBuyerGap":"+$115K","chiBuyerPill":"Affordable"}],["E",{"piti":"$1,576","pi":"$1,201","legRows":4,"needed":"$67,543 /yr","taxMode":"edited · custom amount","taxField":"1,376","renterBurden":"52.5%","renterMax":"$89K","renterGap":"−$111K","renterPill":"Severely burdened","chiBuyerBurden":"15.1%","chiBuyerMax":"$403K","chiBuyerGap":"+$203K","chiBuyerPill":"Affordable"}],["F",{"piti":"$1,254","pi":"$804","legRows":3,"needed":"$75,250 /yr","taxMode":"edited · custom amount","taxField":"3,000","renterBurden":"41.8%","renterMax":"$54K","renterGap":"−$236K","renterPill":"Cost-burdened","chiBuyerBurden":"12%","chiBuyerMax":"$589K","chiBuyerGap":"+$299K","chiBuyerPill":"Affordable"}],["G",{"piti":"$2,035","pi":"$1,612","legRows":4,"needed":"$54,262 /yr","taxMode":"assumption · 1.5% of price","taxField":"2,250","renterBurden":"67.8%","renterMax":"$96K","renterGap":"−$54K","renterPill":"Severely burdened","chiBuyerBurden":"19.5%","chiBuyerMax":"$360K","chiBuyerGap":"+$210K","chiBuyerPill":"Affordable"}],["H",{"piti":"$660","pi":"$600","legRows":4,"needed":"$28,279 /yr","taxMode":"edited · custom amount","taxField":"0","renterBurden":"22%","renterMax":"$127K","renterGap":"+$27K","renterPill":"Affordable","chiBuyerBurden":"6.3%","chiBuyerMax":"$442K","chiBuyerGap":"+$342K","chiBuyerPill":"Affordable"}]]''')

STATES = {  # price, down%, rate%, years, tax mode, custom tax $, ins/yr, ratio%
  'A': (325000,  5,   6.5, 30, 'rate',   None, 1700, 28),   # Typical tier (G!G19)
  'B': (243750,  5,   6.5, 30, 'rate',   None, 1700, 28),   # Lower tier (G!I19)
  'C': (406250,  5,   6.5, 30, 'rate',   None, 1700, 28),   # Higher tier (G!J19)
  'D': (325000, 20,   6.5, 30, 'rate',   None, 1700, 28),   # 20% down -> no PMI
  'E': (200000,  5,   6.5, 30, 'custom', 1376, 1700, 28),   # all-sales SF preset, TY2023 bill typed in
  'F': (290000, 50,   3.0, 20, 'custom', 3000, 2400, 20),   # 2-4 preset, everything moved
  'G': (150000,  0,  10.0, 15, 'rate',   None, 1700, 45),   # extremes, rate-mode tax
  'H': (100000,  5,   6.5, 30, 'custom',    0,    0, 28),   # zero tax & insurance
}
RENTER, CHIBUYER = 36023, 125000        # NL renter (A!I83) · Chicago homebuyer (slide 21)
PMI = 0.75
TAX_RATE = 0.015                        # effective-rate assumption (Civic Federation)

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
def fmt_gap(g):                                          # JS: (gap>=0?'+':'−') + fmtK(abs)
    return ('+' if g >= 0 else '−') + fmtK(abs(g))

fails = 0
for key, s in scraped:
    price, dp, rate, yrs, mode, taxfix, ins, ratio = STATES[key]
    d = dp / 100
    tax = TAX_RATE * price if mode == 'rate' else taxfix   # rate mode keeps the exact product
    loan = price * (1 - d)
    pi = loan * pnif(rate, yrs)
    pmi = loan * PMI / 100 / 12 if d < 0.2 else 0
    piti = pi + tax / 12 + ins / 12 + pmi
    needed = piti * 12 / (ratio / 100)
    def burden(inc): return piti / (inc / 12)
    def maxp(inc):
        per = (1 - d) * (pnif(rate, yrs) + (PMI / 100 / 12 if d < 0.2 else 0))
        if mode == 'rate':
            budget = inc / 12 * ratio / 100 - ins / 12
            per += TAX_RATE / 12
        else:
            budget = inc / 12 * ratio / 100 - tax / 12 - ins / 12
        return 0 if budget <= 0 else budget / per
    exp = {
        'piti': fmt(piti), 'pi': fmt(pi),
        'legRows': 4 if pmi > 0.5 else 3,
        'needed': fmt(needed) + ' /yr',
        'taxMode': 'assumption · 1.5% of price' if mode == 'rate' else 'edited · custom amount',
        'taxField': format(rnd(tax), ','),
        'renterBurden': fmt_pct(burden(RENTER)),
        'renterMax': fmtK(maxp(RENTER)) if maxp(RENTER) > 1000 else '—',
        'renterGap': fmt_gap(maxp(RENTER) - price),
        'renterPill': pill(burden(RENTER)),
        'chiBuyerBurden': fmt_pct(burden(CHIBUYER)),
        'chiBuyerMax': fmtK(maxp(CHIBUYER)) if maxp(CHIBUYER) > 1000 else '—',
        'chiBuyerGap': fmt_gap(maxp(CHIBUYER) - price),
        'chiBuyerPill': pill(burden(CHIBUYER)),
    }
    for k, want in exp.items():
        got = s[k]
        ok = str(got) == str(want)
        if not ok: fails += 1
        print(f'  {"PASS" if ok else "FAIL"}  {key}.{k:14s} page={got!s:24s} independent={want}')
print(f'\n{"ALL PASS" if fails == 0 else str(fails) + " FAILURES"} — {len(scraped)*14} displayed values checked across 8 states')
