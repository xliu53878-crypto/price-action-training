#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""拉取真实 A股 历史日线，生成本地数据集 window.MARKET_DATA。
数据源：新浪财经(主) + 腾讯财经(兜底)。前复权。"""
import json
import sys
import urllib.request
import urllib.parse
import time

STOCKS = [
    ("600519", "贵州茅台"), ("601318", "中国平安"), ("600036", "招商银行"),
    ("600030", "中信证券"), ("600031", "三一重工"), ("601012", "隆基绿能"),
    ("600276", "恒瑞医药"), ("000725", "京东方A"), ("000625", "长安汽车"),
    ("002594", "比亚迪"), ("300750", "宁德时代"), ("300059", "东方财富"),
    ("002475", "立讯精密"), ("002241", "歌尔股份"), ("002466", "天齐锂业"),
    ("600703", "三安光电"), ("000858", "五粮液"), ("601888", "中国中免"),
    ("300760", "迈瑞医疗"), ("002714", "牧原股份"),
]


def market_prefix(code: str) -> str:
    return "sh" if code.startswith("6") else "sz"


def _get(url, timeout=10):
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read().decode("utf-8", "ignore")


def fetch_sina(code):
    sym = market_prefix(code) + code
    url = ("http://money.finance.sina.com.cn/quotes_service/api/json_v2.php/"
           "CN_MarketData.getKLineData?symbol=%s&scale=240&ma=no&datalen=2000" % sym)
    arr = json.loads(_get(url))
    out = []
    for x in arr:
        out.append({"date": x["day"], "o": float(x["open"]), "c": float(x["close"]),
                    "h": float(x["high"]), "l": float(x["low"]), "v": float(x.get("volume", 0))})
    return out


def fetch_tencent(code):
    sym = market_prefix(code) + code
    url = "http://web.ifzq.gtimg.cn/appstock/app/fqkline/get?param=%s,day,,,2000,qfq" % sym
    d = json.loads(_get(url))
    node = d["data"][sym]
    arr = node.get("qfqday") or node.get("day") or []
    out = []
    for x in arr:
        out.append({"date": x["date"], "o": float(x["open"]), "c": float(x["close"]),
                    "h": float(x["high"]), "l": float(x["low"]), "v": float(x.get("volume", 0))})
    return out


def fetch(code):
    last = None
    for fn in (fetch_sina, fetch_tencent):
        for attempt in range(2):
            try:
                kl = fn(code)
                if kl:
                    return kl
            except Exception as e:  # noqa
                last = e
                time.sleep(0.5)
    if last:
        raise last
    return []


def main():
    result, ok, fail = {}, [], []
    for code, name in STOCKS:
        try:
            kl = fetch(code)
            if kl:
                result[code] = {"code": code, "name": name, "klines": kl}
                ok.append("%s %s (%d bars, %s~%s)" % (code, name, len(kl), kl[0]["date"], kl[-1]["date"]))
            else:
                fail.append("%s %s (空)" % (code, name))
        except Exception as e:  # noqa
            fail.append("%s %s (ERR:%s)" % (code, name, e))
        time.sleep(0.3)

    print("OK:", len(ok))
    for x in ok: print("  ", x)
    print("FAIL:", len(fail))
    for x in fail: print("  ", x)

    with open("data/market_data.js", "w", encoding="utf-8") as f:
        f.write("// 自动生成：真实 A股 历史日线数据集（前复权）\n")
        f.write("// 数据源：新浪财经 / 腾讯财经 公开行情接口\n")
        f.write("window.MARKET_DATA = ")
        json.dump(result, f, ensure_ascii=False)
        f.write(";\n")
    print("WROTE data/market_data.js, stocks:", len(result))


if __name__ == "__main__":
    main()
