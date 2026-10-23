#!/usr/bin/env python3
"""FF14 물고기(터주) 시드 데이터 넣기 — 몇 번을 돌려도 같은 결과(slug 기준 upsert).

nyaki-web 터주 페이지에 보일 물고기를 아래 FISH 목록에 적고 돌린다. 이미 있는 물고기는
created_at을 그대로 두고 나머지 칸만 갱신한다.

조건 출처: 한국 클라이언트 데이터(FishingSpot·FishParameter·Item 시트,
Ra-Workspace/ffxiv-datamining-ko) + 공략 사이트(ff14.tar.to)의 날씨·시간·미끼.
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
