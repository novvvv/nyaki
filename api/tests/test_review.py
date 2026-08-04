from datetime import datetime, timedelta, timezone

from fastapi.testclient import TestClient

from app.auth import get_current_user_id
from app.database import Base, engine
from app.main import app


def _word(word_id: str, due_offset_minutes: int, is_deleted: bool = False) -> dict:
    now = datetime.now(timezone.utc)
    due = now + timedelta(minutes=due_offset_minutes)
    return {
        "id": word_id,
        "word_book_id": "book-1",
        "term": word_id,
        "meaning": "뜻",
        "memorization_status": "unmemorized",
        "srs_due_at": due.isoformat(),
        "created_at": now.isoformat(),
        "updated_at": now.isoformat(),
        "is_deleted": is_deleted,
    }


def test_review_due_returns_only_due_words_sorted_and_excludes_deleted() -> None:
    Base.metadata.create_all(bind=engine)
    app.dependency_overrides[get_current_user_id] = lambda: "firebase-user-review"
    client = TestClient(app)

    now = datetime.now(timezone.utc).isoformat()
    book = {
        "id": "book-1",
        "title": "복습 테스트",
        "created_at": now,
        "updated_at": now,
        "is_deleted": False,
    }
    assert client.put(f"/v1/word-books/{book['id']}", json=book).status_code == 200

    due_later = _word("word-later", due_offset_minutes=-5)
    due_earlier = _word("word-earlier", due_offset_minutes=-10)
    not_due = _word("word-future", due_offset_minutes=60)
    deleted_due = _word("word-deleted", due_offset_minutes=-5, is_deleted=True)

    for word in (due_later, due_earlier, not_due, deleted_due):
        resp = client.put(f"/v1/word-books/book-1/words/{word['id']}", json=word)
        assert resp.status_code == 200

    response = client.get("/v1/review/due")
    assert response.status_code == 200
    ids = [w["id"] for w in response.json()["words"]]
    assert ids == ["word-earlier", "word-later"]

    app.dependency_overrides.clear()


def test_review_due_respects_limit() -> None:
    Base.metadata.create_all(bind=engine)
    app.dependency_overrides[get_current_user_id] = lambda: "firebase-user-review-limit"
    client = TestClient(app)

    now = datetime.now(timezone.utc).isoformat()
    book = {
        "id": "book-2",
        "title": "복습 limit 테스트",
        "created_at": now,
        "updated_at": now,
        "is_deleted": False,
    }
    assert client.put(f"/v1/word-books/{book['id']}", json=book).status_code == 200

    for i in range(3):
        word = _word(f"limit-word-{i}", due_offset_minutes=-i)
        word["word_book_id"] = "book-2"
        assert (
            client.put(f"/v1/word-books/book-2/words/{word['id']}", json=word).status_code
            == 200
        )

    response = client.get("/v1/review/due?limit=2")
    assert response.status_code == 200
    assert len(response.json()["words"]) == 2

    app.dependency_overrides.clear()
