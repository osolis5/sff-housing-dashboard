/* PITI calculator — shared component. Renders the full calculator into a
   mount node: window.PITI.render(mount, data, { embedded }).
   Used by the standalone page (PITI-Calculator/index.html) and by the
   dashboard's "PITI Calculator" tab (no iframe). Classes are pc-prefixed to
   coexist with host styles; ids are unique per page (one instance max). */
(function () {
  'use strict';

  /* price tiers replace the former property-type chips (July 2026 feedback):
     anchored in mortgage-financed purchases, not all-sales medians by type.
     lower/higher are workbook placeholders (75% / 125% of the median) until
     true 25th/75th percentile prices are calculated. */
  const TIERS = [
    { key: 'lower',   label: 'Lower cost',  badge: 'placeholder · 75% of median',  color: '#91AAD4' },
    { key: 'typical', label: 'Typical',     badge: 'dataset · 2024 median',        color: '#33518A' },
    { key: 'higher',  label: 'Higher cost', badge: 'placeholder · 125% of median', color: '#5578AE' }
  ];
  const RAMP4 = ['#D3DCEF', '#A8BCE0', '#5578AE', '#33518A'];
  const RACE5 = ['#33518A', '#5578AE', '#91AAD4', '#A8BCE0', '#C4C6D0'];
  const PMI_RATE = 0.75;          // % of loan per year, assumption
  const INS_DEFAULT = 1700;       // $/yr, assumption

  const fmt$ = n => '$' + Math.round(n).toLocaleString('en-US');
  const fmtK = n => n >= 1000 ? '$' + Math.round(n / 1000) + 'K' : fmt$(n);
  const fmtPct = (n, d = 1) => (n * 100).toFixed(d).replace(/\.0$/, '') + '%';

  function template(D, opts) {
    const carded = Array.isArray(opts.cards);
    const statData = [
      [fmt$(D.priceTiers2024.typical), '2024 median sale, mortgage-financed 1–4 unit'],
      [fmt$(D.taxBillsTY2024.sf), 'TY2024 median tax bill, single family'],
      [D.hmda.loans2024, 'home-purchase loans, 2024'],
      [fmt$(D.homebuyerIncomes2024.nl), 'median homebuyer income, 2024']
    ];
    /* carded mode mirrors the dashboard KPI cards (label above value); the
       flat/standalone mode keeps the calculator's own value-first stat tiles */
    const stats = carded
      ? statData.map(([v, l]) => `<div class="pc-stat"><p class="pc-kpi-label">${l}</p><p class="pc-kpi-value">${v}</p></div>`).join('')
      : statData.map(([v, l]) => `<div class="pc-stat"><div class="pc-v">${v}</div><div class="pc-l">${l}</div></div>`).join('');

    const repoHref = (opts.repoBase || '') + 'data.html';
    return carded ? cardedLayout(D, opts, stats, repoHref) : flatLayout(D, opts, stats, repoHref);
  }

  /* ---- shared section bodies (identical ids/controls in both layouts) ---- */
  function bodyPayment(D, repoHref) {
    return `
  <p class="pc-sub">Pick a price tier — anchored in what mortgage-financed buyers actually paid for North Lawndale
    homes in 2024 — then adjust the loan to match a buyer. Values marked <span class="pc-badge pc-data">dataset</span>
    come straight from the SFF indicator tables; values marked <span class="pc-badge pc-assume">assumption</span> are
    adjustable estimates. Every number is itemized, cell by cell, in the
    <a href="${repoHref}" target="_blank" rel="noopener">data repository &amp; methods</a>.</p>

  <div class="pc-calc">
    <div class="pc-card pc-inputs">
      <div class="pc-chips" id="tier-chips" role="group" aria-label="Price tier"></div>

      <div class="pc-field">
        <div class="pc-row">
          <label for="price">Purchase price</label>
          <span class="pc-badge pc-data" id="price-badge">dataset · 2024 median</span>
          <span class="pc-val" id="price-val"></span>
        </div>
        <input type="range" id="price" min="25000" max="800000" step="1250" aria-label="Purchase price">
        <div class="pc-presets">Compare: all-sales 2024 medians —
          <button id="preset-sf">single family (${fmtK(D.salePrices2024.sf)})</button> ·
          <button id="preset-u24">2–4 unit (${fmtK(D.salePrices2024.u24)})</button>
        </div>
      </div>

      <div class="pc-field">
        <div class="pc-row">
          <label for="down">Down payment</label>
          <span class="pc-badge pc-assume">assumption</span>
          <span class="pc-val" id="down-val"></span>
        </div>
        <input type="range" id="down" min="0" max="50" step="0.5" aria-label="Down payment percent">
        <p class="pc-fine" id="pmi-note"></p>
      </div>

      <div class="pc-field">
        <div class="pc-row">
          <label for="rate">Interest rate (30-yr fixed style APR)</label>
          <span class="pc-badge pc-assume">assumption</span>
          <span class="pc-val" id="rate-val"></span>
        </div>
        <input type="range" id="rate" min="3" max="10" step="0.125" aria-label="Interest rate">
      </div>

      <div class="pc-field">
        <div class="pc-row"><label>Loan term</label></div>
        <div class="pc-toggle" id="term" role="group" aria-label="Loan term">
          <button data-y="15">15 yr</button><button data-y="20">20 yr</button><button data-y="30" class="pc-on">30 yr</button>
        </div>
      </div>

      <div class="pc-field">
        <div class="pc-row">
          <label for="tax">Property taxes / year</label>
          <span class="pc-badge pc-assume" id="tax-badge">assumption · 1.5% of price</span>
        </div>
        <div class="pc-money"><span>$</span><input type="text" id="tax" inputmode="numeric" aria-label="Annual property taxes"></div>
        <p class="pc-fine" id="tax-note"></p>
      </div>

      <div class="pc-field">
        <div class="pc-row">
          <label for="ins">Homeowners insurance / year</label>
          <span class="pc-badge pc-assume">assumption</span>
        </div>
        <div class="pc-money"><span>$</span><input type="text" id="ins" inputmode="numeric" aria-label="Annual homeowners insurance"></div>
      </div>
    </div>

    <div class="pc-card pc-results">
      <div class="pc-cap">Estimated monthly payment</div>
      <div class="pc-piti" role="status"><span id="piti-total"></span><small> /mo</small></div>
      <div class="pc-bar" id="piti-bar" aria-hidden="true"></div>
      <div class="pc-leg" id="piti-leg"></div>
      <div class="pc-kv" id="loan-kv"></div>
    </div>
  </div>`;
  }

  function bodyAfford(D) {
    return `
  <p class="pc-sub">Lenders typically want housing costs under about 28% of gross income. Set the threshold,
    and the payment above is translated into the <strong>household income it requires</strong> — placed against
    what North Lawndale renters and recent homebuyers actually earn.</p>

  <div class="pc-ratio-row">
    <span class="pc-rlab">Housing share of income</span>
    <input type="range" id="ratio" min="20" max="45" step="1" aria-label="Housing share of income">
    <span class="pc-val" id="ratio-val"></span>
    <span class="pc-badge pc-assume">assumption</span>
  </div>

  <p class="pc-need" id="need-line"></p>

  <svg class="pc-ladder" id="ladder" viewBox="0 0 760 178" role="img" aria-label="Income needed compared with North Lawndale and Chicago renter and homebuyer median incomes"></svg>

  <div class="pc-profiles" id="profiles"></div>

  <div class="pc-dist" id="bracket-dist">
    <p class="pc-sub" style="margin-top:26px"><strong>Where the required income lands.</strong> Share of North Lawndale's
      ${D.households2024.total.toLocaleString()} households by income bracket (2024):</p>
    <div class="pc-bar" id="bracket-bar"></div>
    <div class="pc-leg" id="bracket-leg"></div>
    <p class="pc-marker-note" id="bracket-note"></p>
  </div>`;
  }

  function bodyBuyers() {
    return `
  <p class="pc-sub" id="buyers-intro"></p>

  <div class="pc-dist">
    <p class="pc-sub" style="margin-top:18px"><strong>Home-purchase borrowers by income category</strong> (HMDA, 2023–24 combined):</p>
    <div class="pc-bar" id="hmda-inc-bar"></div>
    <div class="pc-leg" id="hmda-inc-leg"></div>
  </div>

  <div class="pc-dist">
    <p class="pc-sub" style="margin-top:22px"><strong>Home-purchase borrowers by race / ethnicity</strong> (HMDA, 2023–24 combined):</p>
    <div class="pc-bar" id="hmda-race-bar"></div>
    <div class="pc-leg" id="hmda-race-leg"></div>
  </div>`;
  }

  function footPs(repoHref) {
    return [
      `<p id="pc-src"></p>`,
      `<p>Price tiers are anchored in what mortgage-financed buyers actually paid: the typical tier is the $325,000
       median property value across North Lawndale's 2024 HMDA home-purchase loans; the lower and higher tiers are
       placeholders at 75% and 125% of that median until true 25th and 75th percentile prices are calculated.
       Across all recorded 2024 sales — cash and financed — the single-family median was $200,000. Property taxes
       default to a 1.5%-of-price effective-rate estimate (a Civic Federation figure for the City of Chicago,
       adjustable). For context, the TY2024 median bill for current owners was $2,379 for single-family homes and
       $4,436 for 2–4 units — single-family bills jumped 73% from TY2023 — and a buyer's future bill can differ as
       Cook County assessments and exemptions change. In TY2023, 61% of North Lawndale single-family taxpayers
       claimed the homeowner exemption and 19% the senior exemption.</p>`,
      `<p>Interest rate, down payment, insurance, PMI (0.75%/yr of the loan when the down payment is under 20%),
       the 1.5% effective tax rate, and the income-share threshold are adjustable assumptions, not dataset values.
       Payment status uses standard cost-burden definitions: over 30% of income = cost-burdened, over 50% = severely burdened.
       Mortgage activity is from HMDA: first-lien, owner-occupied, 1-to-4-unit home purchase loans; borrower income
       categories (low / moderate / middle / upper) are as defined in the source data relative to area median income.
       Median homebuyer incomes come from the IHS baseline data presentation (slide 21, HMDA).</p>`,
      `<p>This tool is an educational illustration of neighborhood housing costs, not financial or lending advice.
       Full citations, formulas, and verification: <a href="${repoHref}" target="_blank" rel="noopener">data repository &amp; methods</a>.</p>`
    ];
  }

  /* ---- flat layout: standalone page (h2 section headers, foot block) ---- */
  function flatLayout(D, opts, stats, repoHref) {
    return `
  <div class="pc-stats" style="margin-bottom:6px">${stats}</div>
  ${opts.intro ? `<p class="pc-sub" style="margin-top:16px;max-width:820px">${opts.intro}</p>` : ''}

  <h2 class="pc-h2">The monthly payment</h2>
  ${bodyPayment(D, repoHref)}

  <h2 class="pc-h2">Who could afford that payment?</h2>
  ${bodyAfford(D)}

  <h2 class="pc-h2">Who is actually buying?</h2>
  ${bodyBuyers()}

  <div class="pc-foot">${footPs(repoHref).join('\n')}</div>`;
  }

  /* ---- carded layout: dashboard tab (chip-labeled cards, per-card sources,
     matching the dashboard's Chart-card convention) ---- */
  function cardedLayout(D, opts, stats, repoHref) {
    const chips = opts.cards;
    const jump = `<a class="pc-jump" href="#appendix-piti" data-jump="appendix-piti">Data Appendix ↗</a>`;
    const cards = [
      { title: 'The monthly payment', body: bodyPayment(D, repoHref),
        src: `Source: G.Mortgage_Lending (2024 mortgage-financed prices &amp; tiers) · B.Taxpayer_Characteristics (TY2024 tax bills) · effective tax rate: Civic Federation (assumption) · ${jump}` },
      { title: 'Who could afford that payment?', body: bodyAfford(D),
        src: `Source: A.Demographic_Socioeconomic (2024 ACS 5-year incomes, brackets &amp; tenure) · IHS presentation slide 21 (median homebuyer incomes, HMDA) · ${jump}` },
      { title: 'Who is actually buying?', body: bodyBuyers(),
        src: `Source: G.Mortgage_Lending (HMDA home-purchase loans, 2019–2024) · ${jump}` },
      { title: 'About these numbers', body: footPs(repoHref).join('\n'), src: null }
    ];
    return `
  <div class="pc-stats">${stats}</div>
  ${opts.heading ? `<h2 class="pc-tabhead">${opts.heading}</h2>` : ''}
  ${opts.intro ? `<p class="pc-sub" style="margin-top:2px;max-width:820px">${opts.intro}</p>` : ''}
  ${cards.map((c, i) => `
  <div class="pc-cardbox" id="pc-card-${i + 1}">
    <span class="pc-chiplabel">${chips[i] || ''}</span>
    <h3 class="pc-h3">${c.title}</h3>
    ${c.body}
    ${c.src ? `<p class="pc-cardsrc">${c.src}</p>` : ''}
  </div>`).join('')}`;
  }

  function render(mount, D, opts) {
    opts = opts || {};
    mount.classList.add('pc-root');
    if (opts.embedded) mount.classList.add('pc-embedded');
    mount.innerHTML = template(D, opts);

    const $ = id => mount.querySelector('#' + id);
    const TAX_RATE = D.effectiveTaxRate.rate;            // 1.5% of price, assumption
    const effTax = () => TAX_RATE * S.price;

    // ---------- state ----------
    const S = {
      price: D.priceTiers2024.typical,
      downPct: 5,
      ratePct: 6.5,
      years: 30,
      taxMode: 'rate',            // 'rate' = 1.5% of price (live), 'custom' = user-entered $
      taxAnnual: 0,               // set below
      insAnnual: INS_DEFAULT,
      ratio: 28
    };
    S.taxAnnual = effTax();

    // ---------- price-tier chips ----------
    const chipBox = $('tier-chips');
    chipBox.innerHTML = TIERS.map(t => `
      <button class="pc-chip" data-t="${t.key}" aria-pressed="false" aria-label="${t.label}: ${fmtK(D.priceTiers2024[t.key])}, ${t.badge}">
        <span class="pc-sw" style="background:${t.color}"></span>
        <span>${t.label}
          <span class="pc-n">${fmtK(D.priceTiers2024[t.key])} · ${t.key === 'typical' ? '2024 median, financed' : t.badge.replace('placeholder · ', 'placeholder: ')}</span>
        </span>
      </button>`).join('');
    chipBox.addEventListener('click', e => {
      const b = e.target.closest('.pc-chip'); if (!b) return;
      S.price = D.priceTiers2024[b.dataset.t];
      if (S.taxMode === 'rate') S.taxAnnual = effTax();
      syncInputs(); recalc();
    });

    // ---------- inputs ----------
    const priceEl = $('price'), downEl = $('down'), rateEl = $('rate'),
          taxEl = $('tax'), insEl = $('ins'), ratioEl = $('ratio');

    function paintSlider(el, min, max, v) {
      const p = ((v - min) / (max - min)) * 100;
      el.style.setProperty('--pc-sl', `linear-gradient(to right, #33518A ${p}%, var(--pc-track) ${p}%)`);
    }
    /* badges + chip highlight + notes: safe to call while typing (does not
       rewrite the money fields) */
    function syncBadges() {
      const tier = TIERS.find(t => D.priceTiers2024[t.key] === S.price);
      chipBox.querySelectorAll('.pc-chip').forEach(c => {
        const on = !!tier && c.dataset.t === tier.key;
        c.classList.toggle('pc-on', on); c.setAttribute('aria-pressed', on);
      });
      const pb = $('price-badge');
      pb.className = tier && tier.key === 'typical' ? 'pc-badge pc-data' : 'pc-badge pc-assume';
      pb.textContent = tier ? tier.badge : 'custom';

      const tb = $('tax-badge');
      if (S.taxMode === 'rate') {
        tb.className = 'pc-badge pc-assume';
        tb.textContent = 'assumption · 1.5% of price';
        $('tax-note').innerHTML = `Estimated at a ${fmtPct(TAX_RATE, 1)} effective tax rate on the purchase price
          (Civic Federation estimate for Chicago). TY2024 median bill for current single-family owners: ${fmt$(D.taxBillsTY2024.sf)}.`;
      } else {
        tb.className = 'pc-badge pc-assume';
        tb.textContent = 'edited · custom amount';
        $('tax-note').innerHTML = `Custom amount. <button type="button" class="pc-linkbtn" id="tax-reset">Reset to the
          ${fmtPct(TAX_RATE, 1)} estimate (${fmt$(effTax())})</button>`;
      }
    }
    function syncInputs() {
      priceEl.value = Math.min(S.price, 800000);
      downEl.value = S.downPct; rateEl.value = S.ratePct; ratioEl.value = S.ratio;
      taxEl.value = Math.round(S.taxAnnual).toLocaleString('en-US');
      insEl.value = Math.round(S.insAnnual).toLocaleString('en-US');
      syncBadges();
    }

    priceEl.addEventListener('input', () => {
      S.price = +priceEl.value;
      if (S.taxMode === 'rate') S.taxAnnual = effTax();
      syncInputs(); recalc();
    });
    downEl.addEventListener('input', () => { S.downPct = +downEl.value; syncInputs(); recalc(); });
    rateEl.addEventListener('input', () => { S.ratePct = +rateEl.value; syncInputs(); recalc(); });
    ratioEl.addEventListener('input', () => { S.ratio = +ratioEl.value; syncInputs(); recalc(); });
    const parseMoney = s => Math.max(0, parseInt(String(s).replace(/[^0-9]/g, ''), 10) || 0);
    taxEl.addEventListener('input', () => {
      S.taxAnnual = parseMoney(taxEl.value);
      S.taxMode = S.taxAnnual === Math.round(effTax()) ? 'rate' : 'custom';
      if (S.taxMode === 'rate') S.taxAnnual = effTax();
      syncBadges(); recalc();
    });
    taxEl.addEventListener('change', () => { syncInputs(); recalc(); });
    insEl.addEventListener('input', () => { S.insAnnual = parseMoney(insEl.value); recalc(); });
    insEl.addEventListener('change', () => { syncInputs(); recalc(); });
    /* reset link lives inside tax-note (rebuilt on every sync) — delegate */
    mount.addEventListener('click', e => {
      if (e.target.closest('#tax-reset')) {
        S.taxMode = 'rate'; S.taxAnnual = effTax();
        syncInputs(); recalc();
      }
    });

    $('preset-sf').addEventListener('click', () => {
      S.price = D.salePrices2024.sf;
      if (S.taxMode === 'rate') S.taxAnnual = effTax();
      syncInputs(); recalc();
    });
    $('preset-u24').addEventListener('click', () => {
      S.price = D.salePrices2024.u24;
      if (S.taxMode === 'rate') S.taxAnnual = effTax();
      syncInputs(); recalc();
    });

    $('term').addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      S.years = +b.dataset.y;
      $('term').querySelectorAll('button').forEach(x => x.classList.toggle('pc-on', x === b));
      recalc();
    });

    // ---------- math ----------
    const pniFactor = (r, n) => r === 0 ? 1 / n : r * Math.pow(1 + r, n) / (Math.pow(1 + r, n) - 1);
    function compute() {
      const d = S.downPct / 100, loan = S.price * (1 - d);
      const r = S.ratePct / 100 / 12, n = S.years * 12;
      const pi = loan * pniFactor(r, n);
      const tax = S.taxAnnual / 12, ins = S.insAnnual / 12;
      const pmi = d < 0.2 ? loan * (PMI_RATE / 100) / 12 : 0;
      return { loan, down$: S.price - loan, pi, tax, ins, pmi, piti: pi + tax + ins + pmi };
    }
    /* max affordable price at the income-share threshold. In rate mode taxes
       scale with the candidate price (1.5%/yr), so the rate joins the per-$
       cost; in custom mode the fixed dollar bill is subtracted from budget. */
    function maxPrice(income, c) {
      const d = S.downPct / 100, r = S.ratePct / 100 / 12, n = S.years * 12;
      const rateMode = S.taxMode === 'rate';
      const budget = income / 12 * (S.ratio / 100) - c.ins - (rateMode ? 0 : c.tax);
      if (budget <= 0) return 0;
      const per$ = (1 - d) * (pniFactor(r, n) + (d < 0.2 ? PMI_RATE / 100 / 12 : 0))
                 + (rateMode ? TAX_RATE / 12 : 0);
      return budget / per$;
    }

    // ---------- render: payment card ----------
    const SEGS = [
      ['pi',  'Principal & interest', '#33518A'],
      ['tax', 'Property taxes',       '#5578AE'],
      ['ins', 'Insurance',            '#91AAD4'],
      ['pmi', 'Mortgage ins. (PMI)',  '#8A9297']
    ];
    function renderPayment(c) {
      $('piti-total').textContent = fmt$(c.piti);
      $('piti-bar').innerHTML = SEGS.filter(([k]) => c[k] > 0.5)
        .map(([k, , col]) => `<div style="flex:${c[k]};background:${col}"></div>`).join('');
      $('piti-leg').innerHTML = SEGS.filter(([k]) => k !== 'pmi' || c.pmi > 0.5)
        .map(([k, nm, col]) => `<div class="pc-lr"><span class="pc-sw" style="background:${col}"></span>
          <span class="pc-nm">${nm}</span><span class="pc-amt">${fmt$(c[k])}</span></div>`).join('');
      $('loan-kv').innerHTML = [
        ['Loan amount', fmt$(c.loan)],
        ['Down payment', `${fmt$(c.down$)} (${S.downPct}%)`],
        ['Income needed at ' + S.ratio + '%', fmt$(c.piti * 12 / (S.ratio / 100)) + ' /yr']
      ].map(([l, v]) => `<div class="pc-lr">${l}<span class="pc-amt">${v}</span></div>`).join('');
      $('pmi-note').textContent = S.downPct < 20
        ? `Below 20% down: private mortgage insurance is added at ${PMI_RATE}%/yr of the loan (assumption).`
        : 'At 20% down or more, no PMI is applied.';
      $('down-val').textContent = S.downPct + '%';
      $('price-val').textContent = fmt$(S.price);
      $('rate-val').textContent = S.ratePct.toFixed(3).replace(/0+$/, '').replace(/\.$/, '') + '%';
      $('ratio-val').textContent = S.ratio + '%';
      paintSlider(priceEl, 25000, 800000, Math.min(S.price, 800000));
      paintSlider(downEl, 0, 50, S.downPct);
      paintSlider(rateEl, 3, 10, S.ratePct);
      paintSlider(ratioEl, 20, 45, S.ratio);
    }

    // ---------- render: affordability ----------
    /* benchmarks (July 2026 feedback): renter vs homebuyer medians for North
       Lawndale and Chicago, ascending. Homebuyer medians: IHS presentation
       slide 21 (HMDA); renter medians: workbook A!I83 / A!I88. */
    const PROFILES = [
      { inc: D.incomes2024.nlRenter,          who: 'Median NL renter household',      short: 'NL renter',         note: '73% of NL households rent' },
      { inc: D.incomes2024.chicagoRenter,     who: 'Median Chicago renter household', short: 'Chicago renter',    note: 'citywide renter benchmark' },
      { inc: D.homebuyerIncomes2024.nl,       who: 'Median NL homebuyer',             short: 'NL homebuyer',      note: `HMDA · ${D.hmda.loans2024} NL purchases in 2024` },
      { inc: D.homebuyerIncomes2024.chicago,  who: 'Median Chicago homebuyer',        short: 'Chicago homebuyer', note: 'citywide homebuyer benchmark' }
    ];
    function renderAfford(c) {
      const needed = c.piti * 12 / (S.ratio / 100);
      $('need-line').innerHTML = `This payment takes a household income of about <b>${fmt$(needed)} a year</b>
        to stay under ${S.ratio}% of income — in a neighborhood where the median renter household earns
        ${fmt$(D.incomes2024.nlRenter)} and the median 2024 homebuyer earned ${fmt$(D.homebuyerIncomes2024.nl)}.`;

      // ladder
      const L = 14, R = 746, AXY = 96, MAX = 150000;
      const x = v => L + Math.min(v, MAX) / MAX * (R - L);
      const over = needed > MAX;
      const nx = x(needed);
      let t = `<line class="pc-ax" x1="${L}" y1="${AXY}" x2="${R}" y2="${AXY}"/>`;
      for (let v = 0; v <= MAX; v += 25000)
        t += `<line class="pc-ax" x1="${x(v)}" y1="${AXY - 3}" x2="${x(v)}" y2="${AXY + 3}"/>
              <text class="pc-tick-lab" x="${x(v)}" y="${AXY + 16}" text-anchor="middle">${v === 0 ? '$0' : '$' + v / 1000 + 'K'}</text>`;
      PROFILES.forEach((p, i) => {
        const v = p.inc, px = x(v);
        const y2 = AXY + 38 + (i % 2) * 27;
        t += `<line x1="${px}" y1="${AXY}" x2="${px}" y2="${y2 - 20}" stroke="#8A9297" stroke-width="1"/>
              <circle cx="${px}" cy="${AXY}" r="4" fill="#5578AE" stroke="#FFF" stroke-width="1.5"/>
              <text x="${px}" y="${y2 - 8}" text-anchor="middle" font-size="11" fill="#44474E" font-weight="500">${p.short}</text>
              <text x="${px}" y="${y2 + 5}" text-anchor="middle" font-size="10.5" fill="#74777F">${fmtK(v)}</text>`;
      });
      t += `<line x1="${nx}" y1="${AXY}" x2="${nx}" y2="34" stroke="#BA1A1A" stroke-width="2"/>
            <path d="M ${nx - 5} 28 L ${nx + 5} 28 L ${nx} 36 Z" fill="#BA1A1A"/>
            <text x="${Math.min(Math.max(nx, 78), R - 84)}" y="20" text-anchor="middle" font-size="12" font-weight="700" fill="#BA1A1A">income needed ${over ? '≥ $150K →' : fmtK(needed)}</text>
            <circle cx="${nx}" cy="${AXY}" r="4.5" fill="#BA1A1A" stroke="#FFF" stroke-width="1.5"/>`;
      $('ladder').innerHTML = t;

      // profile rows: burden %, max price, gap to this scenario's price, pill
      $('profiles').innerHTML = PROFILES.map(p => {
        const inc = p.inc;
        const burden = c.piti / (inc / 12);
        const cls = burden <= 0.30 ? 'pc-ok' : burden <= 0.50 ? 'pc-warn' : 'pc-bad';
        const lab = burden <= 0.30 ? 'Affordable' : burden <= 0.50 ? 'Cost-burdened' : 'Severely burdened';
        const mp = maxPrice(inc, c);
        const gap = mp - S.price;
        return `<div class="pc-profile">
          <div class="pc-who">${p.who}<small>${fmt$(inc)} /yr · ${p.note}</small></div>
          <div class="pc-m"><b>${fmtPct(burden)}</b>of income on this payment</div>
          <div class="pc-m"><b>${mp > 1000 ? fmtK(mp) : '—'}</b>max price at ${S.ratio}%</div>
          <div class="pc-m"><b class="${gap >= 0 ? 'pc-gpos' : 'pc-gneg'}">${gap >= 0 ? '+' : '−'}${fmtK(Math.abs(gap))}</b>gap vs. this price</div>
          <span class="pc-pill ${cls}">${lab}</span>
        </div>`;
      }).join('');

      // bracket bar
      const br = D.households2024.incomeBrackets;
      const floors = [0, 25000, 50000, 100000];
      const bi = floors.findIndex((f, i) => needed >= f && (i === 3 || needed < floors[i + 1]));
      $('bracket-bar').innerHTML = br.map((b, i) => `
        <div style="flex:${b.share};background:${RAMP4[i]}">
          <span class="pc-pct${i < 2 ? ' pc-dk' : ''}">${b.share >= 0.08 ? fmtPct(b.share) : ''}</span>
          ${i === bi ? `<span style="position:absolute;left:0;top:-6px;bottom:-6px;width:2.5px;background:#BA1A1A"></span>` : ''}
        </div>`).join('');
      $('bracket-leg').innerHTML = br.map((b, i) => `<div class="pc-lr">
        <span class="pc-sw" style="background:${RAMP4[i]}"></span><span class="pc-nm">${b.label}</span>
        <b>&nbsp;${fmtPct(b.share)}</b></div>`).join('');
      const floorLab = bi === 0 ? 'every income bracket' : `the ${br[bi].label} bracket`;
      $('bracket-note').innerHTML = `The required income (<b>${fmt$(needed)}</b>) falls in ${floorLab}.
        Households earning ${bi === 0 ? 'any amount' : fmtK(floors[bi]) + ' or more'} — the brackets that could plausibly reach it —
        make up <b>${fmtPct(br.slice(bi).reduce((s, b) => s + b.share, 0))}</b> of North Lawndale's ${D.households2024.total.toLocaleString()} households.`;
    }

    // ---------- render: who buys (static) ----------
    function renderBuyers() {
      const h = D.hmda;
      $('buyers-intro').innerHTML = `In 2024, <strong>${h.loans2024} households</strong> bought a North Lawndale home
        (1–4 units) with a mortgage, at a median property value of <strong>${fmt$(h.medianValue2024)}</strong> —
        up from ${fmt$(h.medianValue2019)} in 2019. The median North Lawndale homebuyer earned
        <strong>${fmt$(D.homebuyerIncomes2024.nl)}</strong> in 2024, up from ${fmt$(D.homebuyerIncomes2024.nl2019)}
        in 2019. Upper-income buyers grew from ${fmtPct(h.incomeMix2019Upper)}
        of borrowers in 2019 to ${fmtPct(h.incomeMix2324[3].share)} in 2023–24, and buying remains almost evenly
        split between African American and Hispanic homebuyers.`;
      const isLight = col => col === '#D3DCEF' || col === '#A8BCE0' || col === '#C4C6D0' || col === '#91AAD4';
      const bar = (rows, colors) => rows.map((r, i) => `
        <div style="flex:${Math.max(r.share, 0.001)};background:${colors[i]}">
          <span class="pc-pct${isLight(colors[i]) ? ' pc-dk' : ''}">${r.share >= 0.09 ? fmtPct(r.share) : ''}</span>
        </div>`).join('');
      const leg = (rows, colors) => rows.map((r, i) => `<div class="pc-lr">
        <span class="pc-sw" style="background:${colors[i]}"></span><span class="pc-nm">${r.label}</span>
        <b>&nbsp;${fmtPct(r.share)}</b><span class="pc-nm">&nbsp;(${r.count})</span></div>`).join('');
      $('hmda-inc-bar').innerHTML = bar(h.incomeMix2324, RAMP4);
      $('hmda-inc-leg').innerHTML = leg(h.incomeMix2324, RAMP4);
      $('hmda-race-bar').innerHTML = bar(h.raceMix2324, RACE5);
      $('hmda-race-leg').innerHTML = leg(h.raceMix2324, RACE5);
    }

    // ---------- footnote sources ----------
    $('pc-src').textContent = 'Source: Chicago Community Areas 2026 SFF Indicators (July 2026) — ' +
      'G.Mortgage_Lending (HMDA home-purchase loans, mortgage-financed price tiers, borrower income & race/ethnicity, 2019–2024); ' +
      'B.Taxpayer_Characteristics (median tax bills TY2024, exemptions); ' +
      'A.Demographic_Socioeconomic (household & renter incomes, income composition & tenure, 2024 ACS 5-yr); ' +
      'E.Property_Sales (all-sales median prices & counts, 2024). ' +
      'Median homebuyer incomes: IHS baseline data presentation, slide 21 (HMDA). ' +
      'Underlying data: Institute for Housing Studies at DePaul University.';

    // ---------- main loop ----------
    function recalc() { const c = compute(); renderPayment(c); renderAfford(c); }
    syncInputs(); renderBuyers(); recalc();
  }

  window.PITI = { render };
})();
