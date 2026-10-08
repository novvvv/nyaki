"""부분 수정이 복습 기록을 지우지 않는지 — ARCHITECTURE.md §4.6.

웹은 단어를 저장할 때 srs_* 를 보내지 않는다. 예전에는 upsert가 payload 전체를
덮어써서, 뜻 한 글자만 고쳐도 그 단어의 SM-2 진행(간격·횟수·다음 복습일)이
통째로 초기화됐다. 사용자에게는 아무 표시도 없이 단어가 처음 상태로 돌아갔다.
"""

from datetime import datetime, timedelta, timezone

from fastapi.testclient import TestClient

from app.core.auth import get_current_user_id
from app.core.database import Base, engine
from app.main import app

USER = "firebase-user-partial"
BOOK_ID = "book-partial"
WORD_ID = "word-partial"


def _client() -> TestClient:
    Base.metadata.create_all(bind=engine)
    app.dependency_overrides[get_current_user_id] = lambda: USER
    return TestClient(app)


def test_updating_content_keeps_srs_progress() -> None:
    client = _client()
    now = datetime.now(timezone.utc)
    due = now + timedelta(days=50)

    assert (
        client.put(
            f"/v1/word-books/{BOOK_ID}",
            json={
                "id": BOOK_ID,
                "title": "부분 수정",
                "created_at": now.isoformat(),
                "updated_at": now.isoformat(),
                "is_deleted": False,
            },
        ).status_code
        == 200
    )

    # 앱이 동기화로 올린 상태 — 50일 간격까지 올라간 단어.
    created = client.put(
        f"/v1/word-books/{BOOK_ID}/words/{WORD_ID}",
        json={
            "id": WORD_ID,
            "word_book_id": BOOK_ID,
            "term": "cat",
            "meaning": "고양이",
            "memorization_status": "memorized",
            "srs_ease_factor": 2.6,
            "srs_interval_days": 50,
            "srs_repetitions": 5,
            "srs_lapses": 1,
            "srs_due_at": due.isoformat(),
            "created_at": now.isoformat(),
            "updated_at": now.isoformat(),
            "is_deleted": False,
        },
    )
    assert created.status_code == 200
    assert created.json()["srs_interval_days"] == 50

    # 웹이 뜻만 고쳐 저장한다 — srs_* 를 보내지 않는다.
    later = (now + timedelta(minutes=1)).isoformat()
    updated = client.put(
        f"/v1/word-books/{BOOK_ID}/words/{WORD_ID}",
        json={
            "id": WORD_ID,
            "word_book_id": BOOK_ID,
            "term": "cat",
            "meaning": "고양이(수정)",
            "memorization_status": "memorized",
            "is_bookmarked": False,
            "tags": [],
            "created_at": now.isoformat(),
            "updated_at": later,
            "is_deleted": False,
        },
    )
    assert updated.status_code == 200

    body = updated.json()
    assert body["meaning"] == "고양이(수정)"
    # 복습 기록은 그대로여야 한다.
    assert body["srs_interval_days"] == 50
    assert body["srs_repetitions"] == 5
    assert body["srs_lapses"] == 1
    assert body["srs_ease_factor"] == 2.6
    assert body["srs_due_at"].startswith(due.isoformat()[:16])


def test_new_word_without_srs_is_due_immediately() -> None:
    """새로 만들 때는 기본값이 그대로 들어가야 한다 — 즉시 복습 대상."""
    client = _client()
    now = datetime.now(timezone.utc)

    created = client.put(
        f"/v1/word-books/{BOOK_ID}/words/{WORD_ID}-new",
        json={
            "id": f"{WORD_ID}-new",
            "word_book_id": BOOK_ID,
            "term": "nap",
            "meaning": "낮잠",
            "created_at": now.isoformat(),
            "updated_at": now.isoformat(),
            "is_deleted": False,
        },
    )
    assert created.status_code == 200

    body = created.json()
    assert body["srs_interval_days"] == 0
    assert body["srs_repetitions"] == 0
    assert body["srs_due_at"].startswith(now.isoformat()[:16])
