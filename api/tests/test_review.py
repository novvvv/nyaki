from datetime import datetime, timedelta, timezone

from fastapi.testclient import TestClient

from app.core.auth import get_current_user_id
from app.core.database import Base, engine
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

# ==================== POST /v1/review/grades ====================


def _setup(user: str, book_id: str) -> TestClient:
    Base.metadata.create_all(bind=engine)
    app.dependency_overrides[get_current_user_id] = lambda: user
    client = TestClient(app)
    now = datetime.now(timezone.utc).isoformat()
    book = {
        "id": book_id,
        "title": "채점 테스트",
        "created_at": now,
        "updated_at": now,
        "is_deleted": False,
    }
    assert client.put(f"/v1/word-books/{book_id}", json=book).status_code == 200
    return client


def _put_word(client: TestClient, book_id: str, word_id: str) -> None:
    word = _word(word_id, due_offset_minutes=-5)
    word["word_book_id"] = book_id
    assert (
        client.put(f"/v1/word-books/{book_id}/words/{word_id}", json=word).status_code
        == 200
    )


def _grade(word_id: str, grade: str, log_id: str) -> dict:
    return {
        "id": log_id,
        "word_id": word_id,
        "grade": grade,
        "reviewed_at": datetime.now(timezone.utc).isoformat(),
    }


def test_grades_good_pushes_due_out_and_sets_srs() -> None:
    client = _setup("firebase-user-grade-good", "book-grade-1")
    _put_word(client, "book-grade-1", "w1")

    resp = client.post(
        "/v1/review/grades",
        json={"grades": [_grade("w1", "good", "rv-1")]},
    )
    assert resp.status_code == 200
    assert resp.json() == {"applied": 1, "skipped": 0, "missing": 0}

    # 첫 성공이므로 간격 1일. 더 이상 복습 대상이 아니다.
    assert client.get("/v1/review/due").json()["words"] == []

    app.dependency_overrides.clear()


def test_grades_again_keeps_word_due_immediately() -> None:
    client = _setup("firebase-user-grade-again", "book-grade-2")
    _put_word(client, "book-grade-2", "w1")

    resp = client.post(
        "/v1/review/grades",
        json={"grades": [_grade("w1", "again", "rv-again-1")]},
    )
    assert resp.json()["applied"] == 1

    # 모른 단어는 즉시 다시 대상이 된다 (relearning step 0).
    ids = [w["id"] for w in client.get("/v1/review/due").json()["words"]]
    assert ids == ["w1"]

    app.dependency_overrides.clear()


def test_resending_the_same_grades_changes_nothing() -> None:
    """재전송이 두 번 반영되면 복습 간격이 실제보다 훨씬 길어진다."""
    client = _setup("firebase-user-grade-dup", "book-grade-3")
    _put_word(client, "book-grade-3", "w1")

    body = {"grades": [_grade("w1", "good", "rv-dup-1")]}

    first = client.post("/v1/review/grades", json=body).json()
    assert first == {"applied": 1, "skipped": 0, "missing": 0}

    second = client.post("/v1/review/grades", json=body).json()
    assert second == {"applied": 0, "skipped": 1, "missing": 0}

    words = client.get("/v1/word-books/book-grade-3/words").json()
    word = next(w for w in words if w["id"] == "w1")
    # 두 번 반영됐다면 repetitions 2 / interval 3일이 됐을 것이다.
    assert word["srs_repetitions"] == 1
    assert word["srs_interval_days"] == 1

    app.dependency_overrides.clear()


def test_duplicate_ids_inside_one_request_apply_once() -> None:
    client = _setup("firebase-user-grade-dup2", "book-grade-4")
    _put_word(client, "book-grade-4", "w1")

    item = _grade("w1", "good", "rv-same")
    resp = client.post("/v1/review/grades", json={"grades": [item, item]}).json()
    assert resp == {"applied": 1, "skipped": 1, "missing": 0}

    app.dependency_overrides.clear()


def test_unknown_word_is_counted_as_missing() -> None:
    client = _setup("firebase-user-grade-missing", "book-grade-5")

    resp = client.post(
        "/v1/review/grades",
        json={"grades": [_grade("no-such-word", "good", "rv-missing-1")]},
    ).json()
    assert resp == {"applied": 0, "skipped": 0, "missing": 1}

    app.dependency_overrides.clear()


def test_grade_must_be_again_or_good() -> None:
    client = _setup("firebase-user-grade-invalid", "book-grade-6")

    resp = client.post(
        "/v1/review/grades",
        json={"grades": [_grade("w1", "easy", "rv-bad-1")]},
    )
    assert resp.status_code == 422

    app.dependency_overrides.clear()
