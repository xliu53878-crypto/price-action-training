/* 模块1：K线盲测训练（最高优先级） */
(function () {
  "use strict";
  const TG = window.TG;
  const M = { S: null };

  const TEMPLATE = `
  <div class="chart-wrap"><canvas id="m1chart"></canvas><div class="lockBanner">🔒 未来数据已隐藏</div></div>
  <div class="hud">
    <div class="cell"><div class="k">当前日期</div><div class="v" id="m1date">-</div></div>
    <div class="cell"><div class="k">最新价</div><div class="v" id="m1price">-</div></div>
    <div class="cell"><div class="k">持仓</div><div class="v" id="m1posv">空仓</div></div>
    <div class="cell"><div class="k">浮动盈亏</div><div class="v" id="m1pnl">-</div></div>
    <div class="cell"><div class="k">已揭示/总数</div><div class="v" id="m1bars">-</div></div>
    <div class="cell"><div class="k">虚拟本金</div><div class="v" id="m1cap">100万</div></div>
  </div>
  <div class="row">
    <button class="btn" id="m1rv1">下一根K线</button>
    <button class="btn" id="m1rv5">下一周</button>
    <button class="btn" id="m1rv20">下一月</button>
    <button class="btn-warn" id="m1reset">↻ 重置本期</button>
    <button class="btn" id="m1switch">🎲 换一只</button>
  </div>
  <div class="card">
    <div class="row" style="align-items:flex-end">
      <div><label>仓位(%)</label><input id="m1pos" type="number" value="30" style="width:80px"></div>
      <div><label>止损价</label><input id="m1stop" type="number" style="width:90px"></div>
      <div><label>目标价</label><input id="m1target" type="number" style="width:90px"></div>
      <div style="flex:1"><label>决策理由（必填）</label><input id="m1reason" type="text" placeholder="例如：回踩前高企稳，放量阳线"></div>
    </div>
    <div class="opts c3" style="margin-top:10px">
      <button class="btn-buy" id="m1buy">买入/开仓</button>
      <button class="btn-buy" id="m1add">加仓</button>
      <button class="btn-sell" id="m1reduce">减仓</button>
      <button class="btn-sell" id="m1close">清仓/平仓</button>
      <button class="btn" id="m1observe">👁 观察记录</button>
      <button class="btn-primary" id="m1settle">结束训练并评分</button>
    </div>
  </div>
  <div class="card"><div class="dim"><span><b>交易日志（本期）</b></span></div><div id="m1log" class="col" style="margin-top:8px"></div></div>
  <div id="m1result"></div>`;

  function newSession() {
    const keys = Object.keys(window.MARKET_DATA);
    const k = keys[Math.floor(Math.random() * keys.length)];
    const s = window.MARKET_DATA[k];
    const len = s.klines.length;
    const lo = Math.min(80, Math.floor(len * 0.25));
    const hi = Math.max(lo + 60, len - 120);
    M.S = {
      stock: s, klines: s.klines, code: k,
      cursor: Math.floor(lo + Math.random() * (hi - lo)),
      startIdx: 0, capital: TG.CAPITAL, position: null,
      trades: [], rounds: [], settled: false,
    };
    M.S.startIdx = M.S.cursor;
  }

  function render(container) {
    if (!M.S) newSession();
    M.S._container = container;
    container.innerHTML = TEMPLATE;
    const $ = (id) => container.querySelector("#" + id);
    const canvas = $("m1chart");
    TG.bindCrosshair(canvas);

    const redraw = () => renderChart(canvas);
    canvas._redraw = redraw;

    $("m1rv1").onclick = () => reveal(1, canvas);
    $("m1rv5").onclick = () => reveal(5, canvas);
    $("m1rv20").onclick = () => reveal(20, canvas);
    $("m1reset").onclick = () => { M.S = null; render(container); };
    $("m1switch").onclick = () => { M.S = null; render(container); };
    $("m1buy").onclick = () => doTrade("buy", container, canvas);
    $("m1add").onclick = () => doTrade("add", container, canvas);
    $("m1reduce").onclick = () => doTrade("reduce", container, canvas);
    $("m1close").onclick = () => doTrade("close", container, canvas);
    $("m1observe").onclick = () => doTrade("observe", container, canvas);
    $("m1settle").onclick = () => settle(container, canvas);

    renderAll(container, canvas);
  }

  function cur(S) { return S.klines[S.cursor]; }

  function reveal(n, canvas) {
    const S = M.S; if (S.settled) return;
    const before = S.cursor;
    S.cursor = Math.min(S.cursor + n, S.klines.length - 1);
    if (S.position && S.position.stop) {
      for (let i = before + 1; i <= S.cursor; i++)
        if (S.klines[i].l <= S.position.stop && !S.position.stopHit) { S.position.stopHit = true; S.position.stopHitIdx = i; }
    }
    renderAll(M.S._container, canvas);
  }

  function doTrade(type, container, canvas) {
    const S = M.S; if (S.settled) { alert("本期已结算，请重置或换一只。"); return; }
    const $ = (id) => container.querySelector("#" + id);
    const price = cur(S).c, date = cur(S).date, idx = S.cursor;
    if (type === "observe") {
      S.trades.push({ type, idx, date, price, note: $("m1reason").value.trim() || "（观察，无备注）" });
      $("m1reason").value = ""; renderAll(container, canvas); return;
    }
    if (type === "buy") {
      if (S.position) { alert("已有持仓，请用加仓/减仓/清仓。"); return; }
      const posPct = num($("m1pos").value, 30), reason = $("m1reason").value.trim();
      if (!reason) { alert("训练核心：请填写决策理由再下单。"); return; }
      const stop = num($("m1stop").value, null), target = num($("m1target").value, null);
      const shares = S.capital * posPct / 100 / price;
      S.position = { shares, avgPrice: price, entryIdx: idx, entryDate: date, stop, target, reason, adds: [], posPct, stopHit: false };
      S.trades.push({ type, idx, date, price, posPct, stop, target, reason, shares });
    } else if (type === "add") {
      if (!S.position) { alert("当前空仓，无法加仓。"); return; }
      const posPct = num($("m1pos").value, 30), p = S.position;
      const addShares = S.capital * posPct / 100 / price, unreal = price - p.avgPrice;
      p.adds.push({ idx, price, shares: addShares, unreal });
      p.shares += addShares; p.avgPrice = (p.avgPrice * (p.shares - addShares) + price * addShares) / p.shares;
      p.posPct = TG.clamp(p.posPct + posPct, 0, 100);
      S.trades.push({ type, idx, date, price, addPct: posPct, avgPrice: p.avgPrice, note: $("m1reason").value.trim(), avgDown: unreal < 0 });
    } else if (type === "reduce") {
      if (!S.position) { alert("当前空仓。"); return; }
      const p = S.position, redPct = TG.clamp(num($("m1pos").value, 30), 1, 100);
      const sellShares = p.shares * redPct / 100, pnl = (price - p.avgPrice) * sellShares;
      p.shares -= sellShares;
      S.trades.push({ type, idx, date, price, sellShares, pnl, note: $("m1reason").value.trim() });
      if (p.shares < 1e-6) closePosition(price, date, idx, "减仓至清仓");
    } else if (type === "close") {
      if (!S.position) { alert("当前空仓。"); return; }
      closePosition(price, date, idx, $("m1reason").value.trim() || "主动平仓");
    }
    $("m1reason").value = ""; renderAll(container, canvas);
  }

  function closePosition(price, date, idx, note) {
    const S = M.S, p = S.position;
    const pnl = (price - p.avgPrice) * p.shares;
    const risk = p.stop ? Math.abs(p.avgPrice - p.stop) : p.avgPrice * TG.DEFAULT_RISK;
    const R = risk ? (price - p.avgPrice) / risk : 0;
    S.rounds.push({ entryIdx: p.entryIdx, entryDate: p.entryDate, entryPrice: p.avgPrice, exitIdx: idx, exitDate: date, exitPrice: price, shares: p.shares, pnl, R, stop: p.stop, target: p.target, reason: p.reason, avgDown: p.adds.some((a) => a.unreal < 0), stopHit: !!p.stopHit, addCount: p.adds.length, holding: idx - p.entryIdx });
    S.trades.push({ type: "sell", idx, date, price, pnl, R, note });
    S.position = null;
  }

  function settle(container, canvas) {
    const S = M.S; if (S.settled) return;
    S.cursor = S.klines.length - 1;
    if (S.position) {
      const p = S.position, price = cur(S).c;
      const pnl = (price - p.avgPrice) * p.shares;
      const risk = p.stop ? Math.abs(p.avgPrice - p.stop) : p.avgPrice * TG.DEFAULT_RISK;
      const R = risk ? (price - p.avgPrice) / risk : 0;
      S.rounds.push({ entryIdx: p.entryIdx, entryDate: p.entryDate, entryPrice: p.avgPrice, exitIdx: S.cursor, exitDate: cur(S).date, exitPrice: price, shares: p.shares, pnl, R, stop: p.stop, target: p.target, reason: p.reason, avgDown: p.adds.some((a) => a.unreal < 0), stopHit: !!p.stopHit, addCount: p.adds.length, holding: S.cursor - p.entryIdx, open: true });
      S.position = null;
    }
    S.settled = true;
    const sc = computeScore();
    renderScore(sc);
    showModal(sc);
    // 持久化
    TG.logResult({ mod: "blind", score: sc.overall, correct: sc.overall >= 60, tags: sc.weak.map((w) => w.w), detail: { n: sc.n, winRate: sc.winRate, maxDD: sc.maxDD } });
    TG.refreshLevelBadge();
    renderAll(container, canvas);
  }

  function excursion(S, a, b, ep) {
    let mae = 0, mfe = 0;
    for (let i = a; i <= b; i++) { const k = S.klines[i]; mae = Math.max(mae, ep - k.l); mfe = Math.max(mfe, k.h - ep); }
    return { mae, mfe };
  }

  function computeScore() {
    const S = M.S, rounds = S.rounds, n = rounds.length;
    let buySum = 0, riskSum = 0;
    rounds.forEach((r) => {
      const risk = r.stop ? Math.abs(r.entryPrice - r.stop) : r.entryPrice * TG.DEFAULT_RISK;
      const { mae, mfe } = excursion(S, r.entryIdx, r.exitIdx, r.entryPrice);
      buySum += TG.clamp(50 + 50 * (mfe - mae) / Math.max(risk, 1e-6), 0, 100);
      let rs = 0;
      rs += r.stop ? 25 : 0;
      rs += (r.stop && r.exitPrice >= r.stop * 0.98) ? 25 : 0;
      const posPct = (r.shares * r.entryPrice) / TG.CAPITAL * 100;
      rs += posPct <= 30 ? 25 : posPct <= 50 ? 15 : posPct <= 70 ? 5 : 0;
      rs += r.avgDown ? 0 : 25;
      riskSum += TG.clamp(rs, 0, 100);
    });
    const buyAvg = n ? buySum / n : 50, riskAvg = n ? riskSum / n : 50;
    let discipline = 100;
    if (n === 0) discipline = 70;
    else {
      const barsTraded = S.cursor - S.startIdx;
      const over = Math.max(0, n - Math.max(3, barsTraded / 120));
      discipline -= over * 8;
      discipline -= (rounds.filter((r) => r.avgDown).length / n) * 30;
      discipline -= (rounds.filter((r) => r.stopHit).length / n) * 25;
    }
    discipline = TG.clamp(discipline, 0, 100);
    const totalPnl = rounds.reduce((s, r) => s + r.pnl, 0);
    const outcomePct = totalPnl / TG.CAPITAL * 100;
    const outcome = TG.clamp(50 + outcomePct * 4, 0, 100);
    const overall = 0.30 * buyAvg + 0.30 * riskAvg + 0.25 * discipline + 0.15 * outcome;
    const wins = rounds.filter((r) => r.pnl > 0), losses = rounds.filter((r) => r.pnl <= 0);
    const winRate = n ? wins.length / n : 0;
    const avgWin = wins.length ? wins.reduce((s, r) => s + r.R, 0) / wins.length : 0;
    const avgLoss = losses.length ? losses.reduce((s, r) => s + r.R, 0) / losses.length : 0;
    const pf = avgLoss !== 0 ? Math.abs(avgWin / avgLoss) : (wins.length ? Infinity : 0);
    const avgHold = n ? rounds.reduce((s, r) => s + r.holding, 0) / n : 0;
    let eq = TG.CAPITAL, peak = TG.CAPITAL, maxDD = 0;
    rounds.forEach((r) => { eq += r.pnl; peak = Math.max(peak, eq); maxDD = Math.max(maxDD, (peak - eq) / peak); });
    return { overall, buyAvg, riskAvg, discipline, outcome, outcomePct, winRate, pf, avgHold, maxDD, totalPnl, n, weak: analyzeWeakness() };
  }

  function analyzeWeakness() {
    const S = M.S, rounds = S.rounds;
    if (!rounds.length) return [{ w: "无完整交易", sev: 0, tip: "完成至少一次「开仓→平仓」回合，系统才能识别你的交易弱点。" }];
    const out = [];
    let chase = 0;
    rounds.forEach((r) => {
      const s = Math.max(0, r.entryIdx - 20); let hi = -Infinity, lo = Infinity;
      for (let i = s; i <= r.entryIdx; i++) { hi = Math.max(hi, S.klines[i].h); lo = Math.min(lo, S.klines[i].l); }
      const range = hi - lo;
      if (range > 0 && (r.entryPrice - lo) / range > 0.9 && r.entryPrice >= hi * 0.995) chase++;
    });
    if (chase) out.push({ w: "喜欢追高", sev: chase, tip: `有 ${chase} 笔在阶段高位追入，回撤风险大。训练：等回踩确认再动手。` });
    let bottom = 0;
    rounds.forEach((r) => {
      const s = Math.max(0, r.entryIdx - 20); let sum = 0, cnt = 0;
      for (let i = s; i < r.entryIdx; i++) { sum += S.klines[i].c; cnt++; }
      const ma = cnt ? sum / cnt : r.entryPrice; const k = S.klines[r.entryIdx];
      const lows = S.klines.slice(s, r.entryIdx + 1).map((x) => x.l);
      if (r.entryPrice < ma && k.l <= Math.min(...lows)) bottom++;
    });
    if (bottom) out.push({ w: "爱抄底/逆势", sev: bottom, tip: `有 ${bottom} 笔在下跌趋势中接飞刀。训练：只在结构企稳、放量反包后介入。` });
    const slow = rounds.filter((r) => r.stop && r.stopHit && r.exitPrice < r.stop * 0.98).length;
    if (slow) out.push({ w: "止损过慢", sev: slow, tip: `有 ${slow} 笔跌破止损后仍持有、扩大亏损。训练：触发即走。` });
    const big = rounds.filter((r) => (r.shares * r.entryPrice) / TG.CAPITAL > 0.5).length;
    if (big) out.push({ w: "仓位过大", sev: big, tip: `有 ${big} 笔单笔仓位>50%。训练：单笔风险≤2%本金，仓位≤30%。` });
    let early = 0;
    rounds.forEach((r) => {
      const { mfe } = excursion(S, r.entryIdx, r.exitIdx, r.entryPrice);
      const risk = r.stop ? Math.abs(r.entryPrice - r.stop) : r.entryPrice * TG.DEFAULT_RISK;
      const mfeR = risk ? mfe / risk : 0;
      if (r.R > 0 && r.R < 0.5 && mfeR > 1.5) early++;
    });
    if (early) out.push({ w: "拿不住盈利/过早止盈", sev: early, tip: `有 ${early} 笔在还有很大空间时就跑了。训练：让利润奔跑，用移动止损替代固定止盈。` });
    const avgD = rounds.filter((r) => r.avgDown).length;
    if (avgD) out.push({ w: "逆势加仓", sev: avgD, tip: `有 ${avgD} 笔在亏损中加仓。训练：只在盈利头寸上加码。` });
    if (rounds.length > 6) out.push({ w: "过度交易", sev: rounds.length, tip: `本期 ${rounds.length} 个回合偏多。训练：只做高确定性信号。` });
    out.sort((a, b) => b.sev - a.sev);
    return out;
  }

  function renderAll(container, canvas) {
    if (!container) return;
    const S = M.S, $ = (id) => container.querySelector("#" + id);
    const k = cur(S);
    $("m1date").textContent = k.date;
    const up = k.c >= k.o; $("m1price").textContent = TG.fmt(k.c); $("m1price").style.color = up ? "var(--up)" : "var(--down)";
    if (S.position) {
      const p = S.position, unreal = (cur(S).c - p.avgPrice) * p.shares, pp = (p.shares * cur(S).c) / S.capital * 100;
      $("m1posv").textContent = "多头 " + pp.toFixed(0) + "%";
      const u = $("m1pnl"); u.textContent = (unreal >= 0 ? "+" : "") + TG.fmtMoney(unreal); u.style.color = unreal >= 0 ? "var(--up)" : "var(--down)";
    } else { $("m1posv").textContent = "空仓"; $("m1pnl").textContent = "-"; $("m1pnl").style.color = "var(--txt)"; }
    $("m1bars").textContent = (S.cursor + 1) + " / " + S.klines.length;
    $("m1cap").textContent = TG.fmtMoney(S.capital);
    ["m1rv1", "m1rv5", "m1rv20"].forEach((id) => { $(id).disabled = S.cursor >= S.klines.length - 1 || S.settled; });
    renderLog(container);
    renderChart(canvas);
  }

  function renderLog(container) {
    const S = M.S, box = container.querySelector("#m1log");
    if (!S.trades.length) { box.innerHTML = '<div class="empty">暂无操作记录</div>'; return; }
    box.innerHTML = S.trades.slice().reverse().map((t) => {
      const cls = (t.type === "buy" || t.type === "add") ? "buy" : (t.type === "sell" || t.type === "reduce") ? "sell" : "observe";
      let head = "", body = "";
      if (t.type === "buy") { head = "🟥 买入/开仓"; body = `仓位 ${t.posPct}% · 价 ${TG.fmt(t.price)} · 止损 ${t.stop ? TG.fmt(t.stop) : "无"} · 目标 ${t.target ? TG.fmt(t.target) : "无"}\n${t.reason}`; }
      else if (t.type === "add") { head = "🟥 加仓"; body = `+${t.addPct}% · 新均价 ${TG.fmt(t.avgPrice)}${t.avgDown ? " · ⚠逆势加仓" : ""}${t.note ? "\n" + t.note : ""}`; }
      else if (t.type === "reduce") { head = "🟥 减仓"; body = `卖出 ${t.sellShares.toFixed(0)}股 · 实现 ${(t.pnl >= 0 ? "+" : "") + TG.fmtMoney(t.pnl)}${t.note ? "\n" + t.note : ""}`; }
      else if (t.type === "sell") { head = "🟩 清仓/平仓"; body = `价 ${TG.fmt(t.price)} · 实现 ${(t.pnl >= 0 ? "+" : "") + TG.fmtMoney(t.pnl)} · R=${t.R.toFixed(2)}${t.note ? "\n" + t.note : ""}`; }
      else { head = "👁 观察"; body = t.note; }
      return `<div class="log-item ${cls}"><div class="t">${t.date} · 第${t.idx + 1}根</div><div class="h">${head}</div><div class="d">${TG.escapeHtml(body)}</div></div>`;
    }).join("");
  }

  function renderChart(canvas) {
    if (!canvas) return;
    const S = M.S;
    const viewStart = Math.max(0, S.cursor - TG.WINDOW + 1);
    const markers = [], lines = [];
    if (S.position) {
      markers.push({ idx: S.position.entryIdx, price: S.position.avgPrice, color: "#f0495b", dir: "up" });
      if (S.position.stop) lines.push({ price: S.position.stop, color: "rgba(248,81,73,0.7)", dash: [4, 3] });
      if (S.position.target) lines.push({ price: S.position.target, color: "rgba(56,139,253,0.7)", dash: [4, 3] });
    }
    TG.drawCandles(canvas, S.klines, { viewStart, hideFutureFrom: S.cursor, markers, lines, crosshair: true });
  }

  function renderScore(sc) {
    const S = M.S; if (!S._container) return;
    const box = S._container.querySelector("#m1result");
    const grade = overallGrade(sc.overall);
    const weakHtml = sc.weak.length ? sc.weak.map((w) => `<div class="weak"><div class="w">⚠ ${w.w}${w.sev ? " ×" + w.sev : ""}</div><div class="note2">${w.tip}</div></div>`).join("") : '<div class="note2">本期未发现明显弱点，保持。</div>';
    box.innerHTML = `
      <div class="score-card"><div class="dim"><span>综合训练分</span><span class="tag">${grade}</span></div>
        <div class="big">${sc.overall.toFixed(1)}<span style="font-size:14px;color:var(--muted)"> / 100</span></div>
        <div class="bar"><i style="width:${sc.overall}%"></i></div></div>
      ${dimBar("买点质量 (30%)", sc.buyAvg)}
      ${dimBar("风险控制 (30%)", sc.riskAvg)}
      ${dimBar("纪律执行 (25%)", sc.discipline)}
      ${dimBar("收益表现 (15%)", sc.outcome)}
      <div class="score-card">
        <div class="dim"><span>胜率</span><b>${(sc.winRate * 100).toFixed(0)}%</b></div>
        <div class="dim"><span>盈亏比 (R)</span><b>${isFinite(sc.pf) ? sc.pf.toFixed(2) : "∞"}</b></div>
        <div class="dim"><span>平均持仓</span><b>${sc.avgHold.toFixed(0)} 根</b></div>
        <div class="dim"><span>最大回撤</span><b>${(sc.maxDD * 100).toFixed(1)}%</b></div>
        <div class="dim"><span>本期盈亏</span><b style="color:${sc.totalPnl >= 0 ? "var(--up)" : "var(--down)"}">${(sc.totalPnl >= 0 ? "+" : "") + TG.fmtMoney(sc.totalPnl)}</b></div>
      </div>
      <div class="dim" style="margin-top:10px"><span><b>个人交易弱点排行</b></span></div>${weakHtml}
      <div class="note2" style="margin-top:10px">评分看<b>决策质量</b>而非结果：正确交易允许亏钱，错误交易赚了也扣分。权重：买点30% · 风控30% · 纪律25% · 收益15%。</div>`;
  }

  function dimBar(name, v) {
    const c = v >= 75 ? "var(--good)" : v >= 50 ? "var(--accent)" : "var(--warn)";
    return `<div class="score-card" style="padding:10px"><div class="dim"><span>${name}</span><b>${v.toFixed(1)}</b></div><div class="bar"><i style="width:${v}%;background:${c}"></i></div></div>`;
  }
  function overallGrade(v) {
    if (v >= 90) return "职业交易员"; if (v >= 80) return "大师"; if (v >= 70) return "钻石";
    if (v >= 60) return "黄金"; if (v >= 50) return "白银"; return "青铜";
  }
  function showModal(sc) {
    const S = M.S, grade = overallGrade(sc.overall);
    const pv = sc.n > 0 ? (sc.totalPnl < 0 && sc.overall >= 60 ? "✅ 本期亏损但决策质量合格——好交易允许亏钱，坚持你的系统。"
      : sc.totalPnl > 0 && sc.overall < 50 ? "⚠ 本期盈利但决策质量偏低——坏交易赚的钱不可持续。" : "本期结果与过程基本匹配。")
      : "本期无完整交易，建议下一期务必完成至少一次开仓→平仓。";
    TG.modal(`<h2>训练结算 · ${grade}</h2>
      <div class="note2">${S.stock.name} (${S.code}) · 训练区间 ${S.klines[S.startIdx].date} → ${S.klines[S.cursor].date}</div>
      <div style="font-size:42px;font-weight:800;margin:10px 0">${sc.overall.toFixed(1)} <span style="font-size:16px;color:var(--muted)">/ 100</span></div>
      ${dimBar("买点质量", sc.buyAvg)}${dimBar("风险控制", sc.riskAvg)}${dimBar("纪律执行", sc.discipline)}${dimBar("收益表现", sc.outcome)}
      <div class="score-card"><div class="note2"><b>过程 vs 结果：</b>${pv}</div></div>
      <button class="btn-primary" style="width:100%;margin-top:8px" onclick="TG.closeModal()">查看详细评分 →</button>`);
  }

  function num(v, def) { const n = parseFloat(v); return isNaN(n) ? def : n; }

  TG.register({
    id: "blind", title: "K线盲测训练", icon: "🎯",
    desc: "只看到当前日期之前的数据，逐步揭示。训练买点、风控、纪律——而非盈亏。",
    render,
  });
  TG.addNav("blind");
})();
