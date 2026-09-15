#!/usr/bin/env python3
"""Hub Postgres -> 백업 JSON 내보내기 (일회성 스크립트).

근거: DRIVE-PLAN 10-1(기존 데이터 이관) · 5-3(백업 파일 형식).

사용자당 파일 두 개를 쓴다.

  nyaki-hub-raw-<uid>.json    원본 archive. SELECT * — tombstone(is_deleted)과
                              user_id까지 전부. 되돌릴 여지를 위한 것이고
                              앱이 읽는 파일이 아니다.
  nyaki-backup-<uid>.json     schema_version 1 정본 후보. 살아있는 행만,
                              앱이 실제로 쓰는 필드만. sync_coordinator.dart가
                              이미 파싱하는 snake_case 스펠링을 그대로 쓴다.

두 개를 따로 쓰는 이유: 정본에서 tombstone을 빼는 것은 "전체 교체 복원"
결정(5-1)의 결과인데, 그 결정을 되돌릴 수 있으려면 원본이 남아 있어야 한다.

실행 (Lightsail 호스트의 api/ 디렉터리에서):

  docker compose exec -T api python - --list < scripts/export_backup.py
  docker compose exec -T api python - --all --out /tmp/nyaki-export < scripts/export_backup.py
  docker compose cp api:/tmp/nyaki-export ./nyaki-export
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from datetime import date, datetime, timezone
from pathlib import Path

import psycopg
from psycopg.rows import dict_row

# 백업 정본에 담는 필드. user_id는 넣지 않는다 — 앱 Drift에는 user_id가 없고
# (기기 하나 = 사용자 하나), 파일 자체가 이미 한 사용자의 것이다.
# is_deleted도 넣지 않는다 — 삭제 전파를 위한 sync 장치이고, 전체 교체
# 복원에서는 "없으면 삭제된 것"이라 표현할 자리가 필요 없다.
BOOK_FIELDS = (
    "id",
    "title",
    "description",
    "created_at",
    "updated_at",
)

WORD_FIELDS = (
    "id",
    "word_book_id",
    "term",
    "meaning",
    "pronunciation",
    "description",
    "example",
    "example_meaning",
    "image_path",
    "memorization_status",
    "is_bookmarked",
    "tags",
    "srs_ease_factor",
    "srs_interval_days",
    "srs_repetitions",
    "srs_lapses",
    "srs_due_at",
    "srs_last_reviewed_at",
    "created_at",
    "updated_at",
)


def dsn() -> str:
    """SQLAlchemy URL(postgresql+psycopg://)을 psycopg가 먹는 형태로 바꾼다."""
    url = os.environ.get("DATABASE_URL")
    if not url:
        sys.exit("DATABASE_URL이 없다. 컨테이너 안에서 실행하고 있는지 확인할 것.")
    return url.replace("postgresql+psycopg://", "postgresql://", 1)


def jsonable(value):
    if isinstance(value, datetime):
        # naive면 UTC로 간주한다 — Hub는 전부 timezone=True로 저장하므로
        # 여기 걸리는 값이 있으면 그 자체가 신호다.
        if value.tzinfo is None:
            value = value.replace(tzinfo=timezone.utc)
        return value.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")
    if isinstance(value, date):
        return value.isoformat()
    return value


def pick(row: dict, fields) -> dict:
    return {name: jsonable(row[name]) for name in fields}


def write_json(path: Path, payload: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as handle:
        json.dump(payload, handle, ensure_ascii=False, indent=2, default=jsonable)
        handle.write("\n")


def list_users(conn) -> list[dict]:
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            SELECT user_id,
                   COUNT(*) FILTER (WHERE NOT is_deleted) AS live_books,
                   COUNT(*) FILTER (WHERE is_deleted)     AS deleted_books
              FROM word_books
             GROUP BY user_id
            """
        )
        books = {row["user_id"]: row for row in cur.fetchall()}

        cur.execute(
            """
            SELECT user_id,
                   COUNT(*) FILTER (WHERE NOT is_deleted) AS live_words,
                   COUNT(*) FILTER (WHERE is_deleted)     AS deleted_words,
                   MAX(updated_at)                        AS last_updated
              FROM words
             GROUP BY user_id
            """
        )
        words = {row["user_id"]: row for row in cur.fetchall()}

    users = []
    for user_id in sorted(set(books) | set(words)):
        book = books.get(user_id, {})
        word = words.get(user_id, {})
        users.append(
            {
                "user_id": user_id,
                "live_books": book.get("live_books", 0),
                "deleted_books": book.get("deleted_books", 0),
                "live_words": word.get("live_words", 0),
                "deleted_words": word.get("deleted_words", 0),
                "last_updated": jsonable(word.get("last_updated")),
            }
        )
    return users


def export_user(conn, user_id: str, out_dir: Path) -> dict:
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            "SELECT * FROM word_books WHERE user_id = %s ORDER BY created_at",
            (user_id,),
        )
        books = cur.fetchall()

        cur.execute(
            "SELECT * FROM words WHERE user_id = %s ORDER BY created_at",
            (user_id,),
        )
        words = cur.fetchall()

        cur.execute(
            "SELECT COALESCE(MAX(cursor), 0) AS cursor FROM sync_changes WHERE user_id = %s",
            (user_id,),
        )
        cursor = cur.fetchone()["cursor"]

    now = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    safe_uid = "".join(ch if ch.isalnum() or ch in "-_" else "_" for ch in user_id)

    # 1) 원본 archive — 손실 없이 전부
    write_json(
        out_dir / f"nyaki-hub-raw-{safe_uid}.json",
        {
            "source": "nyaki-hub-postgres",
            "exported_at": now,
            "user_id": user_id,
            "sync_cursor": cursor,
            "word_books": books,
            "words": words,
        },
    )

    # 2) schema_version 1 정본 후보 — 살아있는 것만
    live_books = [b for b in books if not b["is_deleted"]]
    live_words = [w for w in words if not w["is_deleted"]]

    # 부모가 죽었는데 자식이 살아 있는 행은 결함 B(삭제 절반 전파)의 흔적이다.
    # 조용히 버리지 않고 세어서 보고한다.
    live_book_ids = {b["id"] for b in live_books}
    orphans = [w for w in live_words if w["word_book_id"] not in live_book_ids]

    write_json(
        out_dir / f"nyaki-backup-{safe_uid}.json",
        {
            "schema_version": 1,
            "exported_at": now,
            "device_id": "hub-export",
            "word_books": [pick(b, BOOK_FIELDS) for b in live_books],
            "words": [
                pick(w, WORD_FIELDS)
                for w in live_words
                if w["word_book_id"] in live_book_ids
            ],
        },
    )

    return {
        "user_id": user_id,
        "books": len(live_books),
        "words": len(live_words) - len(orphans),
        "tombstones": (len(books) - len(live_books)) + (len(words) - len(live_words)),
        "orphan_words": len(orphans),
        "sync_cursor": cursor,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Hub -> 백업 JSON 내보내기")
    parser.add_argument("--list", action="store_true", help="사용자와 개수만 보여준다")
    parser.add_argument("--user-id", help="이 사용자만 내보낸다")
    parser.add_argument("--all", action="store_true", help="데이터가 있는 사용자 전부")
    parser.add_argument("--out", default="/tmp/nyaki-export", help="출력 디렉터리")
    args = parser.parse_args()

    with psycopg.connect(dsn()) as conn:
        users = list_users(conn)

        if args.list or not (args.all or args.user_id):
            if not users:
                print("데이터가 있는 사용자가 없다.")
                return
            print(f"{'user_id':<32} {'books':>6} {'words':>7} {'tomb':>6}  last_updated")
            for u in users:
                tomb = u["deleted_books"] + u["deleted_words"]
                print(
                    f"{u['user_id']:<32} {u['live_books']:>6} {u['live_words']:>7} "
                    f"{tomb:>6}  {u['last_updated'] or '-'}"
                )
            if not (args.all or args.user_id):
                print("\n내보내려면 --all 또는 --user-id <uid>")
            return

        targets = [args.user_id] if args.user_id else [u["user_id"] for u in users]
        out_dir = Path(args.out)

        for user_id in targets:
            report = export_user(conn, user_id, out_dir)
            print(json.dumps(report, ensure_ascii=False))

        print(f"\n-> {out_dir}")


if __name__ == "__main__":
    main()
