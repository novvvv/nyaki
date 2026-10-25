#!/usr/bin/env python3
"""FF14 물고기 시드 데이터(scripts/data/fish.json) 만들기 — 개발 PC에서 돌리는 일회성 도구.

  .venv/bin/python scripts/build_fish_data.py --expansion 0 2 --cache /tmp/fish-cache

--expansion은 ExVersion(0=신생, 1=창천, 2=홍련 …)을 여러 개 받아 한 fish.json에 담는다.
시드가 이 파일 하나라 이미 넣은 확장팩도 빼지 말고 같이 적는다.

세 출처를 합치고, 두 공략 출처가 서로 다른 곳은 보고서로 출력한다.

  1. 한국 클라이언트 데이터(Ra-Workspace/ffxiv-datamining-ko) — 무엇이 어디서 낚이는지.
     지역·낚시터(FishingSpot), 한국어 이름·아이콘(Item), 레벨·별(FishParameter), 게임 내 설명.
  2. Carbuncle Plushy 낚시 트래커 데이터(icykoneko/ff14-fish-tracker-app, MIT) — 출현 조건과
     낚는 법. 시간·날씨·이전 날씨·미끼 경로·입질·챔질. 서로 다르면 이쪽을 쓴다(구조화돼 있고
     꾸준히 관리된다).
  3. ff14.tar.to 아이템 페이지(robots.txt가 /item/view/ 허용) — 1·2와 대조하고, 2에 없는
     물고기(조건 없는 일반 물고기)의 미끼·입질·챔질, 낚시 종류(바닷가 등)·《전설》·물고기의 눈.
     요청 사이를 1.2초 띄우고 --cache 폴더에 받아 두어 다시 받지 않는다.

eorzea-weather.com은 robots.txt가 데이터 수집과 Claude를 막고 있어 쓰지 않는다.
영어 이름(대조 키)·일본어 이름은 XIVAPI에서 받는다.
"""

from __future__ import annotations

import argparse
import csv
import io
import json
import re
import sys
import time
import urllib.parse
import urllib.request
from collections import defaultdict
from pathlib import Path

import yaml

KO_CSV = "https://raw.githubusercontent.com/Ra-Workspace/ffxiv-datamining-ko/master/csv/{}.csv"
CARBUNCLE = (
    "https://raw.githubusercontent.com/icykoneko/ff14-fish-tracker-app/master/private/fishData.yaml"
)
XIVAPI = "https://v2.xivapi.com/api/sheet/{}"
TARTO = "https://ff14.tar.to/item/view/{}"

OUT = Path(__file__).parent / "data" / "fish.json"
TUG = {"Light": "!", "Medium": "!!", "Heavy": "!!!", "Legendary": "!!!"}
HOOKSET = {"Precision": "섬세한 낚아채기", "Powerful": "강력한 낚아채기"}
HOOKSET_KO = {"섬낚": "섬세한 낚아채기", "강낚": "강력한 낚아채기"}
TUG_KO = {"약한 입질": "!", "중간 입질": "!!", "강한 입질": "!!!"}


# ------------------------------------------------------------------ 받기


def fetch(url: str, cache: Path, name: str, delay: float = 0) -> str:
    path = cache / name
    if path.exists() and path.stat().st_size > 0:
        return path.read_text(encoding="utf-8")
    req = urllib.request.Request(url, headers={"User-Agent": "nyaki-fish-data/1.0"})
    with urllib.request.urlopen(req, timeout=60) as res:
        text = res.read().decode("utf-8")
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8")
    if delay:
        time.sleep(delay)
    return text


def ko_sheet(name: str, cache: Path) -> tuple[list[str], dict[str, list[str]]]:
    text = fetch(KO_CSV.format(name), cache, f"ko/{name}.csv").lstrip("﻿")
    rows = list(csv.reader(io.StringIO(text)))
    return rows[1], {r[0]: r for r in rows[3:]}


def xivapi_rows(sheet: str, ids: list[int], fields: str, cache: Path) -> dict[int, dict]:
    """XIVAPI v2에서 여러 행을 100개씩 나눠 받는다."""
    out: dict[int, dict] = {}
    ids = sorted(set(ids))
    for i in range(0, len(ids), 100):
        chunk = ids[i : i + 100]
        query = urllib.parse.urlencode({"rows": ",".join(map(str, chunk)), "fields": fields})
        tag = re.sub(r"[^A-Za-z]+", "_", fields)
        name = f"xivapi/{sheet}-{tag}-{chunk[0]}-{chunk[-1]}-{len(chunk)}.json"
        data = json.loads(fetch(f"{XIVAPI.format(sheet)}?{query}", cache, name))
        for row in data["rows"]:
            out[row["row_id"]] = row["fields"]
    return out


# ------------------------------------------------------------------ tar.to 해석


def parse_tarto(html: str) -> dict | None:
    """첫 번째 낚시 블록만 본다(같은 물고기라도 낚시터마다 블록이 여러 개일 수 있다)."""
    start = html.find('id="fish-section"')
    if start < 0:
        return None
    blocks = html[start:].split('<div class="fish-info hover-highlight">')[1:]
    if not blocks:
        return None
    b = blocks[0].split('class="fish-map')[0]

    def text(s: str) -> str:
        return re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", s)).replace("&nbsp;", " ").strip()

    head = re.search(r'class="fish-info-item">(.*?)</div>', b, re.S)
    head_text = text(head.group(1)) if head else ""
    level = re.search(r'gather-level">(\d+)', b)
    stars = re.search(r'gather-star star">\s*(★*)', b)
    water = re.search(r"낚시 · ([^<]+)<", b)

    restriction = re.search(r'class="fish-info-restriction">(.*?)</div>', b, re.S)
    hours = None
    weathers: list[str] = []
    previous: list[str] = []
    if restriction:
        r = restriction.group(1)
        m = re.search(r"<span>([\d.:]+)~([\d.:]+)", r)
        if m:
            hours = (_hour(m.group(1)), _hour(m.group(2)))
        # 이전 날씨가 있으면 "A B → C D" 형태(화살표 앞이 이전 날씨)
        names = re.findall(r'class="weather-icon"[^>]*alt="([^"]+)"|(→)', r)
        seq = [n or a for n, a in names]
        if "→" in seq:
            k = seq.index("→")
            previous, weathers = seq[:k], seq[k + 1 :]
        else:
            weathers = seq

    path_html = re.search(r'class="fish-info-path">(.*)', b, re.S)
    steps: list[dict] = []
    fish_eyes = False
    if path_html:
        p = path_html.group(1)
        fish_eyes = 'class="fish-eye' in p
        for part in re.split(r"&nbsp;→&nbsp;", p):
            name = re.search(r'<a href="/item/view/\d+">([^<]+)</a>', part) or re.search(
                r'class="bait-details">([^<]+)<', part
            )
            hook = re.search(r'class="fish-hookset"[^>]*alt="([^"]+)"', part)
            tug = re.search(r'class="fish-tug"[^>]*title="([^"]+)"', part)
            steps.append(
                {
                    "name": name.group(1).strip() if name else "",
                    # 이 단계 미끼로 "다음" 물고기를 낚는 입질·챔질
                    "hookset": HOOKSET_KO.get(hook.group(1), "") if hook else "",
                    "tug": TUG_KO.get(tug.group(1), "") if tug else "",
                }
            )
    # 어부의 직감 조건 — "· 5031,3마리"(아이템 id, 마리 수). 링크는 깨져 있어 글자로 읽는다.
    predators = [
        (int(i), int(n))
        for i, n in re.findall(r"(\d+),(\d+)마리", html[start:].split("fish-info-predator-container")[1])
    ] if "fish-info-predator-container" in html[start:] else []
    return {
        "predators": predators,
        "level": int(level.group(1)) if level else None,
        "stars": len(stars.group(1)) if stars else 0,
        "legendary": "《전설》" in head_text,
        "water": water.group(1).strip() if water else "",
        "hours": hours,
        "weathers": weathers,
        "previous": previous,
        "fish_eyes": fish_eyes,
        "steps": steps,
    }


def _hour(v) -> float | None:
    """Carbuncle/tar.to 시각 → 시(소수). YAML 1.1은 18:45를 60진수 정수(1125)로 읽는다."""
    if v is None:
        return None
    if isinstance(v, str):
        if ":" in v:
            h, m = v.split(":")
            return int(h) + int(m) / 60
        return float(v)
    v = float(v)
    return v / 60 if v > 24 else v


def slugify(name: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", name.lower().replace("'", "")).strip("-")


# ------------------------------------------------------------------ 본체


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--expansion", type=int, nargs="+", default=[0], help="ExVersion (0=신생, 2=홍련)")
    ap.add_argument("--cache", type=Path, required=True)
    args = ap.parse_args()
    cache: Path = args.cache

    th, territory = ko_sheet("TerritoryType", cache)
    ph, place = ko_sheet("PlaceName", cache)
    sh, spots = ko_sheet("FishingSpot", cache)
    fh, fparam = ko_sheet("FishParameter", cache)
    ih, items = ko_sheet("Item", cache)
    lh, levels = ko_sheet("GatheringItemLevelConvertTable", cache)

    def col(h, n):
        return h.index(n)

    place_name = lambda pid: place.get(pid, [""] * 2)[col(ph, "Name")]  # noqa: E731

    # 날씨 예보와 같은 기준의 지역(마을·필드, 날씨 있음)만
    zones = {
        int(k): place_name(r[col(th, "PlaceName")])
        for k, r in territory.items()
        if int(r[col(th, "ExVersion")] or 0) in args.expansion
        and r[col(th, "TerritoryIntendedUse")] in ("0", "1")
        and r[col(th, "WeatherRate")] != "0"
        and not r[col(th, "Name")].endswith("_test")
    }

    # 물고기 → 낚시터 목록
    fish_spots: dict[int, list[dict]] = defaultdict(list)
    spot_ids = []
    for sid, r in spots.items():
        zone = int(r[col(sh, "TerritoryType")] or 0)
        if zone not in zones:
            continue
        spot_ids.append(int(sid))
        for i in range(10):
            it = int(r[col(sh, f"Item[{i}]")] or 0)
            if it:
                fish_spots[it].append(
                    {"spot_id": int(sid), "zone_id": zone, "spot_name": place_name(r[col(sh, "PlaceName")])}
                )
    fish_ids = sorted(fish_spots)
    param_by_item = {int(r[col(fh, "Item")]): r for r in fparam.values()}

    # 영어 이름 — Carbuncle(영문)과 맞추는 키. 미끼·생미끼 물고기도 영문 → 한국어로 돌려야 해서
    # 낚시용 미끼(33)·수산물(47) 전부를 받는다.
    fishing_items = [
        int(k) for k, r in items.items() if r[col(ih, "ItemUICategory")] in ("33", "47")
    ]
    en = xivapi_rows("Item", fishing_items, "Name,Name@lang(ja)", cache)
    ko_by_en = {f["Name"]: items[str(i)][col(ih, "Name")] for i, f in en.items() if f.get("Name")}
    id_by_en = {f["Name"]: i for i, f in en.items() if f.get("Name")}
    spot_en = {
        i: f["PlaceName"]["fields"]["Name"]
        for i, f in xivapi_rows("FishingSpot", spot_ids, "PlaceName.Name", cache).items()
    }
    weather_list = json.loads(
        fetch(f"{XIVAPI.format('Weather')}?limit=1000&fields=Name", cache, "xivapi/Weather-all.json")
    )
    # 같은 영문 이름의 날씨가 여러 id로 있다(Clear Skies 1·209 …). 물고기 지역의 확률표에
    # 있는 id로 골라야 웹 날씨 계산과 맞물린다.
    weather_en_ids: dict[str, list[int]] = defaultdict(list)
    for r in weather_list["rows"]:
        if r["fields"]["Name"]:
            weather_en_ids[r["fields"]["Name"]].append(r["row_id"])
    rh, rates = ko_sheet("WeatherRate", cache)
    zone_weathers = {
        z: {
            int(rates[territory[str(z)][col(th, "WeatherRate")]][col(rh, f"Weather[{i}]")])
            for i in range(8)
        }
        for z in zones
    }

    def weather_id(en_name: str, zone: int, fish_name: str) -> int:
        candidates = weather_en_ids.get(en_name, [])
        hit = [i for i in candidates if i in zone_weathers[zone]]
        if hit:
            return hit[0]
        report.append(f"WEATHER {fish_name}: '{en_name}'가 지역 확률표에 없음 — {min(candidates)} 사용")
        return min(candidates)
    wh, weather_sheet = ko_sheet("Weather", cache)
    weather_ko = {r[col(wh, "Name")]: int(k) for k, r in weather_sheet.items() if r[col(wh, "Name")]}
    # 대조는 이름끼리 — 한국어 이름도 id가 여러 개라(쾌청 1·209) id로 비교하면 가짜 차이가 난다
    weather_name = {int(k): r[col(wh, "Name")] for k, r in weather_sheet.items()}

    report: list[str] = []
    carbuncle_raw = yaml.safe_load(fetch(CARBUNCLE, cache, "carbuncle/fishData.yaml"))
    carbuncle = {f["name"]: f for f in carbuncle_raw if isinstance(f, dict) and "name" in f}

    overrides = json.loads((Path(__file__).parent / "data" / "fish_overrides.json").read_text())

    out = []
    for fid in fish_ids:
        item = items[str(fid)]
        name = item[col(ih, "Name")]
        name_en = en.get(fid, {}).get("Name", "")
        name_ja = en.get(fid, {}).get("Name@lang(ja)", "")
        if item[col(ih, "ItemUICategory")] != "47":
            report.append(f"SKIP {fid} {name}: 수산물이 아님(낚시로 얻는 꼬마 친구 등)")
            continue
        if not name or not name_en:
            report.append(f"SKIP {fid}: 이름 없음")
            continue

        html = fetch(TARTO.format(fid), cache, f"tarto/{fid}.html", delay=1.2)
        tar = parse_tarto(html) or {}
        cb = carbuncle.get(name_en)

        # 대표 낚시터 — Carbuncle location이 가리키는 곳, 없으면 첫 낚시터
        locs = fish_spots[fid]
        primary = locs[0]
        if cb and cb.get("location"):
            primary = next((l for l in locs if spot_en.get(l["spot_id"]) == cb["location"]), primary)

        # 레벨·별 — 게임 데이터, 없으면 tar.to
        param = param_by_item.get(fid)
        level, stars = tar.get("level"), tar.get("stars", 0)
        if param:
            lv = levels.get(param[col(fh, "GatheringItemLevel")])
            if lv and int(lv[1]) > 0:
                level, stars = int(lv[1]), int(lv[2])

        # 출현 조건
        start = end = None
        weathers: list[int] = []
        previous: list[int] = []
        if cb:
            s, e = _hour(cb.get("startHour")), _hour(cb.get("endHour"))
            if not (s == 0 and e == 24) and s is not None and e is not None:
                start, end = s, e
            zone = primary["zone_id"]
            weathers = [weather_id(w, zone, name) for w in cb.get("weatherSet") or []]
            previous = [weather_id(w, zone, name) for w in cb.get("previousWeatherSet") or []]
        elif tar.get("hours") or tar.get("weathers"):
            if tar.get("hours"):
                start, end = tar["hours"]
            weathers = [weather_ko[w] for w in tar.get("weathers", []) if w in weather_ko]
            previous = [weather_ko[w] for w in tar.get("previous", []) if w in weather_ko]
            report.append(f"TARTO-ONLY 조건 {name}: Carbuncle에 없음 — tar.to 조건 사용")

        # 낚는 법 — Carbuncle 경로(영문)를 한국어로, 단계별 입질·챔질은 그 물고기의 Carbuncle 값
        bait = ""
        mooches: list[dict] = []
        tug = hookset = ""
        tar_steps = tar.get("steps") or []
        if cb and cb.get("bestCatchPath"):
            path = [ko_by_en.get(n, n) for n in cb["bestCatchPath"]]
            bait = path[0]
            for en_name, ko_name in zip(cb["bestCatchPath"][1:], path[1:]):
                m = carbuncle.get(en_name) or {}
                mooches.append(
                    {
                        "name": ko_name,
                        "tug": TUG.get(m.get("tug") or "", ""),
                        "hookset": HOOKSET.get(m.get("hookset") or "", ""),
                    }
                )
            tug = TUG.get(cb.get("tug") or "", "")
            hookset = HOOKSET.get(cb.get("hookset") or "", "")
            # Carbuncle에 비어 있는 칸은 tar.to 값으로
            if len(tar_steps) >= 2:
                last = tar_steps[-2]
                if not tug and last["tug"]:
                    tug = last["tug"]
                    report.append(f"FILL 입질 {name}: Carbuncle 비어 있음 — tar.to {tug}")
                if not hookset and last["hookset"]:
                    hookset = last["hookset"]
                    report.append(f"FILL 챔질 {name}: Carbuncle 비어 있음 — tar.to {hookset}")
        elif tar_steps:
            bait = tar_steps[0]["name"]
            # tar.to는 i단계 미끼로 i+1단계 물고기를 낚는 입질·챔질을 i단계에 적는다
            for prev, step in zip(tar_steps[:-2], tar_steps[1:-1]):
                mooches.append({"name": step["name"], "tug": prev["tug"], "hookset": prev["hookset"]})
            last = tar_steps[-2] if len(tar_steps) >= 2 else tar_steps[0]
            tug, hookset = last["tug"], last["hookset"]

        # ---- 대조 보고: tar.to와 다른 곳
        if tar:
            if tar.get("hours") and (start, end) != tuple(tar["hours"]):
                report.append(f"DIFF 시간 {name}: carbuncle={start}~{end} tar.to={tar['hours']}")
            cw = sorted(weather_name[i] for i in weathers)
            if tar.get("weathers") and sorted(tar["weathers"]) != cw:
                report.append(f"DIFF 날씨 {name}: carbuncle={cw} tar.to={sorted(tar['weathers'])}")
            cp = sorted(weather_name[i] for i in previous)
            if sorted(tar.get("previous", [])) != cp:
                report.append(f"DIFF 이전날씨 {name}: carbuncle={cp} tar.to={sorted(tar['previous'])}")
            if tar_steps:
                tpath = [s["name"] for s in tar_steps[:-1]]
                cpath = [bait] + [m["name"] for m in mooches]
                if bait and tpath != cpath:
                    report.append(f"DIFF 경로 {name}: carbuncle={cpath} tar.to={tpath}")
                last = tar_steps[-2] if len(tar_steps) >= 2 else None
                if last and (last["tug"], last["hookset"]) != (tug, hookset):
                    report.append(
                        f"DIFF 입질/챔질 {name}: carbuncle={tug}/{hookset} "
                        f"tar.to={last['tug']}/{last['hookset']}"
                    )

        # 밑작(어부의 직감) — Carbuncle predators {영문: 마리 수}, tar.to와 아이템 id로 대조
        predators = []
        intuition = None
        if cb and cb.get("predators"):
            for en_name, count in cb["predators"].items():
                pid = id_by_en.get(en_name)
                predators.append(
                    {"item_id": pid, "slug": slugify(en_name), "name": ko_by_en.get(en_name, en_name), "count": int(count)}
                )
            intuition = cb.get("intuitionLength")
        tpred = sorted(tar.get("predators", []))
        cpred = sorted((p["item_id"], p["count"]) for p in predators)
        if tpred != cpred:
            report.append(f"DIFF 밑작 {name}: carbuncle={cpred} tar.to={tpred}")
            if not predators and tpred:
                predators = [
                    {"item_id": i, "slug": slugify(en.get(i, {}).get("Name", "")), "name": items[str(i)][col(ih, "Name")], "count": n}
                    for i, n in tpred
                ]

        description = (param[col(fh, "Text")] if param else "") or item[col(ih, "Description")]
        record = {
                "slug": slugify(name_en),
                "item_id": fid,
                "icon_id": int(item[col(ih, "Icon")]),
                "name": name,
                "name_en": name_en,
                "name_ja": name_ja,
                "zone_id": primary["zone_id"],
                "spot_name": primary["spot_name"],
                "spots": [
                    {"zone_id": l["zone_id"], "spot_name": l["spot_name"]}
                    for l in sorted(locs, key=lambda l: l != primary)
                ],
                "water": tar.get("water", ""),
                "level": level or 1,
                "stars": stars,
                "is_legendary": bool(tar.get("legendary")),
                "is_big_fish": "터주" in item[col(ih, "Description")],
                "start_hour": start,
                "end_hour": end,
                "weathers": weathers,
                "previous_weathers": previous,
                "bait": bait,
                "mooches": mooches,
                "tug": tug,
                "hookset": hookset,
                "predators": predators,
                "intuition_seconds": int(intuition) if intuition else None,
                "buffs": ["물고기의 눈"] if tar.get("fish_eyes") else [],
                "description": description.replace("\n", " ").strip(),
            }
        override = overrides.get(record["slug"])
        if override:
            record.update({k: v for k, v in override.items() if not k.startswith("_")})
            report.append(f"OVERRIDE {name}: {', '.join(k for k in override if not k.startswith('_'))}")
        out.append(record)

    known = {f["slug"] for f in out}
    for f in out:
        for p in f["predators"]:
            if p["slug"] not in known:
                report.append(f"LINK {f['name']}: 밑작 {p['name']}는 데이터에 없어 링크 없음")
                p["slug"] = ""
            p.pop("item_id", None)

    slugs = [f["slug"] for f in out]
    dupes = {s for s in slugs if slugs.count(s) > 1}
    if dupes:
        sys.exit(f"slug 중복: {dupes}")

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(out, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(f"{len(out)}마리 → {OUT.relative_to(Path.cwd()) if OUT.is_relative_to(Path.cwd()) else OUT}")
    print(f"--- 대조 보고 ({len(report)}건)")
    print("\n".join(report))


if __name__ == "__main__":
    main()
