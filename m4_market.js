/* 模块4：市场结构训练（情绪周期） */
(function () {
  "use strict";
  const TG = window.TG;
  // 板块映射（20只样本）
  TG.SECTORS = {
    "600519": "白酒", "000858": "白酒", "601318": "保险", "600036": "银行", "600030": "券商",
    "300059": "券商", "600031": "工程机械", "601012": "光伏", "600276": "医药", "300760": "医疗器械",
    "000725": "面板", "002475": "消费电子", "002241": "声学", "600703": "半导体", "000625": "汽车",
    "002594": "新能源车", "300750": "锂电池", "002466": "锂矿", "601888": "免税", "002714": "养殖",
  };
  const PHASES = ["启动", "发酵", "高潮", "分歧", "退潮"];
  const M = { stats: null, dateMap: null, dates: null, cur: null, revealed: false };

  function build() {
    if (M.stats) return;
    const stocks = Object.values(window.MARKET_DATA);
    const dateMap = {}, datesSet = {};
    stocks.forEach((s) => s.klines.forEach((k, idx) => { (dateMap[k.date] = dateMap[k.date] || []).push({ s, idx }); datesSet[k.date] = 1; }));
    const dates = Object.keys(dateMap).sort();
    const isLU = (s, j) => j >= 1 && (s.klines[j].c / s.klines[j - 1].c - 1) >= 0.095;
    const stats = [];
    for (let p = 5; p < dates.length - 6; p++) {
      const arr = dateMap[dates[p]];
      if (arr.length < 8) continue;
      let up = 0, down = 0, lu = 0, ld = 0, next5sum = 0, next5n = 0, prior5sum = 0, prior5n = 0, conn = 0;
      const secCh = {};
      arr.forEach(({ s, idx }) => {
        if (idx < 1) return; // 需要前一根计算涨跌
        const ch = s.klines[idx].c / s.klines[idx - 1].c - 1;
        if (ch > 0) up++; else if (ch < 0) down++; else up++;
        if (ch >= 0.095) lu++; if (ch <= -0.095) ld++;
        if (idx + 5 < s.klines.length) { next5sum += s.klines[idx + 5].c / s.klines[idx].c - 1; next5n++; }
        if (idx >= 5) { prior5sum += s.klines[idx].c / s.klines[idx - 5].c - 1; prior5n++; }
        if (isLU(s, idx)) {
          let j = idx, c = 0; while (j >= 1 && isLU(s, j)) { c++; j--; }
          conn = Math.max(conn, c);
          const sec = TG.SECTORS[s.code] || "其他";
          secCh[sec] = (secCh[sec] || 0) + ch;
        }
      });
      if (!next5n || !prior5n) continue;
      const next5 = next5sum / next5n * 100, prior5 = prior5sum / prior5n * 100;
      let lead = "—", leadCh = -Infinity;
      Object.entries(secCh).forEach(([sec, c]) => { if (c > leadCh) { leadCh = c; lead = sec; } });
      stats.push({ date: dates[p], p, up, down, lu, ld, conn, lead, leadCh, next5, prior5, phase: phaseOf(prior5, next5) });
    }
    M.stats = stats; M.dateMap = dateMap; M.dates = dates;
    TG._marketDateMap = dateMap; TG._marketDates = dates;
  }
  function phaseOf(prior5, next5) {
    if (next5 > 1.5) return "高潮";
    if (next5 > 0.5) return prior5 < -1 ? "启动" : "发酵";
    if (next5 < -0.5) return "退潮";
    return "分歧";
  }
  function buildIndex(p, len) {
    const out = []; let val = 100, prev = 100;
    for (let t = p - len; t <= p + 10; t++) {
      if (t < 0 || t >= M.dates.length) continue;
      const arr = M.dateMap[M.dates[t]];
      let ch = 0, cnt = 0;
      arr.forEach(({ s, idx }) => { if (idx >= 1 && idx < s.klines.length) { ch += s.klines[idx].c / s.klines[idx - 1].c - 1; cnt++; } });
      val *= (1 + (cnt ? ch / cnt : 0));
      out.push({ date: M.dates[t], o: prev, c: val, h: val, l: val, v: 0 });
      prev = val;
    }
    return out;
  }

  function render(container) {
    if (window.__TG_TEST_MODE__) (window.__TG_TEST__ = window.__TG_TEST__ || {})["market"] = M;
    build();
    if (!M.stats.length) { container.innerHTML = '<div class="empty">样本不足。</div>'; return; }
    let st;
    do { st = M.stats[Math.floor(Math.random() * M.stats.length)]; } while (M.cur && st === M.cur.st && M.stats.length > 1);
    M.cur = { st };
    const len = 40, idxK = buildIndex(st.p, len);
    M.cur.idxK = idxK; M.cur.decisionP = len; M.revealed = false;
    container.innerHTML = `
      <div class="scenario">📅 <b>${st.date}</b> 市场快照（基于样本股宽度统计）。请判断当前市场所处<b>情绪周期</b>阶段。</div>
      <div class="card"><div class="hud">
        <div class="cell"><div class="k">涨停</div><div class="v" style="color:var(--up)">${st.lu}</div></div>
        <div class="cell"><div class="k">跌停</div><div class="v" style="color:var(--down)">${st.ld}</div></div>
        <div class="cell"><div class="k">上涨/下跌</div><div class="v">${st.up}/${st.down}</div></div>
        <div class="cell"><div class="k">连板高度</div><div class="v">${st.conn}板</div></div>
        <div class="cell"><div class="k">领涨板块</div><div class="v">${st.lead}</div></div>
        <div class="cell"><div class="k">领涨强度</div><div class="v">${st.leadCh >= 0 ? "+" : ""}${st.leadCh.toFixed(1)}%</div></div>
      </div></div>
      <div class="chart-wrap"><canvas id="m4chart"></canvas><div class="lockBanner" id="m4lock">🔒 未来数据已隐藏</div></div>
      <div class="card"><div class="opts c5" id="m4opts"></div>
        <div class="row" style="margin-top:12px"><button class="btn-primary" id="m4submit">提交判断</button>
          <button class="btn" id="m4next" disabled>🎲 下一题</button></div></div>
      <div id="m4result"></div>`;
    const $ = (id) => container.querySelector("#" + id);
    $("m4opts").innerHTML = PHASES.map((o) => `<div class="opt" data-o="${o}">${o}</div>`).join("");
    $("m4opts").querySelectorAll(".opt").forEach((el) => el.onclick = () => { $("m4opts").querySelectorAll(".opt").forEach((x) => x.classList.remove("sel")); el.classList.add("sel"); M.pick = el.dataset.o; });
    const canvas = $("m4chart"); TG.bindCrosshair(canvas); canvas._redraw = () => renderChart(canvas); canvas._redraw();
    $("m4submit").onclick = () => submit(container);
    $("m4next").onclick = () => render(container);
  }
  function renderChart(canvas) {
    const c = M.cur; if (!c) return;
    const hide = M.revealed ? c.decisionP + 10 : c.decisionP;
    TG.drawCandles(canvas, c.idxK, { viewStart: 0, hideFutureFrom: hide, crosshair: true, markers: [{ idx: c.decisionP, price: c.idxK[c.decisionP].c, color: "#388bfd", dir: "up" }] });
    const lock = canvas.parentElement.querySelector(".lockBanner"); if (lock) lock.style.display = M.revealed ? "none" : "";
  }
  function submit(container) {
    const st = M.cur.st; if (!M.pick) { alert("请选择一个阶段。"); return; }
    const correct = M.pick === st.phase;
    const score = TG.adjScore(M.pick, st.phase, PHASES);
    M.revealed = true; const canvas = container.querySelector("#m4chart"); canvas._redraw();
    const $ = (id) => container.querySelector("#" + id);
    $("m4lock").style.display = "none"; $("m4submit").disabled = true; $("m4next").disabled = false;
    const ev = st.next5 >= 0 ? `随后5日样本平均收益 +${st.next5.toFixed(2)}%` : `随后5日样本平均收益 ${st.next5.toFixed(2)}%`;
    TG.logResult({ mod: "market", score, correct, tags: ["情绪:" + (correct ? "对" : "错")], detail: { guess: M.pick, answer: st.phase } });
    TG.refreshLevelBadge();
    $("m4result").innerHTML = `<div class="score-card"><div class="dim"><span>真实阶段</span><b>${st.phase}</b></div>
      <div class="dim"><span>你的判断</span><b>${M.pick}</b></div>
      <div class="dim"><span>得分</span><b>${score.toFixed(1)}</b></div></div>
      <div class="note2" style="margin-top:8px">证据：${ev}。情绪周期识别的核心是先分类、再匹配策略——高潮期不追高，退潮期控仓位。</div>`;
  }

  TG.register({ id: "market", title: "市场结构训练", icon: "🌡️", desc: "读涨停/跌停/连板/领涨板块，判断情绪周期（启动/发酵/高潮/分歧/退潮）。", render });
  TG.addNav("market");
})();
