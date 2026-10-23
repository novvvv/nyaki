#!/usr/bin/env python3
"""FF14 물고기(터주) 시드 넣기 — 몇 번을 돌려도 같은 결과(slug 기준 upsert).

데이터는 scripts/data/fish.json(scripts/build_fish_data.py가 만든다 — 출처와 대조 방법은
그 파일 참고). 이미 있는 물고기는 created_at을 그대로 두고 나머지 칸만 갱신한다.

실행 (Lightsail 호스트의 api/ 디렉터리에서 — 스크립트는 이미지에 없어 stdin으로 넘긴다):

  docker compose -f docker-compose.yml -f docker-compose.production.yml cp scripts/data/fish.json api:/tmp/fish.json
  docker compose -f docker-compose.yml -f docker-compose.production.yml exec -T api python - /tmp/fish.json < scripts/seed_fish.py

로컬(SQLite 등):

  DATABASE_URL=sqlite:///./local.db python scripts/seed_fish.py scripts/data/fish.json
"""

from __future__ import annotations

import json
import sys
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path.cwd()))

from app.content.schemas import FishPayload  # noqa: E402
from app.content.services import get_fish, upsert_fish  # noqa: E402
from app.core.database import SessionLocal  # noqa: E402


def main() -> None:
    if len(sys.argv) < 2:
        sys.exit("사용법: seed_fish.py <fish.json>")
    fish = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
    now = datetime.now(timezone.utc)
    created = updated = 0
    with SessionLocal() as session:
        for data in fish:
            existing = get_fish(session, data["slug"])
            payload = FishPayload(
                **data,
                created_at=existing.created_at if existing else now,
                updated_at=now,
            )
            upsert_fish(session, payload)
            if existing:
                updated += 1
            else:
                created += 1
        session.commit()
    print(f"created {created}, updated {updated} (총 {len(fish)}마리)")


if __name__ == "__main__":
    main()
