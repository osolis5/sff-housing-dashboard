/* PITI calculator — shared component. Renders the full calculator into a
   mount node: window.PITI.render(mount, data, { embedded, dashboard }).
   Used by the standalone page (PITI-Calculator/index.html, dashboard: true —
   three-panel Housing | results | People layout) and by the dashboard's
   "PITI Calculator" tab (cards: [...], no iframe). Classes are pc-prefixed to
   coexist with host styles; ids are unique per page (one instance max). */
(function () {
  'use strict';

  /* price tiers replace the former property-type chips (July 2026 feedback):
     anchored in mortgage-financed purchases, not all-sales medians by type.
     lower/higher are workbook placeholders (75% / 125% of the median) until
     true 25th/75th percentile prices are calculated. `seg` is the short label
     used by the dashboard layout's segmented control. */
  const TIERS = [
    { key: 'lower',   label: 'Lower cost',  seg: 'Low',     badge: 'placeholder · 75% of median',  color: '#91AAD4' },
    { key: 'typical', label: 'Typical',     seg: 'Typical', badge: 'dataset · 2024 median',        color: '#33518A' },
    { key: 'higher',  label: 'Higher cost', seg: 'High',    badge: 'placeholder · 125% of median', color: '#5578AE' }
  ];
  /* segmented-control order (dashboard layout): default tier first */
  const SEG_ORDER = ['typical', 'lower', 'higher'];
  /* income-bracket ramp: ends stretched (2026-08-19) so adjacent steps read
     apart at a glance — near-white tint → mid-light → navy → deep navy */
  const RAMP4 = ['#E2E9F8', '#91AAD4', '#5578AE', '#1E3567'];
  const RACE5 = ['#33518A', '#5578AE', '#91AAD4', '#A8BCE0', '#C4C6D0'];
  const PMI_RATE = 0.75;          // % of loan per year, assumption
  const INS_DEFAULT = 1700;       // $/yr, assumption

  const fmt$ = n => '$' + Math.round(n).toLocaleString('en-US');
  const fmtK = n => n >= 1000 ? '$' + Math.round(n / 1000) + 'K' : fmt$(n);
  const fmtPct = (n, d = 1) => (n * 100).toFixed(d).replace(/\.0$/, '') + '%';

  function template(D, opts) {
    const carded = Array.isArray(opts.cards);
    const statData = [
      [fmt$(D.priceTiers2024.typical), '2024 median sales price, North Lawndale, 1–4 unit owner occupied property purchased with mortgage'],
      [fmt$(D.taxBillsTY2024.sf), 'TY2024 median tax bill, single family'],
      [D.hmda.loans2024, 'home-purchase loans, 2024'],
      [fmt$(D.homebuyerIncomes2024.nl), 'median North Lawndale homebuyer income, 2024']
    ];
    /* carded mode mirrors the dashboard KPI cards (label above value); the
       legacy flat mode keeps the value-first stat tiles. The dashboard layout
       carries no stat strip (KPI cards removed 2026-08-19, user request). */
    const stats = carded
      ? statData.map(([v, l]) => `<div class="pc-stat"><p class="pc-kpi-label">${l}</p><p class="pc-kpi-value">${v}</p></div>`).join('')
      : statData.map(([v, l]) => `<div class="pc-stat"><div class="pc-v">${v}</div><div class="pc-l">${l}</div></div>`).join('');

    const repoHref = (opts.repoBase || '') + 'data.html';
    if (carded) return cardedLayout(D, opts, stats, repoHref);
    if (opts.dashboard) return dashLayout(D, opts, stats, repoHref);
    return flatLayout(D, opts, stats, repoHref);
  }

  /* ---- shared control/section fragments (identical ids in every layout) ---- */
  /* seg: wrap the tier chips as a labeled segmented control (dashboard rail) */
  function inputsInner(D, seg) {
    return `
      ${seg
        ? `<div class="pc-field pc-field-first">
        <div class="pc-row"><label>Housing cost</label></div>
        <div class="pc-chips pc-seg" id="tier-chips" role="group" aria-label="Price tier"></div>
      </div>`
        : `<div class="pc-chips" id="tier-chips" role="group" aria-label="Price tier"></div>`}

      <div class="pc-field">
        <div class="pc-row">
          <label for="price">Purchase price</label>
          <span class="pc-badge pc-data" id="price-badge">dataset · 2024 median</span>
          <span class="pc-val" id="price-val"></span>
        </div>
        <input type="range" id="price" min="25000" max="800000" step="1250" aria-label="Purchase price">
      </div>

      <div class="pc-field">
        <div class="pc-row">
          <label for="down">Down payment</label>          <span class="pc-val" id="down-val"></span>
        </div>
        <input type="range" id="down" min="0" max="50" step="0.5" aria-label="Down payment percent">
      </div>

      <div class="pc-field">
        <div class="pc-row">
          <label for="rate">Interest rate (30-yr fixed style APR)</label>          <span class="pc-val" id="rate-val"></span>
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
          <span class="pc-badge pc-assume" id="tax-badge"></span>
        </div>
        <div class="pc-money"><span>$</span><input type="text" id="tax" inputmode="numeric" aria-label="Annual property taxes"></div>
        <p class="pc-fine" id="tax-note"></p>
      </div>

      <div class="pc-field">
        <div class="pc-row">
          <label for="ins">Homeowners insurance / year</label>        </div>
        <div class="pc-money"><span>$</span><input type="text" id="ins" inputmode="numeric" aria-label="Annual homeowners insurance"></div>
      </div>`;
  }

  function resultsInner() {
    return `
      <div class="pc-cap">Estimated monthly payment</div>
      <div class="pc-piti" role="status"><span id="piti-total"></span><small> /mo</small></div>
      <div class="pc-bar" id="piti-bar" aria-hidden="true"></div>
      <div class="pc-leg" id="piti-leg"></div>
      <div class="pc-kv" id="loan-kv"></div>`;
  }

  function ratioInline() {
    return `
  <div class="pc-ratio-row">
    <span class="pc-rlab">Housing share of income</span>
    <input type="range" id="ratio" min="20" max="45" step="1" aria-label="Housing share of income">
    <span class="pc-val" id="ratio-val"></span>
    <span class="pc-badge pc-assume">assumption</span>
  </div>`;
  }

  function needLadder() {
    return `
  <p class="pc-need" id="need-line"></p>

  <svg class="pc-ladder" id="ladder" viewBox="0 0 760 178" role="img" aria-label="Income needed compared with North Lawndale and Chicago renter and homebuyer median incomes"></svg>`;
  }

  function profilesBox() {
    return `<div class="pc-profiles" id="profiles"></div>`;
  }

  /* lead=true keeps the flat/carded bold lead-in + explainer paragraph; the
     dashboard card shows just the chart under its caption (explainer removed
     2026-08-19, user request) */
  function gapBox(lead) {
    return `
  <div class="pc-dist" id="gap-viz">
    ${lead ? `<p class="pc-sub" style="margin-top:26px"><strong>The affordability gap, drawn to scale.</strong> Each dot is
      the most that household could afford at the income share set above; the red line is this home's price. The
      bar between them is the gap — <span class="pc-gleg-neg">shortfall</span> or
      <span class="pc-gleg-pos">headroom</span> — and it moves with every control above.</p>` : ''}
    <svg class="pc-ladder" id="gapchart" viewBox="0 0 760 204" role="img"
      aria-label="Gap between what each benchmark household could afford and this home's price"></svg>
  </div>`;
  }

  /* lead=true keeps the flat/carded lead-in + share line; the dashboard card
     carries the share line as its caption instead (2026-08-19) */
  function bracketBox(D, lead) {
    return `
  <div class="pc-dist" id="bracket-dist">
    ${lead ? `<p class="pc-sub" style="margin-top:26px"><strong>Where the required income lands.</strong> Share of North Lawndale's
      ${D.households2024.total.toLocaleString()} households by income bracket (2024):</p>` : ''}
    <div class="pc-bar" id="bracket-bar"></div>
    <div class="pc-leg" id="bracket-leg"></div>
    <p class="pc-marker-note" id="bracket-note"></p>
  </div>`;
  }

  function bodyPayment(D, repoHref) {
    return `
  <p class="pc-sub">Choose a price tier based on what mortgage-financed buyers actually paid for North Lawndale
    homes in 2024. Use the slider to adjust the loan to match a buyer's PITI variables. Values marked
    <span class="pc-badge pc-data">dataset</span> come straight from the SFF indicator tables; values marked
    <span class="pc-badge pc-assume">assumption</span> are adjustable estimates. Data sets are referenced in the
    <a href="${repoHref}" target="_blank" rel="noopener">Data Appendix</a>.</p>

  <div class="pc-calc">
    <div class="pc-card pc-inputs">${inputsInner(D, false)}
    </div>

    <div class="pc-card pc-results">${resultsInner()}
    </div>
  </div>`;
  }

  function bodyAfford(D) {
    return `
  <p class="pc-sub">Lenders typically want housing costs under about 28% of gross income. Set the threshold,
    and the payment above is translated into the <strong>household income it requires</strong> — placed against
    what North Lawndale renters and recent homebuyers actually earn.</p>
  ${ratioInline()}
  ${needLadder()}

  ${profilesBox()}

  ${gapBox(true)}

  ${bracketBox(D, true)}`;
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

  /* dash: the dashboard layout's People panel gets a benchmark-income note */
  function footPs(repoHref, dash) {
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
       ${dash ? `The four benchmark incomes in the People panel default to dataset values and are adjustable
       for what-if scenarios. ` : ''}Payment status uses standard cost-burden definitions: over 30% of income = cost-burdened, over 50% = severely burdened.
       Mortgage activity is from HMDA: first-lien, owner-occupied, 1-to-4-unit home purchase loans; borrower income
       categories (low / moderate / middle / upper) are as defined in the source data relative to area median income.
       Median homebuyer incomes come from the IHS baseline data presentation (slide 21, HMDA).</p>`,
      `<p>This tool is an educational illustration of neighborhood housing costs, not financial or lending advice.
       Full citations, formulas, and verification: <a href="${repoHref}" target="_blank" rel="noopener">data repository &amp; methods</a>.</p>`
    ];
  }

  /* ---- flat layout: legacy standalone page (h2 section headers, foot block) ---- */
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

  /* ---- dashboard layout: standalone Gap Analysis page ----
     Three panels (per the Figma dashboard mock): a "Housing" input rail on the
     left, the results canvas in the center, and a "People" rail on the right
     holding the benchmark-income inputs and the income-share threshold. */
  function dashLayout(D, opts, stats, repoHref) {
    return `
  <div class="pc-dash">
    <aside class="pc-rail pc-rail-housing" aria-label="Housing inputs">
      <h2 class="pc-railtitle">Housing</h2>
      ${inputsInner(D, true)}
      <button type="button" class="pc-reset" id="pc-reset">Reset</button>
    </aside>

    <div class="pc-canvas">
      <div class="pc-card pc-results">${resultsInner()}
      </div>

      <div class="pc-card pc-panel">
        <div class="pc-cap">Who could afford that payment?</div>
        ${needLadder()}
      </div>

      <div class="pc-card pc-panel">
        <div class="pc-cap">The affordability gap</div>
        ${gapBox(false)}
      </div>

      <div class="pc-card pc-panel">
        <div class="pc-cap">Benchmark households</div>
        ${profilesBox()}
      </div>

      <div class="pc-card pc-panel">
        <div class="pc-cap">Share of North Lawndale's ${D.households2024.total.toLocaleString()} households by income bracket (2024)</div>
        ${bracketBox(D, false)}
      </div>

      <div class="pc-card pc-panel">
        <div class="pc-cap">Who is actually buying?</div>
        ${bodyBuyers()}
      </div>

      <div class="pc-card pc-panel pc-about">
        <div class="pc-cap">About these numbers</div>
        ${footPs(repoHref, true).join('\n')}
      </div>
    </div>

    <aside class="pc-rail pc-rail-people" aria-label="People inputs">
      <h2 class="pc-railtitle">People</h2>

      <div class="pc-field pc-field-first">
        <div class="pc-row">
          <label for="inc-renter">Median NL renter income</label>
          <span class="pc-badge pc-data" id="inc-renter-badge">dataset · 2024</span>
        </div>
        <div class="pc-money"><span>$</span><input type="text" id="inc-renter" inputmode="numeric" aria-label="Median North Lawndale renter household income"></div>
        <p class="pc-fine" id="inc-renter-note"></p>
      </div>

      <div class="pc-field">
        <div class="pc-row">
          <label for="inc-chi-renter">Median Chicago renter income</label>
          <span class="pc-badge pc-data" id="inc-chi-renter-badge">dataset · 2024</span>
        </div>
        <div class="pc-money"><span>$</span><input type="text" id="inc-chi-renter" inputmode="numeric" aria-label="Median Chicago renter household income"></div>
        <p class="pc-fine" id="inc-chi-renter-note"></p>
      </div>

      <div class="pc-field">
        <div class="pc-row">
          <label for="inc-buyer">Median NL homebuyer income</label>
          <span class="pc-badge pc-data" id="inc-buyer-badge">dataset · 2024</span>
        </div>
        <div class="pc-money"><span>$</span><input type="text" id="inc-buyer" inputmode="numeric" aria-label="Median North Lawndale homebuyer income"></div>
        <p class="pc-fine" id="inc-buyer-note"></p>
      </div>

      <div class="pc-field">
        <div class="pc-row">
          <label for="inc-chi-buyer">Median Chicago homebuyer income</label>
          <span class="pc-badge pc-data" id="inc-chi-buyer-badge">dataset · 2024</span>
        </div>
        <div class="pc-money"><span>$</span><input type="text" id="inc-chi-buyer" inputmode="numeric" aria-label="Median Chicago homebuyer income"></div>
        <p class="pc-fine" id="inc-chi-buyer-note"></p>
      </div>

      <div class="pc-field">
        <div class="pc-row"><label for="ratio">Housing share of income</label></div>
        <input type="range" id="ratio" min="20" max="45" step="1" aria-label="Housing share of income">
        <div class="pc-row pc-row-after">
          <span class="pc-val pc-val-left" id="ratio-val"></span>        </div>
      </div>
    </aside>
  </div>`;
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
    /* initState() doubles as the Reset button's target (dashboard rail) */
    const initState = () => ({
      price: D.priceTiers2024.typical,
      downPct: 5,
      ratePct: 6.5,
      years: 30,
      taxMode: 'rate',            // 'rate' = 1.5% of price (live), 'custom' = user-entered $
      taxAnnual: 0,               // set below
      insAnnual: INS_DEFAULT,
      ratio: 28,
      /* benchmark incomes: dataset defaults, editable in the dashboard
         layout's People rail (badges flag any custom value) */
      incRenter: D.incomes2024.nlRenter,
      incBuyer: D.homebuyerIncomes2024.nl,
      incChiRenter: D.incomes2024.chicagoRenter,
      incChiBuyer: D.homebuyerIncomes2024.chicago
    });
    const S = initState();
    S.taxAnnual = effTax();

    // ---------- price-tier chips ----------
    const chipBox = $('tier-chips');
    const seg = chipBox.classList.contains('pc-seg');
    const chipList = seg ? SEG_ORDER.map(k => TIERS.find(t => t.key === k)) : TIERS;
    chipBox.innerHTML = chipList.map(t => seg
      ? `<button class="pc-chip" data-t="${t.key}" aria-pressed="false" aria-label="${t.label}: ${fmtK(D.priceTiers2024[t.key])}, ${t.badge}">${t.seg}</button>`
      : `
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
    /* benchmark-income inputs exist only in the dashboard layout */
    const INCOMES = $('inc-renter') ? [
      { key: 'incRenter', def: D.incomes2024.nlRenter, el: $('inc-renter'),
        badge: $('inc-renter-badge'), note: $('inc-renter-note'), reset: 'inc-renter-reset' },
      { key: 'incChiRenter', def: D.incomes2024.chicagoRenter, el: $('inc-chi-renter'),
        badge: $('inc-chi-renter-badge'), note: $('inc-chi-renter-note'), reset: 'inc-chi-renter-reset' },
      { key: 'incBuyer', def: D.homebuyerIncomes2024.nl, el: $('inc-buyer'),
        badge: $('inc-buyer-badge'), note: $('inc-buyer-note'), reset: 'inc-buyer-reset' },
      { key: 'incChiBuyer', def: D.homebuyerIncomes2024.chicago, el: $('inc-chi-buyer'),
        badge: $('inc-chi-buyer-badge'), note: $('inc-chi-buyer-note'), reset: 'inc-chi-buyer-reset' }
    ] : null;

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
        /* assumption tags removed 2026-08-19 — the badge only flags edits */
        tb.className = 'pc-badge pc-assume';
        tb.textContent = '';
        $('tax-note').innerHTML = '';
      } else {
        tb.className = 'pc-badge pc-assume';
        tb.textContent = 'edited · custom amount';
        $('tax-note').innerHTML = `Custom amount. <button type="button" class="pc-linkbtn" id="tax-reset">Reset to the
          ${fmtPct(TAX_RATE, 1)} estimate (${fmt$(effTax())})</button>`;
      }
      syncIncomeMeta();
    }
    /* People-rail badges/notes: rail notes carry only the functional edited
       state (reset link) — explanatory captions removed 2026-08-19 */
    function syncIncomeMeta() {
      if (!INCOMES) return;
      INCOMES.forEach(m => {
        const edited = Math.round(S[m.key]) !== Math.round(m.def);
        m.badge.className = edited ? 'pc-badge pc-assume' : 'pc-badge pc-data';
        m.badge.textContent = edited ? 'edited · custom' : 'dataset · 2024';
        m.note.innerHTML = edited
          ? `Custom amount. <button type="button" class="pc-linkbtn" id="${m.reset}">Reset to the dataset value (${fmt$(m.def)})</button>`
          : '';
      });
    }
    function syncInputs() {
      priceEl.value = Math.min(S.price, 800000);
      downEl.value = S.downPct; rateEl.value = S.ratePct; ratioEl.value = S.ratio;
      taxEl.value = Math.round(S.taxAnnual).toLocaleString('en-US');
      insEl.value = Math.round(S.insAnnual).toLocaleString('en-US');
      if (INCOMES) INCOMES.forEach(m => { m.el.value = Math.round(S[m.key]).toLocaleString('en-US'); });
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
    if (INCOMES) INCOMES.forEach(m => {
      /* min 1 so an emptied field doesn't divide-by-zero the burden math */
      m.el.addEventListener('input', () => { S[m.key] = Math.max(1, parseMoney(m.el.value)); syncIncomeMeta(); recalc(); });
      m.el.addEventListener('change', () => { syncInputs(); recalc(); });
    });
    /* reset links live inside notes (rebuilt on every sync) — delegate */
    mount.addEventListener('click', e => {
      if (e.target.closest('#tax-reset')) {
        S.taxMode = 'rate'; S.taxAnnual = effTax();
        syncInputs(); recalc();
      }
      if (INCOMES) INCOMES.forEach(m => {
        if (e.target.closest('#' + m.reset)) { S[m.key] = m.def; syncInputs(); recalc(); }
      });
    });

    $('term').addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      S.years = +b.dataset.y;
      $('term').querySelectorAll('button').forEach(x => x.classList.toggle('pc-on', x === b));
      recalc();
    });

    /* Reset (dashboard rail): everything back to dataset defaults — Housing
       inputs, loan term, and the People-rail benchmark incomes */
    const resetBtn = $('pc-reset');
    if (resetBtn) resetBtn.addEventListener('click', () => {
      Object.assign(S, initState());
      S.taxAnnual = effTax();
      $('term').querySelectorAll('button').forEach(x => x.classList.toggle('pc-on', x.dataset.y === '30'));
      syncInputs(); recalc();
    });

    /* hover tooltips (bracket bar + benchmark-household rows): simple white
       box with a black outline, follows the cursor. Listeners sit on the
       persistent containers; children carry data-tip, rebuilt on recalc. */
    const tip = document.createElement('div');
    tip.className = 'pc-tip';
    mount.appendChild(tip);
    const tipMove = e => {
      const seg = e.target.closest('[data-tip]');
      if (!seg) { tip.style.display = 'none'; return; }
      tip.textContent = seg.dataset.tip;
      tip.style.display = 'block';
      tip.style.left = Math.min(e.clientX + 12, innerWidth - tip.offsetWidth - 8) + 'px';
      tip.style.top = Math.min(e.clientY + 12, innerHeight - tip.offsetHeight - 8) + 'px';
    };
    [$('bracket-bar'), $('profiles')].forEach(el => {
      el.addEventListener('mousemove', tipMove);
      el.addEventListener('mouseleave', () => { tip.style.display = 'none'; });
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
       slide 21 (HMDA); renter medians: workbook A!I83 / A!I88. The NL pair
       reads from state so the People rail can adjust it (dataset defaults). */
    const profiles = () => [
      { inc: S.incRenter,    who: 'Median NL renter household',      short: 'NL renter',         note: '73% of NL households rent' },
      { inc: S.incChiRenter, who: 'Median Chicago renter household', short: 'Chicago renter',    note: 'citywide renter benchmark' },
      { inc: S.incBuyer,     who: 'Median NL homebuyer',             short: 'NL homebuyer',      note: `HMDA · ${D.hmda.loans2024} NL purchases in 2024` },
      { inc: S.incChiBuyer,  who: 'Median Chicago homebuyer',        short: 'Chicago homebuyer', note: 'citywide homebuyer benchmark' }
    ];
    function renderAfford(c) {
      const PROFILES = profiles();
      const needed = c.piti * 12 / (S.ratio / 100);
      $('need-line').innerHTML = `This payment takes a household income of about <b>${fmt$(needed)} a year</b>
        to stay under ${S.ratio}% of income — in a neighborhood where the median renter household earns
        ${fmt$(S.incRenter)} and the median 2024 homebuyer earned ${fmt$(S.incBuyer)}.`;

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
      const rows = PROFILES.map(p => {
        const burden = c.piti / (p.inc / 12);
        const mp = maxPrice(p.inc, c);
        return { ...p, burden, mp, gap: mp - S.price };
      });
      /* the income/context line lives in the row's hover tooltip (2026-08-19) */
      $('profiles').innerHTML = rows.map(p => {
        const cls = p.burden <= 0.30 ? 'pc-ok' : p.burden <= 0.50 ? 'pc-warn' : 'pc-bad';
        const lab = p.burden <= 0.30 ? 'Affordable' : p.burden <= 0.50 ? 'Cost-burdened' : 'Severely burdened';
        return `<div class="pc-profile" data-tip="${fmt$(p.inc)} /yr · ${p.note}">
          <div class="pc-who">${p.who}</div>
          <div class="pc-m"><b>${fmtPct(p.burden)}</b>of income on this payment</div>
          <div class="pc-m"><b>${p.mp > 1000 ? fmtK(p.mp) : '—'}</b>max price at ${S.ratio}%</div>
          <div class="pc-m"><b class="${p.gap >= 0 ? 'pc-gpos' : 'pc-gneg'}">${p.gap >= 0 ? '+' : '−'}${fmtK(Math.abs(p.gap))}</b>gap vs. this price</div>
          <span class="pc-pill ${cls}">${lab}</span>
        </div>`;
      }).join('');

      // gap chart: one slider-style track per household in home-price space —
      // navy dot = max affordable price, red line = this home's price, the
      // filled span between them = the gap (green headroom / red shortfall)
      {
        const GL = 134, GR = 746, GY = 182, GMAX = 600000;
        const gx = v => GL + Math.min(v, GMAX) / GMAX * (GR - GL);
        const px = gx(S.price);
        let g = `<line class="pc-ax" x1="${GL}" y1="${GY}" x2="${GR}" y2="${GY}"/>`;
        for (let v = 0; v <= GMAX; v += 100000)
          g += `<line class="pc-ax" x1="${gx(v)}" y1="${GY - 3}" x2="${gx(v)}" y2="${GY + 3}"/>
                <text class="pc-tick-lab" x="${gx(v)}" y="${GY + 16}" text-anchor="middle">${v === 0 ? '$0' : '$' + v / 1000 + 'K'}</text>`;
        rows.forEach((p, i) => {
          const y = 52 + i * 34;
          const ax = gx(p.mp), over = p.mp > GMAX;
          const col = p.gap >= 0 ? '#146C2E' : '#BA1A1A';
          const mx = Math.min(Math.max((ax + px) / 2, GL + 26), GR - 26);
          g += `<text x="${GL - 12}" y="${y + 4}" text-anchor="end" font-size="11" fill="#44474E" font-weight="500">${p.short}</text>
                <line x1="${GL}" y1="${y}" x2="${GR}" y2="${y}" stroke="#E2E2E9" stroke-width="4.5" stroke-linecap="round"/>`;
          if (Math.abs(ax - px) > 2)
            g += `<line x1="${ax}" y1="${y}" x2="${px}" y2="${y}" stroke="${col}" stroke-width="4.5" stroke-linecap="round"/>`;
          g += `<text x="${mx}" y="${y - 9}" text-anchor="middle" font-size="11.5" font-weight="700" fill="${col}">${p.gap >= 0 ? '+' : '−'}${fmtK(Math.abs(p.gap))}</text>
                <circle cx="${ax}" cy="${y}" r="5.5" fill="#33518A" stroke="#FFF" stroke-width="1.5"/>
                ${over ? `<text x="${GR + 7}" y="${y + 4}" font-size="11" fill="#74777F">→</text>` : ''}`;
        });
        g += `<line x1="${px}" y1="30" x2="${px}" y2="${GY}" stroke="#BA1A1A" stroke-width="2"/>
              <path d="M ${px - 5} 24 L ${px + 5} 24 L ${px} 32 Z" fill="#BA1A1A"/>
              <text x="${Math.min(Math.max(px, GL + 62), GR - 66)}" y="16" text-anchor="middle" font-size="12" font-weight="700" fill="#BA1A1A">this home ${S.price > GMAX ? '≥ $600K →' : fmtK(S.price)}</text>`;
        $('gapchart').innerHTML = g;
      }

      // bracket bar
      const br = D.households2024.incomeBrackets;
      const floors = [0, 25000, 50000, 100000];
      const bi = floors.findIndex((f, i) => needed >= f && (i === 3 || needed < floors[i + 1]));
      $('bracket-bar').innerHTML = br.map((b, i) => `
        <div data-tip="${b.label} — ${fmtPct(b.share)} of households${i === bi ? ' · the required income falls in this bracket' : ''}" style="flex:${b.share};background:${RAMP4[i]}">
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
      const isLight = col => col === '#E2E9F8' || col === '#D3DCEF' || col === '#A8BCE0' || col === '#C4C6D0' || col === '#91AAD4';
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
