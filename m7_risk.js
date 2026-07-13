/* 模块7：风险控制训练 */
(function () {
  "use strict";
  const TG = window.TG;
  const ACTIONS = ["止损", "持有", "加仓", "减仓"];
  const SCEN = [
    { name: "黑天鹅事件", desc: "盘中出现突发的重大系统性利空（政策突变/地缘冲突/流动性危机），持仓快速跳水，方向对你极为不利。", correct: "止损", expl: "黑天鹅不可预测、不可扛。职业做法：第一时间砍仓离场，保住本金才有下一次机会。硬扛可能归零。" },
    { name: "连续跌停", desc: "持仓已连续两个跌停板，封单巨大、流动性枯竭，你排在最末等待卖出。", correct: "止损", expl: "连续跌停是流动性危机，越晚跑亏越多。应挂跌停价排队卖出，绝不补仓摊薄成本——那只会越陷越深。" },
    { name: "业绩暴雷", desc: "盘后财报大幅不及预期/商誉减值/被立案调查，明日大概率大幅低开。", correct: "止损", expl: "基本面逻辑被破坏，估值重构。应在利空充分定价前离场，不要用‘长期价值’安慰自己死扛。" },
    { name: "高开低走", desc: "利好公布后大幅高开，但开盘后一路走低收出长上影，量能放大，典型的‘利好兑现/诱多’。", correct: "减仓", expl: "利好出尽是利空。若已获利，应大幅减仓锁定利润；若追高被套，至少减仓降低风险，不追加。" },
    { name: "放量破位", desc: "股价放量跌穿关键支撑位（平台/均线/前低），形态走坏，恐慌盘涌出。", correct: "止损", expl: "破位放量是最经典的离场信号。支撑一旦跌破，下方空间打开，严守纪律止损，不赌反抽。" },
  ];
  const M = { cur: null };

  function render(container) {
    if (window.__TG_TEST_MODE__) (window.__TG_TEST__ = window.__TG_TEST__ || {})["risk"] = M;
    const sc = SCEN[Math.floor(Math.random() * SCEN.length)]; M.cur = sc; M.pick = null;
    container.innerHTML = `
      <div class="scenario">⚠️ <b>场景：${sc.name}</b><br>${sc.desc}</div>
      <div class="card"><label>作为职业交易员，你选择：</label>
        <div class="opts c4" id="m7opts"></div>
        <div class="row" style="margin-top:12px"><button class="btn-primary" id="m7submit">提交决策</button>
          <button class="btn" id="m7next">🎲 下一题</button></div></div>
      <div id="m7result"></div>`;
    const $ = (id) => container.querySelector("#" + id);
    $("m7opts").innerHTML = ACTIONS.map((a) => `<div class="opt" data-o="${a}">${a}</div>`).join("");
    $("m7opts").querySelectorAll(".opt").forEach((el) => el.onclick = () => { $("m7opts").querySelectorAll(".opt").forEach((x) => x.classList.remove("sel")); el.classList.add("sel"); M.pick = el.dataset.o; });
    $("m7submit").onclick = () => submit(container);
    $("m7next").onclick = () => render(container);
  }

  function score(guess, correct) {
    if (guess === correct) return 100;
    if ((correct === "止损" && guess === "减仓") || (correct === "减仓" && guess === "止损")) return 60;
    if (guess === "持有") return 20;
    return 0; // 加仓
  }

  function submit(container) {
    const sc = M.cur; if (!M.pick) { alert("请选择一个动作。"); return; }
    const correct = M.pick === sc.correct;
    const sc2 = score(M.pick, sc.correct);
    const $ = (id) => container.querySelector("#" + id);
    $("m7submit").disabled = true; $("m7next").disabled = false;
    TG.logResult({ mod: "risk", score: sc2, correct, tags: ["风控:" + (correct ? "对" : "错")], detail: { guess: M.pick, answer: sc.correct } });
    TG.refreshLevelBadge();
    $("m7result").innerHTML = `<div class="score-card"><div class="dim"><span>职业决策</span><b>${sc.correct}</b></div>
      <div class="dim"><span>你的选择</span><b>${M.pick}</b></div>
      <div class="dim"><span>得分</span><b>${sc2}</b></div></div>
      <div class="note2" style="margin-top:8px">${sc.expl}</div>`;
  }

  TG.register({ id: "risk", title: "风险控制训练", icon: "⚠️", desc: "面对黑天鹅/连续跌停/业绩暴雷/高开低走/放量破位，做出职业交易员的风控决策。", render });
  TG.addNav("risk");
})();
