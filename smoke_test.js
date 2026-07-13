/* 无头集成测试：DOM 桩件加载 core + 全部模块，逐一导航渲染并跑通关键流程。 */
const fs = require("fs");
const path = require("path");

// ---------- 数据 ----------
const dataSrc = fs.readFileSync(path.join(__dirname, "data/market_data.js"), "utf-8");
const m = dataSrc.indexOf("window.MARKET_DATA =");
const ctxProxy = new Proxy({}, { get(t, p) { if (p === "measureText") return () => ({ width: 10 }); return p in t ? t[p] : () => {}; }, set(t, p, v) { t[p] = v; return true; } });

// ---------- Fake DOM ----------
class FakeEl {
  constructor(id) { this._id = id; this._q = {}; this._h = {}; this._children = []; this.parentElement = null;
    this.style = {}; this.dataset = {}; this.classList = { add() {}, remove() {}, contains() { return false; }, toggle() {} };
    this.value = ""; this.innerHTML = ""; this.textContent = ""; this.disabled = false; }
  addEventListener(ev, cb) { this._h[ev] = cb; }
  appendChild(c) { c.parentElement = this; this._children.push(c); return c; }
  getContext() { return ctxProxy; }
  getBoundingClientRect() { return { left: 0, top: 0, width: 800, height: 600 }; }
  get clientWidth() { return 800; } get clientHeight() { return 600; }
  querySelector(sel) {
    if (this._q[sel]) return this._q[sel];
    const r = this._queryCached(sel);
    if (r) { this._q[sel] = r; return r; }
    const e = new FakeEl(sel); e.parentElement = this; this._q[sel] = e; return e;
  }
  _queryCached(sel) {
    if (this._q[sel]) return this._q[sel];
    for (const ch of this._children) { const r = ch._queryCached(sel); if (r) return r; }
    return null;
  }
  querySelectorAll() { return []; }
  set innerHTML(v) { this._store_inner = v; this._q = {}; this._children = []; }
  get innerHTML() { return this._store_inner || ""; }
  set onclick(f) { this._h.click = f; } get onclick() { return this._h.click; }
  set oninput(f) { this._h.input = f; } get oninput() { return this._h.input; }
}
const elCache = {};
function getEl(id) { if (!elCache[id]) elCache[id] = new FakeEl(id); return elCache[id]; }

global.window = {
  devicePixelRatio: 1,
  addEventListener() {},
  confirm: () => true,
  localStorage: (() => { let s = {}; return { getItem: (k) => (k in s ? s[k] : null), setItem: (k, v) => { s[k] = String(v); }, removeItem: (k) => { delete s[k]; } }; })(),
};
global.alert = () => {};
global.document = {
  getElementById: (id) => getEl(id),
  createElement: () => new FakeEl("el"),
  querySelectorAll: () => [],
  activeElement: null,
};
global.window.MARKET_DATA = JSON.parse(dataSrc.slice(m + "window.MARKET_DATA =".length).replace(/;\s*$/, ""));
global.window.__TG_TEST_MODE__ = true; // 暴露模块内部状态供测试驱动评分路径

// ---------- 加载脚本 ----------
["core.js", "m1_blind.js", "m2_breakout.js", "m3_pa.js", "m4_market.js", "m5_sector.js", "m6_position.js", "m7_risk.js", "m8_center.js"]
  .forEach((f) => require(path.join(__dirname, f)));

const TG = global.window.TG;

try {
  TG.start();
  console.log("start OK, 模块数:", TG.navOrder.length, TG.navOrder.join(","));

  // 盲测全流程（start 后 main 正渲染 blind，处理器在）
  const main = getEl("main");
  for (let i = 0; i < 8; i++) main.querySelector("#m1rv1").onclick();
  main.querySelector("#m1rv5").onclick();
  main.querySelector("#m1reason").value = "回踩前高企稳";
  main.querySelector("#m1buy").onclick();
  main.querySelector("#m1reason").value = "突破加仓";
  main.querySelector("#m1add").onclick();
  main.querySelector("#m1reduce").onclick();
  main.querySelector("#m1reason").value = "达标止盈";
  main.querySelector("#m1close").onclick();
  main.querySelector("#m1reason").value = "二波";
  main.querySelector("#m1buy").onclick();
  main.querySelector("#m1settle").onclick();
  console.log("盲测全流程 OK");

  // 逐个模块渲染
  TG.navOrder.forEach((id) => { TG.nav(id); });
  console.log("全部模块 render OK");

  // 各模块 submit（验证不抛异常 + 跑通评分路径）
  function correctPick(id) {
    const T = global.window.__TG_TEST__ && global.window.__TG_TEST__[id];
    if (!T) return;
    if (id === "breakout") { const c = T.cur.case; getEl("main").querySelector("#m2prob").value = c.isTrue ? "85" : "15"; }
    else if (id === "pa") { T.pick = T.q.answer; }
    else if (id === "market") { T.pick = T.cur.st.phase; }
    else if (id === "sector") { T.pick = T.cur.rotation; }
    else if (id === "position") { T.pick = T.cur.shouldTrade ? "trade" : "abandon"; T.pos = 30; }
    else if (id === "risk") { T.pick = T.cur.correct; }
  }
  const submitSelFor = (id) => ({ breakout: "#m2submit", pa: "#m3submit", market: "#m4submit", sector: "#m5submit", position: "#m6submit", risk: "#m7submit", center: null }[id]);
  ["breakout", "pa", "market", "sector", "position", "risk"].forEach((id) => {
    TG.nav(id);
    correctPick(id);
    const sub = getEl("main").querySelector(submitSelFor(id));
    if (sub && sub.onclick) sub.onclick();
  });
  console.log("各模块 submit（含评分路径） OK");

  // 成长中心三个 tab
  TG.nav("center");
  const cc = getEl("main");
  cc.querySelector("#m8pane"); // 已渲染默认 log
  console.log("成长中心 OK");

  // NaN 检查（抓一条记录看）
  const recs = TG.getRecords();
  const bad = recs.find((r) => !isFinite(r.score) || r.score == null);
  if (bad) { console.error("❌ 存在脏分记录", bad); process.exit(1); }
  console.log("记录数:", recs.length, "| 无脏分 ✅");
  console.log("INTEGRATION OK ✅");
} catch (e) {
  console.error("INTEGRATION FAIL ❌");
  console.error(e && e.stack ? e.stack : e);
  process.exit(1);
}
