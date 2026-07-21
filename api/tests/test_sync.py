from datetime import datetime, timezone

from fastapi.testclient import TestClient

from app.auth import get_current_user_id
from app.database import Base, engine
from app.main import app


def _payload() -> dict:
    now = datetime.now(timezone.utc).isoformat()
    return {
        "id": "word-1",
        "word_book_id": "book-1",
        "term": "cat",
        "meaning": "고양이",
        "memorization_status": "unmemorized",
        "created_at": now,
        "updated_at": now,
        "is_deleted": False,
    }


def test_push_then_pull_returns_only_changed_records() -> None:
    Base.metadata.create_all(bind=engine)
    app.dependency_overrides[get_current_user_id] = lambda: "firebase-user-1"
    client = TestClient(app)

    now = datetime.now(timezone.utc).isoformat()
    book = {
        "id": "book-1",
        "title": "기초 영어",
        "created_at": now,
        "updated_at": now,
        "is_deleted": False,
    }
    pushed = client.post(
        "/v1/sync/push",
        json={
            "changes": [
                {"entity_type": "word_book", "action": "upsert", "word_book": book},
                {"entity_type": "word", "action": "upsert", "word": _payload()},
            ]
        },
    )
    assert pushed.status_code == 200
    assert pushed.json()["accepted"] == 2

    pulled = client.get("/v1/sync/pull?cursor=0")
    assert pulled.status_code == 200
    assert len(pulled.json()["changes"]) == 2

    nothing_new = client.get(f"/v1/sync/pull?cursor={pulled.json()['cursor']}")
    assert nothing_new.status_code == 200
    assert nothing_new.json()["changes"] == []

    app.dependency_overrides.clear()
