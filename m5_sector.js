/* 模块5：板块轮动训练 */
(function () {
  "use strict";
  const TG = window.TG;
  const OPTS = ["回流主线", "高低切换", "新题材启动", "情绪退潮"];
  const M = { cur: null, revealed: false };

  const mean = (a) => a.reduce((s, x) => s + x, 0) / a.length;

  function snap(p) {
    const dateMap = TG._marketDateMap, dates = TG._marketDates;
    if (!dateMap || p + 1 >= dates.length) return null;
    const stocks = window.MARKET_DATA;
    const today = dateMap[dates[p]], next = dateMap[dates[p + 1]];
    const sec = {}; // sector -> {ch:[], lu:0, top:{name,ch}}
    const add = (arr, isNext) => arr.forEach(({ s, idx }) => {
      const ch = s.klines[idx].c / s.klines[idx - 1].c - 1;
      const sector = TG.SECTORS[s.code] || "其他";
      const b = (sec[sector] = sec[sector] || { ch: [], lu: 0, top: { name: s.name, ch: -Infinity } });
      if (!isNext) {
        b.ch.push(ch * 100);
        if (ch >= 0.095) b.lu++;
        if (ch * 100 > b.top.ch) b.top = { name: s.name, ch: ch * 100 };
      } else { b.next = (b.next || []).concat(ch * 100); }
    });
    add(today, false); add(next, true);
    const rows = Object.entries(sec).map(([sector, b]) => ({ sector, ch: mean(b.ch), lu: b.lu, top: b.top, next: mean(b.next || [0]) }))
      .sort((a, b) => b.ch - a.ch);
    const todaySec = {}, nextSec = {};
    rows.forEach((r) => { todaySec[r.sector] = r.ch; nextSec[r.sector] = r.next; });
    return { date: dates[p], rows, rotation: classify(todaySec, nextSec) };
  }

  function classify(todaySec, nextSec) {
    const sectors = Object.keys(todaySec);
    const overallNext = mean(sectors.map((s) => nextSec[s]));
    const tS = sectors.slice().sort((a, b) => todaySec[b] - todaySec[a]);
    const nS = sectors.slice().sort((a, b) => nextSec[b] - nextSec[a]);
    const lead = tS[0];
    if (overallNext < -0.5) return "情绪退潮";
    if (nS[0] !== lead && todaySec[nS[0]] < 1 && nextSec[nS[0]] > 2) return "新题材启动";
    if (nS[0] !== lead && nextSec[lead] < todaySec[lead] - 1) return "高低切换";
    if (nS[0] === lead && nextSec[lead] >= 0) return "回流主线";
    return "高低切换";
  }

  function render(container) {
    if (window.__TG_TEST_MODE__) (window.__TG_TEST__ = window.__TG_TEST__ || {})["sector"] = M;
    if (!TG._marketDateMap) { container.innerHTML = '<div class="empty">请先打开「市场结构训练」以构建日期索引。</div>'; return; }
    let p, s = null;
    for (let tries = 0; tries < 30; tries++) {
      p = 5 + Math.floor(Math.random() * (TG._marketDates.length - 12));
      s = snap(p);
      if (s && s.rows.length >= 4) break;
    }
    if (!s) { container.innerHTML = '<div class="empty">样本不足。</div>'; return; }
    // 避免连续重复
    if (M.cur && M.cur.date === s.date && TG._marketDates.length > 10) { return render(container); }
    M.cur = s; M.revealed = false;

    const rowsHtml = s.rows.map((r, i) => `<tr><td>${i + 1}</td><td>${r.sector}</td>
      <td style="color:${r.ch >= 0 ? "var(--up)" : "var(--down)"}">${(r.ch >= 0 ? "+" : "") + r.ch.toFixed(2)}%</td>
      <td>${r.lu ? "🚀" + r.lu : "-"}</td><td>${r.top.name} (${(r.top.ch >= 0 ? "+" : "") + r.top.ch.toFixed(1)}%)</td></tr>`).join("");

    container.innerHTML = `
      <div class="scenario">🧭 <b>${s.date}</b> 板块表现。请预测下一个交易日的<b>资金流向</b>。</div>
      <div class="card"><table class="tbl"><thead><tr><th>#</th><th>板块</th><th>今日涨幅</th><th>涨停</th><th>领涨股</th></tr></thead><tbody>${rowsHtml}</tbody></table></div>
      <div class="card"><div class="opts c4" id="m5opts"></div>
        <div class="row" style="margin-top:12px"><button class="btn-primary" id="m5submit">提交预测</button>
          <button class="btn" id="m5next" disabled>🎲 下一题</button></div></div>
      <div id="m5result"></div>`;
    const $ = (id) => container.querySelector("#" + id);
    $("m5opts").innerHTML = OPTS.map((o) => `<div class="opt" data-o="${o}">${o}</div>`).join("");
    $("m5opts").querySelectorAll(".opt").forEach((el) => el.onclick = () => { $("m5opts").querySelectorAll(".opt").forEach((x) => x.classList.remove("sel")); el.classList.add("sel"); M.pick = el.dataset.o; });
    $("m5submit").onclick = () => submit(container);
    $("m5next").onclick = () => render(container);
  }

  function submit(container) {
    const s = M.cur; if (!M.pick) { alert("请选择一个资金流向。"); return; }
    const correct = M.pick === s.rotation;
    const score = correct ? 100 : 40;
    M.revealed = true;
    const $ = (id) => container.querySelector("#" + id);
    $("m5submit").disabled = true; $("m5next").disabled = false;
    const nextRows = s.rows.slice().sort((a, b) => b.next - a.next).slice(0, 5)
      .map((r) => `${r.sector} ${(r.next >= 0 ? "+" : "") + r.next.toFixed(2)}%`).join("、 ");
    TG.logResult({ mod: "sector", score, correct, tags: ["轮动:" + (correct ? "对" : "错")], detail: { guess: M.pick, answer: s.rotation } });
    TG.refreshLevelBadge();
    $("m5result").innerHTML = `<div class="score-card"><div class="dim"><span>真实流向</span><b>${s.rotation}</b></div>
      <div class="dim"><span>你的预测</span><b>${M.pick}</b></div>
      <div class="dim"><span>得分</span><b>${score}</b></div></div>
      <div class="note2" style="margin-top:8px">次日领涨板块（前5）：${nextRows}。<br>资金总是从高潮板块溢出，寻找下一个载体——识别轮动节奏才能踩准节奏。</div>`;
  }

  TG.register({ id: "sector", title: "板块轮动训练", icon: "🧭", desc: "看行业涨跌幅/连板/龙头，预测下一阶段资金流向（回流主线/高低切换/新题材/退潮）。", render });
  TG.addNav("sector");
})();
