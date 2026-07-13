/* 模块2：真突破 / 假突破训练 */
(function () {
  "use strict";
  const TG = window.TG;
  const M = { cases: null, cur: null, revealed: false };

  function buildCases() {
    if (M.cases) return M.cases;
    const cases = [];
    Object.values(window.MARKET_DATA).forEach((s) => {
      const k = s.klines, L = k.length;
      for (let i = 30; i < L - 12; i++) {
        let lvl = -Infinity;
        for (let j = i - 20; j < i; j++) lvl = Math.max(lvl, k[j].h);
        if (k[i].c > lvl) { // 向上突破
          let hi = -Infinity, lo = Infinity;
          for (let j = i; j <= i + 8; j++) { hi = Math.max(hi, k[j].h); lo = Math.min(lo, k[j].l); }
          const newHigh = hi > k[i].c * 1.02;
          const fellBack = lo < lvl;
          if (newHigh && k[i + 8].c > lvl) cases.push({ code: s.code, name: s.name, klines: k, decisionIdx: i, level: lvl, isTrue: true, futHi: hi });
          else if (fellBack) cases.push({ code: s.code, name: s.name, klines: k, decisionIdx: i, level: lvl, isTrue: false, futLo: lo });
        }
      }
    });
    M.cases = cases;
    return cases;
  }

  function pickCase() {
    const cases = buildCases();
    if (!cases.length) return null;
    let c;
    do { c = cases[Math.floor(Math.random() * cases.length)]; } while (M.cur && c === M.cur.cur && cases.length > 1);
    M.cur = { case: c }; M.revealed = false;
    return c;
  }

  function render(container) {
    if (window.__TG_TEST_MODE__) (window.__TG_TEST__ = window.__TG_TEST__ || {})["breakout"] = M;
    const c = pickCase();
    if (!c) { container.innerHTML = '<div class="empty">样本不足，无法生成突破案例。</div>'; return; }
    container.innerHTML = `
      <div class="scenario">📈 <b>${c.name} (${c.code})</b>：图中箭头为<b>决策K线</b>，虚线为<b>前期高点（突破位）</b>。请判断这是真突破还是假突破，并给出你的置信度。</div>
      <div class="chart-wrap"><canvas id="m2chart"></canvas><div class="lockBanner" id="m2lock">🔒 未来数据已隐藏</div></div>
      <div class="card">
        <div class="slider-row">
          <span>我认为真突破概率：</span>
          <input type="range" id="m2prob" min="10" max="90" step="10" value="50">
          <span class="slider-val" id="m2probv">50%</span>
        </div>
        <div class="row" style="margin-top:10px">
          <button class="btn-primary" id="m2submit">提交判断</button>
          <button class="btn" id="m2new" disabled>🎲 换一题</button>
        </div>
      </div>
      <div id="m2result"></div>`;
    const $ = (id) => container.querySelector("#" + id);
    const canvas = $("m2chart");
    TG.bindCrosshair(canvas);
    const redraw = () => renderChart(canvas);
    canvas._redraw = redraw;
    $("m2prob").oninput = () => { $("m2probv").textContent = $("m2prob").value + "%"; };
    $("m2submit").onclick = () => submit(container, canvas);
    $("m2new").onclick = () => render(container);
    redraw();
  }

  function renderChart(canvas) {
    const c = M.cur.case;
    const viewStart = Math.max(0, c.decisionIdx - 25);
    const hide = M.revealed ? c.decisionIdx + 12 : c.decisionIdx;
    const markers = [{ idx: c.decisionIdx, price: c.klines[c.decisionIdx].c, color: "#388bfd", dir: "up" }];
    if (M.revealed) {
      if (c.isTrue) markers.push({ idx: c.decisionIdx + 6, price: c.futHi, color: "#2ec27e", dir: "up" });
      else markers.push({ idx: c.decisionIdx + 3, price: c.futLo, color: "#f0495b", dir: "down" });
    }
    TG.drawCandles(canvas, c.klines, {
      viewStart, hideFutureFrom: hide, markers,
      lines: [{ price: c.level, color: "rgba(210,153,34,0.8)", dash: [5, 4] }], crosshair: true,
    });
    const lock = container_lock(canvas);
    if (lock) lock.style.display = M.revealed ? "none" : "";
  }
  function container_lock(canvas) { return canvas.parentElement.querySelector(".lockBanner"); }

  function submit(container, canvas) {
    const c = M.cur.case;
    const prob = parseInt(container.querySelector("#m2prob").value, 10);
    const ideal = c.isTrue ? 85 : 15;
    const score = TG.clamp(100 - Math.abs(prob - ideal) * 1.1, 0, 100);
    const correct = c.isTrue ? prob >= 50 : prob < 50;
    M.revealed = true;
    renderChart(canvas);
    const $ = (id) => container.querySelector("#" + id);
    $("m2lock").style.display = "none";
    $("m2submit").disabled = true; $("m2new").disabled = false;
    const truth = c.isTrue ? "✅ 真实突破" : "❌ 假突破";
    const expl = c.isTrue
      ? "突破后放量上行并守住突破位，属于有效突破（龙头启动/二波启动的常见形态）。"
      : "突破后很快跌回突破位下方，属诱多假突破——此时追高最易被套。";
    TG.logResult({ mod: "breakout", score, correct, tags: [c.isTrue ? "认出真突破" : "识别假突破"], detail: { prob, isTrue: c.isTrue } });
    TG.refreshLevelBadge();
    $("m2result").innerHTML = `
      <div class="score-card"><div class="dim"><span>真相</span><b>${truth}</b></div>
        <div class="dim"><span>你的判断</span><b>真突破概率 ${prob}%</b></div>
        <div class="dim"><span>校准得分</span><b>${score.toFixed(1)}</b></div>
        <div class="bar"><i style="width:${score}%;background:${score >= 75 ? "var(--good)" : score >= 50 ? "var(--accent)" : "var(--warn)"}"></i></div>
      </div>
      <div class="note2" style="margin-top:8px">${expl}<br>训练要点：概率判断要<b>校准</b>——真突破并非每次都成立，给过高置信度（如90%）一旦是假突破，代价极大。</div>`;
  }

  TG.register({
    id: "breakout", title: "真突破/假突破", icon: "📈",
    desc: "识别平台突破、龙头启动、二波启动 vs 假突破、出货。训练概率校准，而非对错。",
    render,
  });
  TG.addNav("breakout");
})();
