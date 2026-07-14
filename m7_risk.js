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
    { name: "业绩超预期", desc: "财报大超预期，跳空高开并站稳，量能温和放大，趋势性机会初现。", correct: "持有", expl: "业绩驱动的趋势性机会可顺势持有，并用移动止盈锁利；避免在连续大涨后追高重仓。" },
    { name: "缩量阴跌", desc: "无明显利空，但股价连日缩量小阴下行，重心不断下移，迟迟不见止跌。", correct: "减仓", expl: "阴跌最磨人且易加速。应减仓控制暴露，等出现放量止跌/反包信号再回补，不在下跌途中接飞刀。" },
    { name: "涨停炸板", desc: "早盘强势封板，盘中突然开板并一路回落，当日浮盈大幅回吐。", correct: "减仓", expl: "封板失败（炸板）是强势转弱信号。当日浮盈应先减仓，若次日不及预期则清仓，不心存幻想。" },
    { name: "低位放量长阳", desc: "长期下跌后，某日突然放巨量拉出长阳，一举站上关键均线。", correct: "持有", expl: "低位放量长阳是启动信号，可建立底仓并把止损设在阳线低点；首根长阳不追满，等回踩确认再加。" },
    { name: "大盘跳水个股抗跌", desc: "指数盘中剧烈跳水，但你的持仓仅微跌、甚至逆势翻红，明显有资金承接。", correct: "持有", expl: "个股相对大盘抗跌说明有资金护盘/承接，可持有观察；若随后补跌破位，则果断止损。" },
    { name: "假突破诱多", desc: "股价看似突破平台创高，你刚追入，次日却迅速跌回突破位下方并继续走弱。", correct: "减仓", expl: "突破失败快速回落，先减仓降低风险；若确认破位（跌破前低/平台），再止损离场，不摊平。" },
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
    if ((correct === "持有" && guess === "减仓") || (correct === "减仓" && guess === "持有")) return 60;
    if (guess === "持有" || guess === "减仓") return 20;
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
