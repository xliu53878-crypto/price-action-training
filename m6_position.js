/* 模块6：仓位管理训练 */
(function () {
  "use strict";
  const TG = window.TG;
  const M = { cur: null };

  function genCase() {
    const stop = [3, 4, 5, 7, 10][Math.floor(Math.random() * 5)];
    const target = [8, 10, 15, 20, 25][Math.floor(Math.random() * 5)];
    const winrate = [40, 45, 50, 55, 60, 65][Math.floor(Math.random() * 6)];
    const exp = winrate * target - (100 - winrate) * stop; // 每100元风险对应的期望收益（元）
    const optimal = TG.clamp(2 / stop * 100, 1, 100); // 单笔风险2% → 仓位%
    return { capital: 1000000, stop, target, winrate, exp, shouldTrade: exp > 0, optimal };
  }

  function render(container) {
    if (window.__TG_TEST_MODE__) (window.__TG_TEST__ = window.__TG_TEST__ || {})["position"] = M;
    const c = genCase(); M.cur = c; M.pick = null; M.pos = 30;
    container.innerHTML = `
      <div class="scenario">💼 账户资金 <b>100万</b>。系统给定以下参数，请决定<b>是否交易</b>与<b>仓位大小</b>。</div>
      <div class="card"><div class="hud">
        <div class="cell"><div class="k">止损幅度</div><div class="v" style="color:var(--down)">-${c.stop}%</div></div>
        <div class="cell"><div class="k">目标幅度</div><div class="v" style="color:var(--up)">+${c.target}%</div></div>
        <div class="cell"><div class="k">历史胜率</div><div class="v">${c.winrate}%</div></div>
        <div class="cell"><div class="k">期望值</div><div class="v" style="color:${c.exp >= 0 ? "var(--up)" : "var(--down)"}">${c.exp >= 0 ? "+" : ""}${c.exp.toFixed(1)}</div></div>
      </div></div>
      <div class="card"><label>决策</label>
        <div class="opts c2" id="m6dec">
          <div class="opt" data-o="trade">✅ 参与交易</div>
          <div class="opt" data-o="abandon">🚫 放弃（空仓）</div>
        </div>
        <div id="m6posbox" style="margin-top:10px;display:none"><label>仓位大小（%）：<span id="m6posv">30</span>%</label>
          <input type="range" id="m6pos" min="1" max="100" value="30" style="width:100%">
          <div class="row" style="margin-top:6px">
            <button class="btn" data-p="10">10%</button><button class="btn" data-p="20">20%</button>
            <button class="btn" data-p="30">30%</button><button class="btn" data-p="40">40%</button>
            <button class="btn" data-p="50">50%</button><button class="btn" data-p="70">70%</button>
          </div>
        </div>
        <div class="row" style="margin-top:12px"><button class="btn-primary" id="m6submit">提交</button>
          <button class="btn" id="m6next">🎲 下一题</button></div>
      </div>
      <div id="m6result"></div>`;
    const $ = (id) => container.querySelector("#" + id);
    $("m6dec").querySelectorAll(".opt").forEach((el) => el.onclick = () => {
      $("m6dec").querySelectorAll(".opt").forEach((x) => x.classList.remove("sel")); el.classList.add("sel");
      M.pick = el.dataset.o; $("m6posbox").style.display = (M.pick === "trade") ? "" : "none";
    });
    const pos = $("m6pos");
    pos.oninput = () => { M.pos = parseInt(pos.value, 10); $("m6posv").textContent = pos.value; };
    $("m6posbox").querySelectorAll("button[data-p]").forEach((b) => b.onclick = () => { pos.value = b.dataset.p; M.pos = parseInt(b.dataset.p, 10); $("m6posv").textContent = b.dataset.p; });
    $("m6submit").onclick = () => submit(container);
    $("m6next").onclick = () => render(container);
  }

  function submit(container) {
    const c = M.cur; if (!M.pick) { alert("请先选择是否交易。"); return; }
    const traded = M.pick === "trade";
    const decisionCorrect = (c.shouldTrade && traded) || (!c.shouldTrade && !traded);
    let score, posGood = false, riskPct = 0;
    if (!traded) score = decisionCorrect ? 100 : 30;
    else {
      riskPct = M.pos * c.stop / 100; // 占本金比例%
      posGood = riskPct <= 2.5 && M.pos <= c.optimal * 1.6 && M.pos >= c.optimal * 0.5;
      score = (decisionCorrect ? 60 : 20) + (posGood ? 40 : (riskPct > 2.5 ? 0 : 20));
    }
    score = TG.clamp(score, 0, 100);
    const $ = (id) => container.querySelector("#" + id);
    $("m6submit").disabled = true; $("m6next").disabled = false;
    const expl = `期望值 = 胜率×目标 − 失败率×止损 = ${c.winrate}×${c.target} − ${100 - c.winrate}×${c.stop} = ${c.exp >= 0 ? "+" : ""}${c.exp.toFixed(1)}。` +
      (c.shouldTrade ? ` 期望为正，应参与。` : ` 期望为负，长期必亏，应放弃。`) +
      (traded ? ` 单笔风险 = 仓位×止损 = ${M.pos}%×${c.stop}% = ${riskPct.toFixed(2)}% 本金（职业要求≤2%）。最优仓位≈${c.optimal.toFixed(0)}%。` : ``);
    TG.logResult({ mod: "position", score, correct: decisionCorrect, tags: ["仓位:" + (decisionCorrect ? "对" : "错")], detail: { traded, pos: M.pos, riskPct } });
    TG.refreshLevelBadge();
    $("m6result").innerHTML = `<div class="score-card"><div class="dim"><span>正确决策</span><b>${c.shouldTrade ? "参与交易" : "放弃"}</b></div>
      <div class="dim"><span>你的选择</span><b>${traded ? "交易 @" + M.pos + "%" : "放弃"}</b></div>
      <div class="dim"><span>得分</span><b>${score.toFixed(1)}</b></div></div>
      <div class="note2" style="margin-top:8px">${expl}</div>`;
  }

  TG.register({ id: "position", title: "仓位管理训练", icon: "💼", desc: "给定止损/目标/胜率，决定参与与否与仓位大小。训练风险收益比与最大回撤控制。", render });
  TG.addNav("position");
})();
