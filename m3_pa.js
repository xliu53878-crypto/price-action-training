/* 模块3：Price Action 训练（K线结构 / 成交结构 / 趋势结构） */
(function () {
  "use strict";
  const TG = window.TG;
  const M = { type: "candle", q: null, revealed: false };

  const CANDLE_OPTS = ["Pin Bar", "Inside Bar", "Outside Bar", "吞没结构", "假突破", "无明确结构"];
  const VOL_OPTS = ["上涨放量", "下跌缩量", "放量滞涨", "缩量上涨", "天量换手", "地量企稳"];
  const TREND_OPTS = ["上升趋势", "下降趋势", "箱体整理", "趋势衰竭", "趋势反转"];
  const PATTERN_OPTS = ["双顶", "双底", "头肩顶", "头肩底", "三角形整理", "无明确形态"];

  const mean = (a) => a.reduce((s, x) => s + x, 0) / a.length;
  const regSlope = (a) => {
    const n = a.length, xm = (n - 1) / 2; let sy = 0, sxy = 0, sxx = 0;
    a.forEach((c, i) => { sy += c; sxy += (i - xm) * c; sxx += (i - xm) ** 2; });
    return sxy / sxx;
  };
  const amp = (sl) => Math.max(...sl.map((x) => x.h)) - Math.min(...sl.map((x) => x.l));

  function classifyCandle(k, i) {
    const a = k[i - 1], b = k[i];
    if (b.h <= a.h && b.l >= a.l) return "Inside Bar";
    if (b.h > a.h && b.l < a.l) return "Outside Bar";
    if (a.c < a.o && b.c > b.o && b.c > a.c && b.o < a.o) return "吞没结构";
    if (a.c > a.o && b.c < b.o && b.c < a.c && b.o > a.o) return "吞没结构";
    const body = Math.abs(b.c - b.o);
    const upWick = b.h - Math.max(b.o, b.c), dnWick = Math.min(b.o, b.c) - b.l;
    if ((dnWick >= 2 * body && body > 0) || (upWick >= 2 * body && body > 0)) return "Pin Bar";
    const prevHi = Math.max(a.h, k[i - 2].h), prevLo = Math.min(a.l, k[i - 2].l);
    if (b.h > prevHi && b.c < prevHi) return "假突破";
    if (b.l < prevLo && b.c > prevLo) return "假突破";
    return "无明确结构";
  }
  function classifyVol(k, i) {
    const first = k[i - 9], last = k[i];
    const priceCh = (last.c / first.c - 1) * 100;
    const vols = k.slice(i - 9, i + 1).map((x) => x.v);
    const avg = mean(vols), r = last.v / avg;
    if (r >= 2.5) return "天量换手";
    if (Math.abs(priceCh) < 1 && r >= 1.5) return "放量滞涨";
    if (priceCh > 0 && r >= 1.3) return "上涨放量";
    if (priceCh < 0 && r <= 0.7) return "下跌缩量";
    if (priceCh > 0 && r <= 0.7) return "缩量上涨";
    if (r <= 0.5) return "地量企稳";
    return priceCh < 0 ? "下跌缩量" : "缩量上涨";
  }
  function classifyTrend(k, i) {
    const w = k.slice(i - 39, i + 1), closes = w.map((x) => x.c), n = closes.length;
    const xm = (n - 1) / 2; let sy = 0, sxy = 0, sxx = 0;
    closes.forEach((c, idx) => { sy += c; sxy += (idx - xm) * c; sxx += (idx - xm) ** 2; });
    const slope = sxy / sxx;
    const firstHalf = mean(closes.slice(0, 20)), secondHalf = mean(closes.slice(20));
    const chgPct = (secondHalf - firstHalf) / firstHalf * 100;
    const range = Math.max(...w.map((x) => x.h)) - Math.min(...w.map((x) => x.l));
    const tight = range / closes[n - 1] < 0.12;
    const es = regSlope(closes.slice(0, 20)), ls = regSlope(closes.slice(20));
    const earlyAmp = amp(w.slice(0, 20)), lateAmp = amp(w.slice(20));
    if (Math.abs(chgPct) <= 3 && tight) return "箱体整理";
    if ((es > 0 && ls < 0) || (es < 0 && ls > 0)) return "趋势反转";
    if ((es > 0 || es < 0) && Math.abs(ls) < Math.abs(es) * 0.4 && lateAmp < earlyAmp * 0.6) return "趋势衰竭";
    if (ls > 0) return "上升趋势";
    if (ls < 0) return "下降趋势";
    return "箱体整理";
  }

  function classifyPattern(k, i) {
    const a = Math.max(2, i - 44), b = i;
    const hs = [], ls = [];
    for (let t = 1; t < b - a; t++) {
      const idx = a + t;
      if (k[idx].h >= k[idx - 1].h && k[idx].h >= k[idx + 1].h) hs.push({ idx, p: k[idx].h });
      if (k[idx].l <= k[idx - 1].l && k[idx].l <= k[idx + 1].l) ls.push({ idx, p: k[idx].l });
    }
    const cur = k[i].c;
    if (hs.length >= 2) {
      const l2 = hs.slice(-2);
      if (Math.abs(l2[0].p - l2[1].p) / l2[0].p < 0.04 && cur < Math.min(l2[0].p, l2[1].p) * 0.99) return "双顶";
    }
    if (ls.length >= 2) {
      const l2 = ls.slice(-2);
      if (Math.abs(l2[0].p - l2[1].p) / l2[0].p < 0.04 && cur > Math.max(l2[0].p, l2[1].p) * 1.01) return "双底";
    }
    if (hs.length >= 3) {
      const t3 = hs.slice(-3), mid = t3[1];
      const sym = (Math.abs(t3[0].p - mid.p) + Math.abs(t3[2].p - mid.p)) / (t3[0].p + t3[2].p) < 0.08;
      if (mid.p > t3[0].p && mid.p > t3[2].p && cur < Math.min(t3[0].p, t3[2].p) * 0.99 && sym) return "头肩顶";
    }
    if (ls.length >= 3) {
      const t3 = ls.slice(-3), mid = t3[1];
      const sym = (Math.abs(t3[0].p - mid.p) + Math.abs(t3[2].p - mid.p)) / (t3[0].p + t3[2].p) < 0.08;
      if (mid.p < t3[0].p && mid.p < t3[2].p && cur > Math.max(t3[0].p, t3[2].p) * 1.01 && sym) return "头肩底";
    }
    if (hs.length >= 2 && ls.length >= 2) {
      const hS = regSlope(hs.map((x) => x.p)), lS = regSlope(ls.map((x) => x.p));
      if (hS < 0 && lS > 0) return "三角形整理";
    }
    return "无明确形态";
  }

  function genQuiz(type) {
    const stocks = Object.values(window.MARKET_DATA);
    const s = stocks[Math.floor(Math.random() * stocks.length)];
    const k = s.klines, L = k.length;
    let i, viewStart, revealEnd, opts, answer, explain;
    if (type === "candle") {
      i = 25 + Math.floor(Math.random() * (L - 33));
      viewStart = i - 7; revealEnd = i + 5; opts = CANDLE_OPTS;
      answer = classifyCandle(k, i);
      explain = `该K线实际为「${answer}」。识别单根/相邻K线结构是 Price Action 的基本功。`;
    } else if (type === "vol") {
      i = 15 + Math.floor(Math.random() * (L - 20));
      viewStart = i - 9; revealEnd = i + 5; opts = VOL_OPTS;
      answer = classifyVol(k, i);
      explain = `量价实际为「${answer}」。成交结构是资金行为的直接映射，比价格更诚实。`;
    } else if (type === "trend") {
      i = 45 + Math.floor(Math.random() * (L - 60));
      viewStart = i - 39; revealEnd = i + 10; opts = TREND_OPTS;
      answer = classifyTrend(k, i);
      explain = `结构实际为「${answer}」。趋势是你的朋友，直到它反转——识别衰竭与反转是逃顶抄底的关键。`;
    } else {
      i = 50 + Math.floor(Math.random() * (L - 70));
      viewStart = i - 44; revealEnd = i + 10; opts = PATTERN_OPTS;
      answer = classifyPattern(k, i);
      explain = `组合形态实际为「${answer}」。经典形态是情绪的几何化——双顶/头肩是派发，双底/三角形是蓄势，识别它们能提前感知拐点。`;
    }
    return { s, k, i, viewStart, revealEnd, opts, answer, explain, type };
  }

  function render(container) {
    if (window.__TG_TEST_MODE__) (window.__TG_TEST__ = window.__TG_TEST__ || {})["pa"] = M;
    container.innerHTML = `
      <div class="row" style="margin-bottom:4px">
        <button class="btn pa-tab ${M.type === "candle" ? "btn-primary" : ""}" data-t="candle">K线结构</button>
        <button class="btn pa-tab ${M.type === "vol" ? "btn-primary" : ""}" data-t="vol">成交结构</button>
        <button class="btn pa-tab ${M.type === "trend" ? "btn-primary" : ""}" data-t="trend">趋势结构</button>
        <button class="btn pa-tab ${M.type === "pattern" ? "btn-primary" : ""}" data-t="pattern">组合形态</button>
      </div>
      <div class="scenario" id="m3hint"></div>
      <div class="chart-wrap"><canvas id="m3chart"></canvas><div class="lockBanner" id="m3lock">🔒 未来数据已隐藏</div></div>
      <div class="card"><div class="opts c3" id="m3opts"></div>
        <div class="row" style="margin-top:12px">
          <button class="btn-primary" id="m3submit">提交判断</button>
          <button class="btn" id="m3next" disabled>🎲 下一题</button>
        </div>
      </div>
      <div id="m3result"></div>`;
    const $ = (id) => container.querySelector("#" + id);
    container.querySelectorAll(".pa-tab").forEach((b) => b.onclick = () => { M.type = b.dataset.t; render(container); });
    loadQuiz(container);
    // 提交/下一题必须在每次 render 时绑定（切标签会重建按钮元素，否则点击无反应）
    $("m3submit").onclick = () => submit(container);
    $("m3next").onclick = () => loadQuiz(container);
  }

  function loadQuiz(container) {
    const $ = (id) => container.querySelector("#" + id);
    M.q = genQuiz(M.type); M.revealed = false;
    const q = M.q;
    const hint = { candle: "观察最后一根（箭头处）的实体与影线，判断其 K 线结构。", vol: "下图含成交量（底部），判断当前量价关系。", trend: "观察约40根的整体走向，判断当前趋势结构。", pattern: "观察箭头之前的整体轮廓，判断是双顶/双底/头肩/三角形等组合形态。" }[q.type];
    $("m3hint").textContent = hint;
    $("m3opts").innerHTML = q.opts.map((o) => `<div class="opt" data-o="${o}">${o}</div>`).join("");
    $("m3opts").querySelectorAll(".opt").forEach((el) => el.onclick = () => {
      $("m3opts").querySelectorAll(".opt").forEach((x) => x.classList.remove("sel"));
      el.classList.add("sel"); M.pick = el.dataset.o;
    });
    $("m3submit").disabled = false; $("m3next").disabled = true; $("m3result").innerHTML = "";
    $("m3lock").style.display = "";
    const canvas = $("m3chart");
    TG.bindCrosshair(canvas);
    canvas._redraw = () => renderChart(container, canvas);
    canvas._redraw();
  }

  function renderChart(container, canvas) {
    const q = M.q; if (!q) return;
    const hide = M.revealed ? q.revealEnd : q.i;
    const cfg = { viewStart: q.viewStart, hideFutureFrom: hide, crosshair: true,
      markers: [{ idx: q.i, price: q.k[q.i].c, color: "#388bfd", dir: "up" }] };
    if (q.type === "vol") drawPV(canvas, q.k, cfg);
    else TG.drawCandles(canvas, q.k, cfg);
  }

  // 成交量专用图：上价格 + 下成交量
  function drawPV(canvas, klines, cfg) {
    const dpr = window.devicePixelRatio || 1, wrap = canvas.parentElement;
    const W = wrap.clientWidth || 800, H = wrap.clientHeight || 460;
    canvas.width = W * dpr; canvas.height = H * dpr; canvas.style.width = W + "px"; canvas.style.height = H + "px";
    const ctx = canvas.getContext("2d"); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);
    const padL = 54, padT = 8, padB = 18;
    const lock = cfg.hideFutureFrom != null && cfg.hideFutureFrom < klines.length - 1;
    const plotRight = lock ? W * (1 - TG.LOCK_RATIO) : W - 6;
    const vs = cfg.viewStart, ve = cfg.hideFutureFrom != null ? cfg.hideFutureFrom : cfg.viewEnd != null ? cfg.viewEnd : klines.length - 1;
    const view = klines.slice(vs, ve + 1), n = view.length; if (!n) return;
    const priceTop = padT, priceBot = H * 0.70, volTop = H * 0.74, volBot = H - padB;
    let pmin = Infinity, pmax = -Infinity, vmax = 0;
    view.forEach((k) => { pmin = Math.min(pmin, k.l); pmax = Math.max(pmax, k.h); vmax = Math.max(vmax, k.v); });
    const padY = (pmax - pmin) * 0.08 || 1; pmin -= padY; pmax += padY;
    const cw = (plotRight - padL) / n;
    const yP = (p) => priceTop + (1 - (p - pmin) / (pmax - pmin)) * (priceBot - priceTop);
    const xOf = (i) => padL + (i + 0.5) * cw;
    // 价格网格
    ctx.font = "11px sans-serif"; ctx.textBaseline = "middle"; ctx.fillStyle = "#8b949e"; ctx.textAlign = "right";
    for (let t = 0; t <= 4; t++) { const p = pmin + (pmax - pmin) * t / 4, y = yP(p); ctx.strokeStyle = "rgba(255,255,255,0.05)"; ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(plotRight, y); ctx.stroke(); ctx.fillText(TG.fmt(p, 2), padL - 6, y); }
    for (let i = 0; i < n; i++) {
      const k = view[i], x = xOf(i), up = k.c >= k.o, col = up ? "#f0495b" : "#2ec27e", bw = Math.max(1, cw * 0.6);
      ctx.strokeStyle = col; ctx.beginPath(); ctx.moveTo(x, yP(k.h)); ctx.lineTo(x, yP(k.l)); ctx.stroke();
      ctx.fillStyle = col; const yo = yP(k.o), yc = yP(k.c), top = Math.min(yo, yc), h = Math.max(1, Math.abs(yc - yo)); ctx.fillRect(x - bw / 2, top, bw, h);
    }
    // 成交量
    for (let i = 0; i < n; i++) {
      const k = view[i], x = xOf(i), up = k.c >= k.o, col = up ? "#f0495b" : "#2ec27e";
      const y = volBot - (k.v / vmax) * (volBot - volTop);
      ctx.fillStyle = col; ctx.globalAlpha = 0.7; ctx.fillRect(x - cw * 0.3, y, cw * 0.6, volBot - y); ctx.globalAlpha = 1;
    }
    // 时间轴
    ctx.fillStyle = "#8b949e"; ctx.textAlign = "center";
    for (let i = 0; i < n; i += Math.max(1, Math.floor(n / 6))) ctx.fillText(view[i].date.slice(5), xOf(i), H - 8);
    // 标注
    if (cfg.markers) cfg.markers.forEach((m) => { const i = m.idx - vs; if (i < 0 || i >= n) return; const x = xOf(i); ctx.fillStyle = m.color; ctx.beginPath(); ctx.moveTo(x, yP(m.price) + 6); ctx.lineTo(x - 5, yP(m.price) + 14); ctx.lineTo(x + 5, yP(m.price) + 14); ctx.closePath(); ctx.fill(); });
    // 锁定
    if (lock) {
      const lx = plotRight; ctx.fillStyle = "rgba(210,153,34,0.06)"; ctx.fillRect(lx, padT, W - lx, H - padT);
      ctx.fillStyle = "#d29922"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.font = "12px sans-serif";
      ctx.fillText("🔒 未来隐藏", (lx + W) / 2, H / 2);
    }
  }

  function submit(container) {
    const q = M.q; if (!q || !M.pick) { alert("请先选择一个选项。"); return; }
    const correct = M.pick === q.answer;
    const score = correct ? 100 : 35;
    M.revealed = true;
    const canvas = container.querySelector("#m3chart"); canvas._redraw();
    const $ = (id) => container.querySelector("#" + id);
    $("m3lock").style.display = "none"; $("m3submit").disabled = true; $("m3next").disabled = false;
    TG.logResult({ mod: "pa", score, correct, tags: [q.type + ":" + (correct ? "对" : "错")], detail: { guess: M.pick, answer: q.answer } });
    TG.refreshLevelBadge();
    $("m3result").innerHTML = `<div class="score-card"><div class="dim"><span>标准答案</span><b>${q.answer}</b></div>
      <div class="dim"><span>你的判断</span><b>${M.pick}</b></div>
      <div class="dim"><span>得分</span><b>${score}</b></div></div>
      <div class="note2" style="margin-top:8px">${q.explain}</div>`;
  }

  TG.register({
    id: "pa", title: "Price Action 训练", icon: "🕯️",
    desc: "K线结构 / 成交结构 / 趋势结构 / 组合形态识别——建立对价格与资金行为的直接认知。",
    render,
  });
  TG.addNav("pa");
})();
