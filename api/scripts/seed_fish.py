#!/usr/bin/env python3
"""FF14 물고기(터주) 시드 데이터 넣기 — 몇 번을 돌려도 같은 결과(slug 기준 upsert).

nyaki-web 터주 페이지에 보일 물고기를 아래 FISH 목록에 적고 돌린다. 이미 있는 물고기는
created_at을 그대로 두고 나머지 칸만 갱신한다.

조건 출처: 한국 클라이언트 데이터(FishingSpot·FishParameter·Item 시트,
Ra-Workspace/ffxiv-datamining-ko) + 공략 사이트(ff14.tar.to, eorzea-weather.com)의
날씨·시간·미끼. 생미끼 경로는 bait(처음 미끼) + mooches(중간 물고기와 그 입질·챔질).
zone_id는 TerritoryType id, 날씨는 Weather id (2 맑음, 3 흐림, 4 안개, 5 바람 …).

실행 (Lightsail 호스트의 api/ 디렉터리에서, 마이그레이션 0022_fish 적용 후):

  docker compose exec -T api python - < scripts/seed_fish.py

로컬(SQLite 등):

  DATABASE_URL=sqlite:///./local.db python scripts/seed_fish.py
"""

from __future__ import annotations

import sys
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path.cwd()))

from app.content.schemas import FishPayload  # noqa: E402
from app.content.services import get_fish, upsert_fish  # noqa: E402
from app.core.database import SessionLocal  # noqa: E402

FISH: list[dict] = [
    {
        "slug": "meteor-survivor",
        "item_id": 7903,
        "icon_id": 29086,
        "name": "메테오 투구게",
        "name_en": "Meteor Survivor",
        "name_ja": "メテオサバイバー",
        "zone_id": 135,  # 저지 라노시아
        "spot_name": "소금기둥 해변",
        "water": "바닷가",
        "level": 50,
        "stars": 3,
        "is_legendary": True,
        "is_big_fish": True,
        "start_hour": 3,
        "end_hour": 5,
        "weathers": [3, 4, 5],  # 흐림, 안개, 바람
        "previous_weathers": [],
        "bait": "쥐꼬리",
        "tug": "!!!",
        "hookset": "강력한 낚아채기",
        "buffs": ["물고기의 눈"],
        "description": "비정상적으로 단단한 외골격을 가진 투구게. "
        "떨어지는 달라가브 파편을 튕겨내고 살아남았다는 소문도 있다.",
    },
    {
        "slug": "bombardfish",
        "item_id": 7924,
        "icon_id": 29087,
        "name": "봄바드 복어",
        "name_en": "Bombardfish",
        "name_ja": "ボンバードフィッシュ",
        "zone_id": 137,  # 동부 라노시아
        "spot_name": "북부 핏빛해안",
        "water": "바닷가",
        "level": 50,
        "stars": 3,
        "is_legendary": True,
        "is_big_fish": True,
        "start_hour": 9,
        "end_hour": 15,
        "weathers": [1],  # 쾌청
        "previous_weathers": [],
        "bait": "청어살 떡밥",
        "tug": "!!!",
        "hookset": "강력한 낚아채기",
        "buffs": ["물고기의 눈"],
        "description": "거대 가시복. 그 커다란 몸집 때문에 오래 전 에오르제아를 뒤흔든 "
        "거대 봄의 이름이 붙었다.",
    },
    {
        # 터주가 아닌 상시 물고기 — 시간·날씨 조건 없음. 생미끼 두 단계를 거친다.
        "slug": "mazlaya-marlin",
        "item_id": 4917,
        "icon_id": 29022,
        "name": "마즐라야 청새치",
        "name_en": "Mazlaya Marlin",
        "name_ja": "マズラヤマーリン",
        "zone_id": 137,  # 동부 라노시아
        "spot_name": "북부 핏빛해안, 로타노 해 먼바다: 뱃머리",
        "water": "바닷가",
        "level": 50,
        "stars": 0,
        "is_legendary": False,
        "is_big_fish": False,
        "start_hour": None,
        "end_hour": None,
        "weathers": [],
        "previous_weathers": [],
        "bait": "쥐며느리",
        "mooches": [
            {"name": "항만청어", "tug": "!!", "hookset": "강력한 낚아채기"},
            {"name": "오거 창꼬치어", "tug": "!!", "hookset": "강력한 낚아채기"},
        ],
        "tug": "!!!",
        "hookset": "강력한 낚아채기",
        "buffs": [],
        "description": "엄청난 속도로 헤엄치는 대형어. 먼 옛날 여신 리믈렌이 목욕하는 걸 "
        "훔쳐봤기 때문에 멈추면 죽는 저주를 받았다고 한다.",
    },
    {
        # 시간 조건 없이 날씨(폭풍)만 맞으면 나오는 터주.
        "slug": "the-lone-ripper",
        "item_id": 7926,
        "icon_id": 29085,
        "name": "고독상어",
        "name_en": "The Lone Ripper",
        "name_ja": "ローンリッパー",
        "zone_id": 138,  # 서부 라노시아
        "spot_name": "하프스톤 연안",
        "water": "먼바다",
        "level": 50,
        "stars": 3,
        "is_legendary": True,
        "is_big_fish": True,
        "start_hour": None,
        "end_hour": None,
        "weathers": [6],  # 폭풍
        "previous_weathers": [],
        "bait": "중형 금속 지그",
        "tug": "!!!",
        "hookset": "강력한 낚아채기",
        "buffs": ["물고기의 눈"],
        "description": "망치상어로서는 드물게 무리를 짓지 않고 살아가는 독불장군. "
        "거친 바다를 유유히 헤엄치며 우왕좌왕 도망치는 물고기를 포식한다.",
    },
    {
        "slug": "mirrorscale",
        "item_id": 7940,
        "icon_id": 29371,
        "name": "거울비늘",
        "name_en": "Mirrorscale",
        "name_ja": "ミラースケイル",
        "zone_id": 137,  # 동부 라노시아
        "spot_name": "빗물받이 소택지",
        "water": "호수/늪",
        "level": 50,
        "stars": 3,
        "is_legendary": True,
        "is_big_fish": True,
        "start_hour": 9,
        "end_hour": 16,
        "weathers": [1, 2],  # 쾌청, 맑음
        "previous_weathers": [],
        "bait": "깔따구",
        "mooches": [{"name": "구리붕어", "tug": "!", "hookset": "섬세한 낚아채기"}],
        "tug": "!!!",
        "hookset": "섬세한 낚아채기",
        "buffs": ["물고기의 눈"],
        "description": "비늘이 마치 잘 닦은 은 거울처럼 아름다운 개체. "
        "이 물고기를 잡아먹으려고 하는 자는 비늘에 비친 자기 모습에 현혹된다.",
    },
]


def main() -> None:
    now = datetime.now(timezone.utc)
    with SessionLocal() as session:
        for data in FISH:
            existing = get_fish(session, data["slug"])
            payload = FishPayload(
                **data,
                created_at=existing.created_at if existing else now,
                updated_at=now,
            )
            upsert_fish(session, payload)
            print(f"{'updated' if existing else 'created'}: {data['slug']} ({data['name']})")
        session.commit()


if __name__ == "__main__":
    main()
