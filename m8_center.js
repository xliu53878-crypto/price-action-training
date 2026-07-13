/* 模块8/9/10：交易日志 / 错误分析 / 成长系统（汇总中心） */
(function () {
  "use strict";
  const TG = window.TG;
  const MOD = { blind: "K线盲测", breakout: "真突破", pa: "PriceAction", market: "市场结构", sector: "板块轮动", position: "仓位管理", risk: "风险控制" };
  const M = { tab: "log", filter: "all" };

  function render(container) {
    const prof = TG.computeProfile();
    container.innerHTML = `
      <div class="hud">
        <div class="cell"><div class="k">总训练次数</div><div class="v">${prof.total}</div></div>
        <div class="cell"><div class="k">综合均分</div><div class="v">${prof.overall.toFixed(1)}</div></div>
        <div class="cell"><div class="k">总正确率</div><div class="v">${(prof.correctRate * 100).toFixed(0)}%</div></div>
        <div class="cell"><div class="k">训练天数</div><div class="v">${prof.days}</div></div>
        <div class="cell"><div class="k">最长连训</div><div class="v">${prof.streak}天</div></div>
        <div class="cell"><div class="k">当前等级</div><div class="v" style="color:var(--accent)">${prof.level}</div></div>
      </div>
      <div class="row" style="margin:4px 0">
        <button class="btn c8-tab ${M.tab === "log" ? "btn-primary" : ""}" data-t="log">📓 交易日志</button>
        <button class="btn c8-tab ${M.tab === "weak" ? "btn-primary" : ""}" data-t="weak">🔍 错误分析</button>
        <button class="btn c8-tab ${M.tab === "grow" ? "btn-primary" : ""}" data-t="grow">🏅 成长系统</button>
      </div>
      <div id="m8pane"></div>`;
    container.querySelectorAll(".c8-tab").forEach((b) => b.onclick = () => { M.tab = b.dataset.t; render(container); });
    if (M.tab === "log") renderLog(container);
    else if (M.tab === "weak") renderWeak(container);
    else renderGrow(container);
  }

  // ---- 交易日志 ----
  function renderLog(container) {
    const recs = TG.getRecords().slice().reverse();
    const filterHtml = `<select id="m8f"><option value="all">全部模块</option>${Object.entries(MOD).map(([k, v]) => `<option value="${k}">${v}</option>`).join("")}</select>`;
    const pane = container.querySelector("#m8pane");
    pane.innerHTML = `
      <div class="row" style="margin-bottom:8px"><span>筛选：</span>${filterHtml}
        <button class="btn btn-warn" id="m8clear" style="margin-left:auto">🗑 清空记录</button></div>
      <div id="m8list"></div>`;
    const $ = (id) => pane.querySelector("#" + id);
    const draw = () => {
      const f = $("m8f").value;
      const list = recs.filter((r) => f === "all" || r.mod === f);
      if (!list.length) { $("m8list").innerHTML = '<div class="empty">暂无记录。去各训练模块练几把吧。</div>'; return; }
      $("m8list").innerHTML = `<table class="tbl"><thead><tr><th>日期</th><th>模块</th><th>得分</th><th>结果</th><th>关键指标</th></tr></thead><tbody>`
        + list.map((r) => `<tr><td>${r.date}</td><td>${MOD[r.mod] || r.mod}</td><td>${r.score.toFixed(1)}</td>
          <td><span class="pill ${r.correct ? "ok" : "no"}">${r.correct ? "✓" : "✗"}</span></td>
          <td>${detailText(r)}</td></tr>`).join("") + `</tbody></table>`;
    };
    $("m8f").onchange = draw;
    $("m8clear").onclick = () => { if (window.confirm("确定清空全部训练记录？此操作不可恢复。")) { TG.clearRecords(); TG.refreshLevelBadge(); render(container); } };
    draw();
  }
  function detailText(r) {
    const d = r.detail || {};
    if (r.mod === "blind") return `回合${d.n || 0} · 胜率${((d.winRate || 0) * 100).toFixed(0)}% · 回撤${((d.maxDD || 0) * 100).toFixed(1)}%`;
    if (r.mod === "breakout") return `判断${d.prob}% · ${d.isTrue ? "真突破" : "假突破"}`;
    if (r.mod === "pa" || r.mod === "market" || r.mod === "sector") return `${d.guess || ""} → ${d.answer || ""}`;
    if (r.mod === "position") return `${d.traded ? "交易@" + d.pos + "%" : "放弃"} · 风险${((d.riskPct || 0).toFixed(2))}%`;
    if (r.mod === "risk") return `${d.guess || ""} → ${d.answer || ""}`;
    return "";
  }

  // ---- 错误分析 ----
  function renderWeak(container) {
    const recs = TG.getRecords();
    const tagCount = {};
    recs.forEach((r) => (r.tags || []).forEach((t) => { tagCount[t] = (tagCount[t] || 0) + 1; }));
    const sorted = Object.entries(tagCount).sort((a, b) => b[1] - a[1]).slice(0, 10);
    const prof = TG.computeProfile();
    const modRows = Object.entries(prof.modAvg).map(([k, v]) => `<tr><td>${MOD[k] || k}</td><td>${v.n}</td>
      <td>${v.score.toFixed(1)}</td><td><span class="pill ${v.correct >= 0.6 ? "ok" : "no"}">${(v.correct * 100).toFixed(0)}%</span></td></tr>`).join("");
    const weakHtml = sorted.length ? sorted.map(([t, c]) => {
      const isWeak = /错|追高|抄底|止损过慢|仓位过大|过早|逆势|过度/.test(t);
      return `<div class="${isWeak ? "weak" : "score-card"}" style="${isWeak ? "" : "padding:8px"}"><div class="w">${t} <span class="pill ${isWeak ? "no" : "ok"}">×${c}</span></div></div>`;
    }).join("") : '<div class="empty">暂无足够数据，多练几把才能识别你的弱点。</div>';
    container.querySelector("#m8pane").innerHTML = `
      <div class="card"><div class="dim"><span><b>个人交易弱点排行</b>（按出现次数）</span></div>${weakHtml}</div>
      <div class="card"><div class="dim"><span><b>各模块正确率</b>（越低越需加强）</span></div>
        <table class="tbl"><thead><tr><th>模块</th><th>次数</th><th>均分</th><th>正确率</th></tr></thead><tbody>${modRows}</tbody></table></div>`;
  }

  // ---- 成长系统 ----
  function renderGrow(container) {
    const prof = TG.computeProfile();
    const bo = prof.modAvg.breakout ? prof.modAvg.breakout.correct : 0;
    const risk = prof.modAvg.risk ? prof.modAvg.risk.score : 0;
    const blind = prof.modAvg.blind ? prof.modAvg.blind.score : 0;
    const ladder = [
      { name: "白银", ok: prof.total >= 10, req: "累计训练 ≥ 10 次" },
      { name: "黄金", ok: prof.total >= 30 && prof.overall >= 60, req: "≥30次 且 综合均分≥60" },
      { name: "钻石", ok: prof.total >= 60 && prof.overall >= 70 && bo >= 0.65, req: "≥60次 · 均分≥70 · 突破识别率≥65%" },
      { name: "大师", ok: prof.total >= 100 && prof.overall >= 78 && risk >= 80, req: "≥100次 · 均分≥78 · 风控评分≥80" },
      { name: "职业交易员", ok: prof.total >= 150 && prof.overall >= 85 && blind >= 85 && prof.streak >= 30, req: "≥150次 · 均分≥85 · 纪律≥85 · 连续训练≥30天" },
    ];
    const idx = TG.LEVELS.indexOf(prof.level);
    const nextL = ladder[idx];
    const ladderHtml = TG.LEVELS.map((lv, i) => {
      const done = i <= idx; const cur = i === idx;
      return `<div class="score-card" style="padding:8px;${cur ? "border-color:var(--accent)" : ""}">
        <span class="pill ${done ? "ok" : "no"}">${done ? "✓" : (i === idx + 1 ? "▶" : "")}</span>
        <b style="margin-left:6px">${lv}</b> ${cur ? '<span class="tag">当前</span>' : ''}
        ${i < ladder.length ? `<div class="note2" style="margin-top:2px">${ladder[i].req}</div>` : ''}
      </div>`;
    }).join("");
    container.querySelector("#m8pane").innerHTML = `
      <div class="score-card"><div class="big">${prof.level}</div>
        <div class="note2">${nextL ? "下一阶：" + nextL.name + " — " + nextL.req : "已满级 🎉"}</div>
        <div class="bar" style="margin-top:8px"><i style="width:${Math.min(100, prof.overall)}%;background:var(--accent)"></i></div>
      </div>
      <div class="card"><div class="dim"><span><b>等级阶梯</b></span></div>${ladderHtml}</div>
      <div class="note2">升级靠<b>长期正确</b>而非短期盈利：多模块均衡训练、保持连续打卡，才能稳定进阶。</div>`;
  }

  TG.register({ id: "center", title: "成长中心", icon: "🏅", desc: "交易日志汇总、个人弱点排行、等级成长系统（青铜→职业交易员）。", render });
  TG.addNav("center");
})();
