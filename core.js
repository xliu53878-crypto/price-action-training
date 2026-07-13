/* Trading Gym · core.js
 * 全局命名空间 TG、工具函数、跨期持久化、通用K线渲染、模块导航、等级/成长计算。
 */
(function () {
  "use strict";
  const TG = (window.TG = window.TG || {});

  // ---------- 常量 ----------
  TG.LOCK_RATIO = 0.20;
  TG.CAPITAL = 1_000_000;
  TG.WINDOW = 120;
  TG.DEFAULT_RISK = 0.05;

  // ---------- 工具 ----------
  TG.fmt = (n, d = 2) => (n == null || isNaN(n)) ? "-" : Number(n).toLocaleString("zh-CN", { minimumFractionDigits: d, maximumFractionDigits: d });
  TG.fmtMoney = (n) => {
    const a = Math.abs(n);
    if (a >= 1e8) return (n / 1e8).toFixed(2) + "亿";
    if (a >= 1e4) return (n / 1e4).toFixed(2) + "万";
    return (n || 0).toFixed(0) + "元";
  };
  TG.clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  TG.pct = (a, b) => (b ? (a - b) / b : 0);
  TG.escapeHtml = (s) => (s == null ? "" : String(s)).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));

  // ---------- 持久化（localStorage，file:// 下部分浏览器受限则内存兜底）----------
  const KEY = "trading_gym_v1";
  let mem = null;
  function read() {
    if (mem) return mem;
    try {
      const raw = window.localStorage.getItem(KEY);
      mem = raw ? JSON.parse(raw) : { records: [], level: "青铜", created: Date.now() };
    } catch (e) {
      mem = { records: [], level: "青铜", created: Date.now(), _memOnly: true };
    }
    if (!mem.records) mem.records = [];
    return mem;
  }
  function write() {
    try { window.localStorage.setItem(KEY, JSON.stringify(mem)); }
    catch (e) { /* 内存兜底，不持久 */ }
  }
  TG.persistNote = () => (read()._memOnly ? "（当前浏览器在 file:// 下禁用了本地存储，记录仅在本次会话有效；建议用本地服务器运行以获得持久记录）" : "");
  TG.logResult = function (rec) {
    const m = read();
    rec.ts = Date.now();
    rec.date = new Date().toISOString().slice(0, 10);
    m.records.push(rec);
    if (m.records.length > 5000) m.records = m.records.slice(-5000);
    write();
  };
  TG.getRecords = function () { return read().records.slice(); };
  TG.clearRecords = function () { read().records.length = 0; write(); };

  // ---------- 统计 / 等级 ----------
  TG.computeProfile = function () {
    const recs = TG.getRecords();
    const byMod = {};
    let total = recs.length, scoreSum = 0, correct = 0;
    recs.forEach((r) => {
      scoreSum += r.score || 0;
      if (r.correct) correct++;
      const b = (byMod[r.mod] = byMod[r.mod] || { n: 0, score: 0, correct: 0 });
      b.n++; b.score += r.score || 0; if (r.correct) b.correct++;
    });
    const overall = total ? scoreSum / total : 0;
    const correctRate = total ? correct / total : 0;
    const days = new Set(recs.map((r) => r.date)).size;
    // 连续训练天数（按日期升序去重后最长连续）
    const ds = Array.from(new Set(recs.map((r) => r.date))).sort();
    let streak = 0, best = 0, prev = null;
    ds.forEach((d) => {
      if (prev && dayDiff(prev, d) === 1) streak++; else streak = 1;
      best = Math.max(best, streak); prev = d;
    });
    const avg = (b) => (b && b.n ? b.score / b.n : 0);
    const cr = (b) => (b && b.n ? b.correct / b.n : 0);
    const level = calcLevel({ total, overall, correctRate, best, byMod, avg, cr });
    return {
      total, overall, correctRate, days, streak: best, byMod,
      modAvg: Object.fromEntries(Object.entries(byMod).map(([k, b]) => [k, { n: b.n, score: avg(b), correct: cr(b) }])),
      level,
    };
  };
  function dayDiff(a, b) {
    const da = new Date(a), db = new Date(b);
    return Math.round((db - da) / 86400000);
  }
  function calcLevel({ total, overall, correctRate, best, byMod, avg, cr }) {
    const bo = byMod["breakout"], pa = byMod["pa"], risk = byMod["risk"], blind = byMod["blind"];
    const breakoutCorrect = bo ? cr(bo) : 0;
    const riskAvg = risk ? avg(risk) : 0;
    const blindDisc = blind ? avg(blind) : 0; // 用blind综合分近似纪律
    const order = ["青铜", "白银", "黄金", "钻石", "大师", "职业交易员"];
    let lvl = 0;
    if (total >= 10) lvl = 1;
    if (total >= 30 && overall >= 60) lvl = 2;
    if (total >= 60 && overall >= 70 && breakoutCorrect >= 0.65) lvl = 3;
    if (total >= 100 && overall >= 78 && riskAvg >= 80) lvl = 4;
    if (total >= 150 && overall >= 85 && blindDisc >= 85 && best >= 30) lvl = 5;
    return order[lvl];
  }
  TG.LEVELS = ["青铜", "白银", "黄金", "钻石", "大师", "职业交易员"];

  // ---------- 模块注册 ----------
  TG.modules = TG.modules || {};
  TG.register = function (mod) { TG.modules[mod.id] = mod; };
  TG.navOrder = TG.navOrder || [];
  TG.addNav = function (id) { if (!TG.navOrder.includes(id)) TG.navOrder.push(id); };

  // ---------- 导航 ----------
  TG.nav = function (id) {
    const mod = TG.modules[id];
    if (!mod) return;
    document.querySelectorAll(".navbtn").forEach((b) => b.classList.toggle("active", b.dataset.mod === id));
    const main = document.getElementById("main");
    main.scrollTop = 0;
    main.innerHTML = "";
    // 标题
    const head = document.createElement("div");
    head.className = "modhead";
    head.innerHTML = `<div class="mtitle">${mod.icon || ""} ${mod.title}</div><div class="mdesc">${mod.desc || ""}</div>`;
    main.appendChild(head);
    const body = document.createElement("div");
    body.className = "modbody";
    main.appendChild(body);
    mod.render(body);
  };

  // ---------- 弹窗 ----------
  TG.modal = function (html) {
    const box = document.getElementById("modalBox");
    box.innerHTML = html;
    document.getElementById("modal").classList.add("show");
  };
  TG.closeModal = function () { document.getElementById("modal").classList.remove("show"); };

  // ---------- 通用K线渲染 ----------
  // cfg: {viewStart, viewEnd, hideFutureFrom, markers:[{idx,price,color,dir}], lines:[{price,color,dash}], crosshair}
  TG.drawCandles = function (canvas, klines, cfg) {
    cfg = cfg || {};
    const dpr = window.devicePixelRatio || 1;
    const wrap = canvas.parentElement;
    const W = wrap.clientWidth || 800, H = wrap.clientHeight || 480;
    canvas.width = W * dpr; canvas.height = H * dpr;
    canvas.style.width = W + "px"; canvas.style.height = H + "px";
    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    const padL = 54, padT = 10, padB = 22;
    const lock = cfg.hideFutureFrom != null && cfg.hideFutureFrom < klines.length - 1;
    const plotRight = lock ? W * (1 - TG.LOCK_RATIO) : W - 6;
    const viewStart = cfg.viewStart != null ? cfg.viewStart : 0;
    const visibleEnd = cfg.hideFutureFrom != null ? cfg.hideFutureFrom : (cfg.viewEnd != null ? cfg.viewEnd : klines.length - 1);
    const view = klines.slice(viewStart, visibleEnd + 1);
    const n = view.length;
    if (!n) return;
    let min = Infinity, max = -Infinity;
    view.forEach((k) => { min = Math.min(min, k.l); max = Math.max(max, k.h); });
    (cfg.lines || []).forEach((l) => { if (l.price < min) min = l.price; if (l.price > max) max = l.price; });
    const padY = (max - min) * 0.08 || 1;
    min -= padY; max += padY;
    const plotLeft = padL, plotTop = padT, plotBottom = H - padB;
    const plotW = plotRight - plotLeft, plotH = plotBottom - plotTop;
    const cw = plotW / n;
    const yOf = (p) => plotTop + (1 - (p - min) / (max - min)) * plotH;
    const xOf = (i) => plotLeft + (i + 0.5) * cw;

    // 网格 + 价格轴
    ctx.font = "11px sans-serif"; ctx.textBaseline = "middle";
    const steps = 5;
    for (let i = 0; i <= steps; i++) {
      const p = min + (max - min) * i / steps, y = yOf(p);
      ctx.strokeStyle = "rgba(255,255,255,0.05)";
      ctx.beginPath(); ctx.moveTo(plotLeft, y); ctx.lineTo(plotRight, y); ctx.stroke();
      ctx.fillStyle = "#8b949e"; ctx.textAlign = "right";
      ctx.fillText(TG.fmt(p, 2), plotLeft - 6, y);
    }
    // K线
    for (let i = 0; i < n; i++) {
      const k = view[i], x = xOf(i), up = k.c >= k.o, col = up ? "#f0495b" : "#2ec27e";
      const bw = Math.max(1, cw * 0.6);
      ctx.strokeStyle = col;
      ctx.beginPath(); ctx.moveTo(x, yOf(k.h)); ctx.lineTo(x, yOf(k.l)); ctx.stroke();
      ctx.fillStyle = col;
      const yo = yOf(k.o), yc = yOf(k.c), top = Math.min(yo, yc), hgt = Math.max(1, Math.abs(yc - yo));
      ctx.fillRect(x - bw / 2, top, bw, hgt);
    }
    // 时间轴
    ctx.fillStyle = "#8b949e"; ctx.textAlign = "center";
    const tickStep = Math.max(1, Math.floor(n / 6));
    for (let i = 0; i < n; i += tickStep) ctx.fillText(view[i].date.slice(5), xOf(i), plotBottom + 11);

    // 标注线
    (cfg.lines || []).forEach((l) => {
      if (l.price < min || l.price > max) return;
      ctx.strokeStyle = l.color || "rgba(230,237,243,0.5)"; ctx.setLineDash(l.dash || []);
      const y = yOf(l.price);
      ctx.beginPath(); ctx.moveTo(plotLeft, y); ctx.lineTo(plotRight, y); ctx.stroke(); ctx.setLineDash([]);
    });
    // 标注箭头
    (cfg.markers || []).forEach((m) => {
      const i = m.idx - viewStart;
      if (i < 0 || i >= n) return;
      const x = xOf(i), y = yOf(m.price);
      ctx.fillStyle = m.color || "#388bfd";
      ctx.beginPath();
      if (m.dir === "up") { ctx.moveTo(x, y + 6); ctx.lineTo(x - 5, y + 14); ctx.lineTo(x + 5, y + 14); }
      else { ctx.moveTo(x, y - 6); ctx.lineTo(x - 5, y - 14); ctx.lineTo(x + 5, y - 14); }
      ctx.closePath(); ctx.fill();
    });
    // 最新价线
    const lastK = view[n - 1], lastY = yOf(lastK.c);
    ctx.strokeStyle = "rgba(230,237,243,0.35)"; ctx.setLineDash([2, 3]);
    ctx.beginPath(); ctx.moveTo(plotLeft, lastY); ctx.lineTo(plotRight, lastY); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = lastK.c >= lastK.o ? "#f0495b" : "#2ec27e";
    ctx.fillRect(plotRight, lastY - 8, W - plotRight, 16);
    ctx.fillStyle = "#fff"; ctx.textAlign = "left";
    ctx.fillText(TG.fmt(lastK.c), plotRight + 4, lastY);

    // 未来隐藏
    if (lock) {
      const lx = plotRight;
      ctx.fillStyle = "rgba(210,153,34,0.06)"; ctx.fillRect(lx, plotTop, W - lx, plotBottom - plotTop);
      ctx.strokeStyle = "rgba(210,153,34,0.18)";
      for (let y = plotTop; y < plotBottom; y += 12) { ctx.beginPath(); ctx.moveTo(lx, y); ctx.lineTo(W, y - 12); ctx.stroke(); }
      ctx.fillStyle = "#d29922"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.font = "13px sans-serif";
      const cx = (lx + W) / 2, cy = (plotTop + plotBottom) / 2;
      ctx.fillText("🔒", cx, cy - 14);
      ctx.fillText("未来隐藏", cx, cy + 4);
      ctx.font = "11px sans-serif";
      ctx.fillText(`还有 ${klines.length - 1 - visibleEnd} 根`, cx, cy + 22);
    }

    // 十字光标
    if (cfg.crosshair && canvas._mouse) {
      const mx = canvas._mouse.x;
      if (mx >= plotLeft && mx <= plotRight) {
        const i = TG.clamp(Math.floor((mx - plotLeft) / cw), 0, n - 1);
        const k = view[i], x = xOf(i);
        ctx.strokeStyle = "rgba(230,237,243,0.3)"; ctx.setLineDash([3, 3]);
        ctx.beginPath(); ctx.moveTo(x, plotTop); ctx.lineTo(x, plotBottom); ctx.stroke();
        const py = (canvas._mouse.y >= plotTop && canvas._mouse.y <= plotBottom) ? canvas._mouse.y : lastY;
        ctx.beginPath(); ctx.moveTo(plotLeft, py); ctx.lineTo(plotRight, py); ctx.stroke(); ctx.setLineDash([]);
        const ch = TG.pct(k.c, k.o);
        const txt = `${k.date} O${TG.fmt(k.o)} H${TG.fmt(k.h)} L${TG.fmt(k.l)} C${TG.fmt(k.c)} ${(ch * 100).toFixed(2)}%`;
        ctx.font = "11px sans-serif"; const tw = ctx.measureText(txt).width + 12;
        const tx = TG.clamp(x - tw / 2, plotLeft, plotRight - tw);
        ctx.fillStyle = "rgba(22,27,34,0.92)"; ctx.fillRect(tx, plotTop + 2, tw, 18);
        ctx.fillStyle = ch >= 0 ? "#f0495b" : "#2ec27e"; ctx.textAlign = "left"; ctx.textBaseline = "middle";
        ctx.fillText(txt, tx + 6, plotTop + 11);
      }
    }
  };

  // 绑定十字光标（每个canvas只绑一次）
  TG.bindCrosshair = function (canvas) {
    if (canvas._wired) return;
    canvas._wired = true;
    const r = () => canvas.getBoundingClientRect();
    canvas.addEventListener("mousemove", (e) => { const b = r(); canvas._mouse = { x: e.clientX - b.left, y: e.clientY - b.top }; if (canvas._redraw) canvas._redraw(); });
    canvas.addEventListener("mouseleave", () => { canvas._mouse = null; if (canvas._redraw) canvas._redraw(); });
  };

  // 通用：渲染一帧并重绘（供模块设置 canvas._redraw）
  TG.makeRedraw = function (canvas, klines, cfg) {
    canvas._redraw = () => TG.drawCandles(canvas, klines, Object.assign({ crosshair: true }, cfg));
  };

  // ---------- 评分小工具：相邻给部分分 ----------
  TG.adjScore = function (guess, truth, options) {
    const i = options.indexOf(guess), j = options.indexOf(truth);
    if (i < 0) return 0;
    const d = Math.abs(i - j);
    return d === 0 ? 100 : d === 1 ? 60 : d === 2 ? 30 : 10;
  };

  TG.start = function () {
    // 侧边栏
    const nav = document.getElementById("nav");
    TG.navOrder.forEach((id) => {
      const m = TG.modules[id];
      const b = document.createElement("button");
      b.className = "navbtn"; b.dataset.mod = id;
      b.innerHTML = `<span class="ni">${m.icon || ""}</span><span>${m.title}</span>`;
      b.addEventListener("click", () => TG.nav(id));
      nav.appendChild(b);
    });
    // 等级徽章
    const prof = TG.computeProfile();
    TG.refreshLevelBadge(prof);
    // 默认进入模块1
    TG.nav(TG.navOrder[0]);
    window.addEventListener("resize", () => { if (TG._activeRedraw) TG._activeRedraw(); });
  };
  TG.refreshLevelBadge = function (prof) {
    const el = document.getElementById("levelBadge");
    if (el) el.textContent = "等级：" + (prof ? prof.level : TG.computeProfile().level);
  };
})();
