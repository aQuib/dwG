/*
 * designs w/ GOD, one-page site behavior (exported from design version D).
 * Plain browser JavaScript, no dependencies. Three parts:
 *   1. Golden-spiral scrollytelling in the #story section (camera, squares, spiral, chapter dots)
 *   2. Floating shapes (#depth-field) that drift toward the camera and respond to scroll
 *   3. "What changes for you" outcomes selector (#oc-list + detail panel)
 */
(function () {
  'use strict';

  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };
  var pad = function (n) { return (n < 10 ? '0' : '') + n; };

  /* ------------------------------------------------------------------
   * 1. Golden-spiral scrollytelling
   * ------------------------------------------------------------------ */
  // Fibonacci squares (x, y, size) in the mark's own units. Mirrored so the spiral grows LEFT.
  // The first two unit squares share the G's circle, so the spiral starts in the G.
  var SQ = [[226, 26, 44], [226, 70, 44], [270, 26, 88], [226, -106, 132], [6, -106, 220], [6, 114, 352], [358, -106, 572], [6, -1030, 924], [-1490, -1030, 1496]];
  var RADII = [44, 44, 88, 132, 220, 352, 572, 924, 1496];
  // Per chapter: squares shown (odd counts keep the golden rectangle horizontal) and spiral progress.
  var SHOW = [3, 5, 7, 9, 9];
  var SPIRAL = [3, 5, 7, 8, 9];
  // Camera: framing starts in the free area right of the text and widens toward the full page.
  var WIDEN = [0, 0.15, 0.45, 0.8, 1];
  var FRAME_H = [420, 470, 620, 780, 820];
  var STAGE_H = 860;
  var CAPTIONS = ['The seed: G', 'Unfolding', 'Listening', 'Structure', 'Harmony'];
  var LABELS = [
    'The dw/G mark on the right. A blue curve begins at the top of the G and follows its circle, framed by two unit squares.',
    'The camera pulls back as the curve grows leftward through larger squares: the Fibonacci sequence begins.',
    'The golden spiral widens to the left, behind the text, the mark now small on the right.',
    'Larger squares extend across the page; the spiral sweeps behind the story.',
    'The full golden rectangle spans the page width: one continuous curve growing from the G.'
  ];

  var state = { step: 0, started: false, prog: 0, W: 1440 };

  function stageValues(s) {
    var step = s.step, k = SHOW[step];
    var x0 = 14, y0 = 14, x1 = 326, y1 = 126; // dw/G mark bounds
    for (var i = 0; i < k; i++) {
      x0 = Math.min(x0, SQ[i][0]); y0 = Math.min(y0, SQ[i][1]);
      x1 = Math.max(x1, SQ[i][0] + SQ[i][2]); y1 = Math.max(y1, SQ[i][1] + SQ[i][2]);
    }
    var W = s.W;
    // Text column: 1360px container, 40px padding, steps column max 600px.
    var textRight = Math.max(0, (W - 1360) / 2) + 40 + Math.min(600, W - 80);
    var freeL = textRight + 40, freeR = W - 48, freeW = freeR - freeL;
    var roomy = freeW >= 260; // otherwise (tablet/phone) the drawing becomes a faint watermark
    var f = WIDEN[step];
    var cxFree = roomy ? (freeL + freeR) / 2 : W / 2, wFree = roomy ? freeW : W - 64;
    var Tcx = cxFree + (W / 2 - cxFree) * f, Tw = wFree + ((W - 80) - wFree) * f;
    var sc = Math.min(Tw / (x1 - x0), FRAME_H[step] / (y1 - y0));
    var tx = Tcx - sc * (x0 + x1) / 2;
    if (roomy) {
      // Letters stay right of the text; the whole drawing stays inside the 48px right margin.
      var fitMax = freeW / (x1 - 14);
      if (sc > fitMax) { sc = fitMax; tx = Tcx - sc * (x0 + x1) / 2; }
      tx = Math.min(Math.max(tx, freeL - 14 * sc), freeR - x1 * sc);
    }
    var ty = STAGE_H / 2 - sc * (y0 + y1) / 2;
    var total = 0, done = 0;
    RADII.forEach(function (r, j) { total += r; if (j < SPIRAL[step]) done += r; });
    var squares = SQ.map(function (_, q) { return (s.started && q < k) ? 1 : 0; });
    if (step === 4) squares[8] = 0; // final chapter: outer square fades so the last sweep floats free
    return {
      tx: tx, ty: ty, sc: sc, W: W, roomy: roomy,
      squares: squares,
      dash: s.started ? 1 - done / total : 1,
      seed: s.started && step === 0 ? 1 : 0
    };
  }

  var svg = $('#gs-svg'), cam = $('#gs-cam'), spiral = $('#gs-spiral'), seed = $('#gs-seed');
  var rects = $$('#gs-cam rect[data-q]');
  var steps = $$('[data-story-step]');
  var dotsWrap = $('#gs-dots');

  // Chapter buttons
  var dots = CAPTIONS.map(function (cap, j) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'gs-dot';
    b.setAttribute('aria-label', 'Go to chapter ' + (j + 1) + ': ' + cap);
    b.style.cssText = 'width:44px;height:44px;padding:0;border:0;background:transparent;cursor:pointer;display:flex;align-items:center;justify-content:center;';
    b.innerHTML = '<span style="display:block;height:4px;transition:width .4s ease,background .4s ease;"></span>';
    b.addEventListener('click', function () {
      state.started = true;
      if (steps[j]) steps[j].scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'center' });
      state.step = j; renderStage();
    });
    dotsWrap.appendChild(b);
    return b;
  });

  function renderStage() {
    var v = stageValues(state);
    svg.setAttribute('viewBox', '0 0 ' + v.W + ' ' + STAGE_H);
    svg.style.opacity = v.roomy ? 1 : 0.14;
    svg.setAttribute('aria-label', LABELS[state.step]);
    cam.style.transform = 'translate(' + v.tx.toFixed(2) + 'px, ' + v.ty.toFixed(2) + 'px) scale(' + v.sc.toFixed(5) + ')';
    var sw = (1.2 / v.sc).toFixed(3);
    rects.forEach(function (r) { var q = +r.getAttribute('data-q'); r.style.opacity = v.squares[q]; r.style.strokeWidth = sw; });
    spiral.style.strokeDashoffset = v.dash.toFixed(4);
    spiral.style.strokeWidth = (3 / v.sc).toFixed(3);
    spiral.style.opacity = state.step >= 3 ? 0.7 : 1;
    seed.style.opacity = v.seed;
    $('#gs-stepnum').textContent = pad(state.step + 1);
    $('#gs-caption').textContent = CAPTIONS[state.step];
    dots.forEach(function (b, j) {
      var on = j === state.step, bar = b.firstChild;
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
      bar.style.width = (on ? 28 : 12) + 'px';
      bar.style.background = on ? '#2C5D8F' : 'rgba(28,34,48,0.25)';
    });
    steps.forEach(function (el, j) { el.style.opacity = j === state.step ? 1 : 0.4; });
  }

  /* ------------------------------------------------------------------
   * 2. Floating shapes: drift toward the camera; scrolling pushes them closer and fades them
   * ------------------------------------------------------------------ */
  var field = $('#depth-field');
  (function buildField() {
    var seedN = 11, rnd = function () { seedN = (seedN * 16807) % 2147483647; return (seedN - 1) / 2147483646; };
    var cols = ['#2C5D8F', '#5B8FC7', '#B8893A', '#1C2230', '#A8A397', '#8FB4D8'];
    var SHAPES = {
      tri: '<path d="M5 1L9 9H1Z"/>',
      sq: '<rect x="1.5" y="1.5" width="7" height="7"/>',
      circ: '<circle cx="5" cy="5" r="3.8"/>',
      rect: '<rect x="0.9" y="2.47" width="8.2" height="5.07"/>', // golden rectangle
      hex: '<path d="M5 1L8.46 3V7L5 9L1.54 7V3Z"/>'
    };
    var kinds = Object.keys(SHAPES), html = '';
    for (var t = 0; t < 52; t++) {
      var z = rnd(); // depth: 0 far, 1 near
      var kind = kinds[t % kinds.length];
      var x = (2 + rnd() * 94).toFixed(1), y = Math.round(40 + rnd() * 3960), w = Math.round(12 + z * 50);
      var o = (0.22 + (1 - Math.abs(z - 0.5) * 2) * 0.25 + (z > 0.8 ? -0.08 : 0)).toFixed(2);
      var b = (z > 0.75 ? 1.2 + (z - 0.75) * 8 : (z < 0.2 ? 0.6 : 0)).toFixed(1);
      var sw = (1 + (1 - z) * 0.6).toFixed(1), c = cols[Math.floor(rnd() * cols.length)];
      var d = (-rnd() * 28).toFixed(1), dur = (20 + rnd() * 16).toFixed(1);
      var dx = Math.round((rnd() - 0.5) * 80), dy = Math.round(-20 - rnd() * 60), rot = Math.round((rnd() - 0.5) * 70);
      html += '<span class="depth" style="left:' + x + '%;top:' + y + 'px;width:' + w + 'px;height:' + w + 'px;--z:' + z.toFixed(2) + ';--o:' + o + ';--b:' + b + 'px;">' +
        '<svg class="bokeh" viewBox="0 0 10 10" aria-hidden="true" style="position:relative;display:block;width:100%;height:100%;overflow:visible;animation-delay:' + d + 's;animation-duration:' + dur + 's;--dx:' + dx + 'px;--dy:' + dy + 'px;--rot:' + rot + 'deg;">' +
        '<g fill="none" stroke="' + c + '" stroke-width="' + sw + '" vector-effect="non-scaling-stroke">' + SHAPES[kind].replace('/>', ' vector-effect="non-scaling-stroke"/>') + '</g></svg></span>';
    }
    field.innerHTML = html;
  })();

  /* Scroll + resize: chapter detection, story progress, and the "started" flag. */
  var story = $('#story'), layer = $('[data-gs-layer]');
  var ticking = false;
  function onScroll() {
    if (ticking) return; ticking = true;
    requestAnimationFrame(function () {
      ticking = false;
      var mid = window.innerHeight * 0.5, a = 0;
      steps.forEach(function (el, i) { if (el.getBoundingClientRect().top < mid) a = i; });
      var r = story.getBoundingClientRect(), span = Math.max(1, r.height - window.innerHeight);
      var away = -r.top;
      var prog = Math.round(Math.min(1, Math.max(0, away / span)) * 200) / 200;
      var started = away > 4 || a > 0; // back at the very top: bare dw/G again
      if (a !== state.step || started !== state.started) { state.step = a; state.started = started; renderStage(); }
      if (prog !== state.prog) { state.prog = prog; field.style.setProperty('--p', prog); }
    });
  }
  function onResize() {
    var w = Math.round(layer.clientWidth);
    if (w && w !== state.W) { state.W = w; renderStage(); }
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onResize);

  /* ------------------------------------------------------------------
   * 3. Outcomes selector ("What changes for you")
   * ------------------------------------------------------------------ */
  var OUTCOMES = [
      { label: 'More inquiries', tag: 'Modernize', tile: '#2C5D8F', icon: 'M4 18L10 12L14 15L20 8M15 8H20V13',
        title: 'More calls and inquiries from the visitors you already get.',
        body: 'Most sites lose people between the homepage and the contact form. We make the next step obvious on every page, so interest turns into conversations.',
        how: ['Clear paths to call, book or ask from every page', 'Faster pages so visitors stay long enough to act', 'Every form and call button tracked, so we can improve it'] },
      { label: 'Fewer confused visitors', tag: 'Modernize', tile: '#3A6FA6', icon: 'M9.5 9A2.5 2.5 0 1 1 12 11.5V13.5M12 17H12.01M12 21A9 9 0 1 0 12 3A9 9 0 0 0 12 21Z',
        title: 'Fewer “how do I…?” calls and emails.',
        body: 'When visitors can find answers on their own, your team gets time back. We organize content around the questions customers actually ask.',
        how: ['Navigation built from real customer questions', 'Plain-language pages, written to be scanned', 'Usability tests with real people before launch'] },
      { label: 'Works on every device', tag: 'Modernize', tile: '#5B8FC7', icon: 'M7 3H17V21H7ZM11 18H13',
        title: 'A site that works on every phone, tablet and screen reader.',
        body: 'Most visits now start on a phone. We design small-screen first, then scale up, so nobody gets a broken or cramped version of your business.',
        how: ['Mobile-first layouts and touch-friendly controls', 'Tested across common phones, tablets and browsers', 'Fast loading on slower connections'] },
      { label: 'Accessibility handled', tag: 'Modernize + Care', tile: '#1F4268', icon: 'M12 3A9 9 0 1 0 12 21A9 9 0 0 0 12 3ZM12 7.5V7.6M7.5 10H16.5M12 10V14M12 14L9.5 18M12 14L14.5 18',
        title: 'Accessibility compliance handled, not left to chance.',
        body: 'An accessible site reaches more customers and carries less legal risk. We build to WCAG and Section 508 from the start, then keep it compliant as content changes.',
        how: ['Color contrast, keyboard access and screen-reader support', 'Alt text and clear headings on every page', 'Ongoing checks as you add new content'] },
      { label: 'AI readiness', tag: 'Modernize + Care', tile: '#B8893A', icon: 'M12 3L13.8 9.2L20 11L13.8 12.8L12 19L10.2 12.8L4 11L10.2 9.2ZM19 3V7M17 5H21',
        title: 'Found, understood and recommended by AI assistants.',
        body: 'More customers now ask AI assistants instead of searching. We structure your site so AI tools can read it accurately, answer questions about your business and point people to you.',
        how: ['Structured data that describes your services, location and hours', 'Clear, well-organized pages AI tools can read and quote', 'Monthly checks of how AI assistants describe your business'] },
      { label: 'An established look', tag: 'Modernize', tile: '#234B74', icon: 'M12 3L20 7.5V16.5L12 21L4 16.5V7.5ZM12 12L20 7.5M12 12V21M12 12L4 7.5',
        title: 'A brand that looks as established as your business is.',
        body: 'First impressions happen in seconds. A clean, consistent design tells visitors you are credible before they read a word.',
        how: ['A consistent visual system across every page', 'Real photography and clear typography', 'A small design system so new pages always match'] },
      { label: 'Never falls behind', tag: 'Care', tile: '#4A7DB3', icon: 'M20 12A8 8 0 1 1 17.66 6.34M18 2.5V6.6H13.9M12 8V12L15 14',
        title: 'Monthly improvements, so the site never falls behind again.',
        body: 'A website is never really finished. Each month, AI-assisted testing and analytics show what to improve, and a person reviews every change before it goes live.',
        how: ['Monthly review of analytics and user behavior', 'AI-assisted testing, checked by a person', 'A short report of what changed and why'] }
  ];
  var ocIndex = 4; // AI readiness opens by default
  var ocList = $('#oc-list');
  var ocButtons = OUTCOMES.map(function (o, j) {
    var b = document.createElement('button');
    b.type = 'button';
    b.setAttribute('role', 'listitem');
    b.style.cssText = 'display:flex;align-items:center;gap:16px;width:100%;min-height:64px;padding:10px 16px;border:0;border-left:3px solid transparent;background:transparent;text-align:left;cursor:pointer;font-family:Lexend,system-ui,sans-serif;transition:background .3s ease,border-color .3s ease;';
    b.innerHTML =
      '<span class="oc-n" style="flex:0 0 24px;font-size:13px;font-weight:600;letter-spacing:.1em;">' + pad(j + 1) + '</span>' +
      '<span style="flex:0 0 44px;height:44px;background:' + o.tile + ';display:flex;align-items:center;justify-content:center;box-shadow:0 8px 18px rgba(44,93,143,.22);"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="1.7" aria-hidden="true"><path d="' + o.icon + '"/></svg></span>' +
      '<span style="flex:1;min-width:0;font-size:13px;font-weight:600;letter-spacing:.14em;text-transform:uppercase;color:#1C2230;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + o.label + '</span>' +
      '<span class="oc-arrow" aria-hidden="true" style="font-size:16px;color:#2C5D8F;">→</span>';
    b.addEventListener('click', function () { ocIndex = j; renderOutcome(); });
    ocList.appendChild(b);
    return b;
  });
  var segs = OUTCOMES.map(function () {
    var s = document.createElement('span');
    s.style.cssText = 'flex:1;height:4px;transition:background .3s ease;';
    $('#oc-segs').appendChild(s);
    return s;
  });

  function renderOutcome() {
    var cur = OUTCOMES[ocIndex];
    ocButtons.forEach(function (b, j) {
      var on = j === ocIndex;
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
      b.style.background = on ? '#E6EEF8' : 'transparent';
      b.style.borderLeftColor = on ? '#2C5D8F' : 'transparent';
      b.querySelector('.oc-n').style.color = on ? '#2C5D8F' : '#665F55';
      b.querySelector('.oc-arrow').style.opacity = on ? 1 : 0;
      segs[j].style.background = on ? '#2C5D8F' : '#D5DEEA';
    });
    $$('.oc-num').forEach(function (el) { el.textContent = pad(ocIndex + 1); });
    $('#oc-tag').textContent = cur.tag;
    $('#oc-title').textContent = cur.title;
    $('#oc-body').textContent = cur.body;
    $('#oc-tile').style.background = cur.tile;
    $('#oc-icon').setAttribute('d', cur.icon);
    $('#oc-how').innerHTML = cur.how.map(function (t) {
      return '<li style="display:flex;gap:12px;font-size:15px;line-height:23px;font-weight:300;color:#3F3A33;"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2C5D8F" stroke-width="2.2" aria-hidden="true" style="flex:0 0 18px;margin-top:3px;"><path d="M4 12.5L9.5 18L20 6.5"/></svg>' + t + '</li>';
    }).join('');
  }

  /* Init */
  onResize();
  renderStage();
  renderOutcome();
  onScroll();
})();
