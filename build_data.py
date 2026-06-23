#!/usr/bin/env python3
"""把 data/raw 下的研究结果合并为前端可用的 data.js，并做一致性校验。"""
import json
import re
import sys
from datetime import datetime, date
from pathlib import Path

ROOT = Path(__file__).parent
RAW = ROOT / "data" / "raw"
PROBLEMS = []


def problem(msg: str) -> None:
    PROBLEMS.append(msg)


# 同一球场在各来源的city写法不一，统一为FIFA主办城市名并附中文
VENUE_CITY = {
    "Estadio Azteca": ("Mexico City", "墨西哥城"),
    "Estadio Akron": ("Guadalajara", "瓜达拉哈拉"),
    "Estadio BBVA": ("Monterrey", "蒙特雷"),
    "MetLife Stadium": ("New York/New Jersey", "纽约/新泽西"),
    "Gillette Stadium": ("Boston", "波士顿"),
    "Lincoln Financial Field": ("Philadelphia", "费城"),
    "Mercedes-Benz Stadium": ("Atlanta", "亚特兰大"),
    "Hard Rock Stadium": ("Miami", "迈阿密"),
    "AT&T Stadium": ("Dallas", "达拉斯"),
    "NRG Stadium": ("Houston", "休斯顿"),
    "Arrowhead Stadium": ("Kansas City", "堪萨斯城"),
    "SoFi Stadium": ("Los Angeles", "洛杉矶"),
    "Levi's Stadium": ("San Francisco Bay Area", "旧金山湾区"),
    "Lumen Field": ("Seattle", "西雅图"),
    "BMO Field": ("Toronto", "多伦多"),
    "BC Place": ("Vancouver", "温哥华"),
}


def load_schedule():
    matches = []
    sched_dir = RAW / "schedule"
    if not sched_dir.is_dir():
        problem("缺少 data/raw/schedule 目录")
        return matches
    for f in sorted(sched_dir.glob("*.json")):
        try:
            data = json.loads(f.read_text())
        except Exception as e:
            problem(f"{f.name}: JSON解析失败 {e}")
            continue
        matches.extend(data.get("matches", []))

    seen = {}
    for m in matches:
        no = m.get("match_no")
        if no in seen:
            problem(f"match_no {no} 重复")
        seen[no] = m
    missing = sorted(set(range(1, 105)) - set(seen))
    if missing:
        problem(f"缺少比赛编号: {missing}")
    if len(matches) != 104:
        problem(f"比赛总数 {len(matches)} != 104")

    iso_re = re.compile(r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?[+-]\d{2}:?\d{2}$")
    for m in matches:
        no = m.get("match_no")
        ko = m.get("kickoff_iso", "")
        if not iso_re.match(ko):
            problem(f"第{no}场 kickoff_iso 非法: {ko!r}")
            continue
        try:
            dt = datetime.fromisoformat(ko)
            if not (date(2026, 6, 11) <= dt.date() <= date(2026, 7, 19)):
                problem(f"第{no}场日期越界: {ko}")
        except ValueError:
            problem(f"第{no}场 kickoff_iso 无法解析: {ko}")
        venue = m.get("venue", "")
        if venue in VENUE_CITY:
            m["city"], m["city_zh"] = VENUE_CITY[venue]
        else:
            problem(f"第{no}场球场未知: {venue!r}（无法标准化城市）")
            m["city_zh"] = m.get("city", "")
        if m.get("status") not in ("finished", "live", "scheduled"):
            problem(f"第{no}场 status 非法: {m.get('status')!r}")
        ev = m.get("events")
        if ev is not None:
            if not isinstance(ev, dict) or not set(ev) <= {"home", "away"}:
                problem(f"第{no}场 events 结构非法（应为 {{home:[], away:[]}}）")
            else:
                for side_key, items in ev.items():
                    for e in items:
                        if e.get("type") not in ("goal", "pen", "og", "yellow", "red"):
                            problem(f"第{no}场 events.{side_key} type 非法: {e.get('type')!r}")
                        if not e.get("player"):
                            problem(f"第{no}场 events.{side_key} 缺 player")
                        if "minute" not in e:
                            problem(f"第{no}场 events.{side_key} 缺 minute")
                        else:
                            e["minute"] = str(e["minute"])
        if m.get("status") in ("finished", "live"):
            if not isinstance(m.get("home_score"), int) or not isinstance(m.get("away_score"), int):
                problem(f"第{no}场已完赛/进行中但缺比分")
        for k in ("date", "city", "venue", "home", "away", "stage"):
            if not m.get(k):
                problem(f"第{no}场缺字段 {k}")

    matches.sort(key=lambda m: (m.get("kickoff_iso", ""), m.get("match_no", 0)))
    return matches


def load_teams():
    teams = {}
    team_dir = RAW / "teams"
    if not team_dir.is_dir():
        problem("缺少 data/raw/teams 目录")
        return teams
    for f in sorted(team_dir.glob("*.json")):
        try:
            t = json.loads(f.read_text())
        except Exception as e:
            problem(f"{f.name}: JSON解析失败 {e}")
            continue
        en = t.get("en")
        if not en:
            problem(f"{f.name}: 缺 en 字段")
            continue
        for k in ("zh", "flag", "group", "coach", "best_result_zh"):
            if not t.get(k):
                problem(f"{en}: 缺字段 {k}")
        players = t.get("players", [])
        if not (23 <= len(players) <= 27):
            problem(f"{en}: 名单人数异常 {len(players)}")
        for p in players:
            if p.get("pos") not in ("GK", "DF", "MF", "FW"):
                problem(f"{en}: 球员 {p.get('name')} 位置非法 {p.get('pos')!r}")
            if not isinstance(p.get("age"), int) or not (15 <= p["age"] <= 45):
                problem(f"{en}: 球员 {p.get('name')} 年龄异常 {p.get('age')!r}")
        if not isinstance(t.get("titles"), int):
            problem(f"{en}: titles 非整数")
        teams[en] = t
    if len(teams) != 48:
        problem(f"球队数 {len(teams)} != 48")
    return teams


def main() -> int:
    matches = load_schedule()
    teams = load_teams()

    # 赛程中的球队名必须能在 teams 中找到（占位符除外）
    ph_re = re.compile(r"^([123][A-L]|3[A-L](/[A-L])+|[WL]\d+)$")
    for m in matches:
        for side in ("home", "away"):
            name = m.get(side, "")
            if name and name not in teams and not ph_re.match(name):
                problem(f"第{m.get('match_no')}场 {side}='{name}' 在球队表中找不到且不是合法占位符")

    # 每队应有6场小组赛中的3场
    from collections import Counter
    cnt = Counter()
    for m in matches:
        if str(m.get("stage", "")).startswith("Group"):
            cnt[m.get("home")] += 1
            cnt[m.get("away")] += 1
    for en in teams:
        if cnt.get(en, 0) != 3:
            problem(f"{en}: 小组赛场次 {cnt.get(en, 0)} != 3")

    groups = {}
    for t in teams.values():
        groups.setdefault(t.get("group", "?"), []).append(
            {"en": t["en"], "zh": t.get("zh", t["en"]), "flag": t.get("flag", "")}
        )
    groups_list = [{"group": g, "teams": sorted(ts, key=lambda x: x["zh"])} for g, ts in sorted(groups.items())]

    payload = {
        "generated": datetime.now().strftime("%Y-%m-%d %H:%M"),
        "groups": groups_list,
        "teams": teams,
        "matches": [{k: v for k, v in m.items() if k != "dt"} for m in matches],
    }
    out = ROOT / "data.js"
    out.write_text("window.WC = " + json.dumps(payload, ensure_ascii=False, indent=1) + ";\n")
    print(f"已生成 {out}  (球队 {len(teams)}, 比赛 {len(matches)})")

    if PROBLEMS:
        print(f"\n⚠️ 发现 {len(PROBLEMS)} 个问题:")
        for p in PROBLEMS:
            print("  -", p)
        return 1
    print("✅ 校验全部通过")
    return 0


if __name__ == "__main__":
    sys.exit(main())
