"""단어 묶음 담기 — 단어 다운로드의 "내 단어장에 담기".

여기서 지키는 것
- 새 단어장으로 담으면 단어장 · 단어 · 기록이 한 번에 생긴다
- 기존 단어장에 담으면 단어만 늘어난다
- 같은 id로 다시 보내면 아무것도 늘지 않는다 (재전송)
- 새 id로 다시 담으면 그대로 또 들어간다 (막지 않는다)
- 남의 단어장 · 지운 단어장에는 못 담는다
- "새 단어장"이라며 이미 있는 단어장 ID를 보내면 덮어쓰지 않고 409
- 중간에 실패하면 아무것도 남지 않는다
- 담은 단어장을 지우면 목록에서 빠진다
- 담은 단어는 앱이 sync/pull로 받는다
"""

import uuid
from datetime import datetime, timezone

import pytest
from fastapi.testclient import TestClient

from app.core.auth import get_current_user_id
from app.core.database import Base, engine
from app.main import app
from app.vocab import services

PACK = "conan-highway-last-dance"


def _client(user: str) -> TestClient:
    Base.metadata.create_all(bind=engine)
    app.dependency_overrides[get_current_user_id] = lambda: user
    return TestClient(app)


def _user() -> str:
    return f"pack-{uuid.uuid4().hex[:8]}"


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _instant(value: str) -> datetime:
    parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)


def _book(book_id: str) -> dict:
    return {
        "id": book_id,
        "title": "라스트 댄스 그대와 함께",
        "created_at": _now(),
        "updated_at": _now(),
    }


def _words(book_id: str, count: int, prefix: str = "w") -> list[dict]:
    return [
        {
            "id": f"{prefix}-{uuid.uuid4().hex[:8]}",
            "word_book_id": book_id,
            "term": f"単語{i}",
            "pronunciation": "たんご",
            "meaning": "단어",
            "created_at": _now(),
            "updated_at": _now(),
        }
        for i in range(count)
    ]


def _import(
    client: TestClient,
    book_id: str,
    words: list[dict],
    *,
    new_book: bool,
    import_id: str | None = None,
):
    body: dict = {
        "id": import_id or f"import-{uuid.uuid4().hex[:8]}",
        "pack_id": PACK,
        "word_book_id": book_id,
        "words": words,
    }
    if new_book:
        body["word_book"] = _book(book_id)
    return client.post("/v1/pack-imports", json=body)


def _summary(client: TestClient, book_id: str) -> dict:
    rows = client.get("/v1/word-books/summaries").json()
    return next(row for row in rows if row["word_book_id"] == book_id)


def test_import_into_a_new_book_creates_book_words_and_record() -> None:
    client = _client(_user())

    response = _import(client, "book-new", _words("book-new", 3), new_book=True)

    assert response.status_code == 201, response.text
    body = response.json()
    assert body["pack_id"] == PACK
    assert body["word_book_id"] == "book-new"
    assert body["word_count"] == 3

    books = client.get("/v1/word-books").json()
    assert [book["id"] for book in books] == ["book-new"]
    assert len(client.get("/v1/word-books/book-new/words").json()) == 3
    # 단어를 넣으면 카드도 생겨 바로 복습에 나온다.
    assert _summary(client, "book-new")["card_count"] == 3

    imports = client.get("/v1/pack-imports").json()
    assert [row["id"] for row in imports] == [body["id"]]


def test_import_into_an_existing_book_only_adds_words() -> None:
    client = _client(_user())
    _import(client, "book-a", _words("book-a", 2), new_book=True)

    response = _import(client, "book-a", _words("book-a", 3), new_book=False)

    assert response.status_code == 201, response.text
    assert len(client.get("/v1/word-books").json()) == 1
    assert len(client.get("/v1/word-books/book-a/words").json()) == 5


def test_resending_the_same_import_id_adds_nothing() -> None:
    client = _client(_user())
    words = _words("book-r", 4)

    first = _import(client, "book-r", words, new_book=True, import_id="import-same")
    again = _import(client, "book-r", words, new_book=True, import_id="import-same")

    assert first.status_code == 201
    assert again.status_code == 200
    # 처음 기록을 그대로 돌려준다. 시각은 같은 순간인지로 본다 — SQLite는
    # 읽어올 때 시간대 표시를 떼어서 문자열이 "…Z"와 "…"로 갈린다(Postgres는 안 그렇다).
    first_body, again_body = first.json(), again.json()
    assert _instant(again_body.pop("imported_at")) == _instant(first_body.pop("imported_at"))
    assert again_body == first_body
    assert len(client.get("/v1/word-books/book-r/words").json()) == 4
    assert len(client.get("/v1/pack-imports").json()) == 1


def test_importing_the_same_pack_again_is_allowed() -> None:
    """같은 묶음을 또 담는 건 막지 않는다. 화면이 경고만 한다."""
    client = _client(_user())
    _import(client, "book-d", _words("book-d", 3, "first"), new_book=True)

    again = _import(client, "book-d", _words("book-d", 3, "second"), new_book=False)

    assert again.status_code == 201
    assert len(client.get("/v1/word-books/book-d/words").json()) == 6
    imports = client.get("/v1/pack-imports").json()
    assert [row["pack_id"] for row in imports] == [PACK, PACK]


def test_cannot_import_into_someone_elses_book() -> None:
    owner = _user()
    _import(_client(owner), "book-owner", _words("book-owner", 1), new_book=True)

    stranger = _client(_user())
    response = _import(stranger, "book-owner", _words("book-owner", 1), new_book=False)

    assert response.status_code == 404
    # 주인의 단어장은 그대로다.
    owner_client = _client(owner)
    assert len(owner_client.get("/v1/word-books/book-owner/words").json()) == 1


def test_cannot_import_into_a_deleted_book() -> None:
    client = _client(_user())
    _import(client, "book-gone", _words("book-gone", 1), new_book=True)
    assert client.delete("/v1/word-books/book-gone").status_code == 204

    response = _import(client, "book-gone", _words("book-gone", 1), new_book=False)

    assert response.status_code == 404


def test_new_book_with_an_existing_id_is_409_and_does_not_overwrite() -> None:
    client = _client(_user())
    _import(client, "book-x", _words("book-x", 1), new_book=True)
    renamed = {**_book("book-x"), "title": "덮어쓰면 안 되는 제목"}

    response = client.post(
        "/v1/pack-imports",
        json={
            "id": "import-conflict",
            "pack_id": PACK,
            "word_book_id": "book-x",
            "word_book": renamed,
            "words": _words("book-x", 2),
        },
    )

    assert response.status_code == 409
    books = client.get("/v1/word-books").json()
    assert books[0]["title"] == "라스트 댄스 그대와 함께"
    assert len(client.get("/v1/word-books/book-x/words").json()) == 1


def test_mismatched_ids_are_400() -> None:
    client = _client(_user())

    book_mismatch = client.post(
        "/v1/pack-imports",
        json={
            "id": "import-1",
            "pack_id": PACK,
            "word_book_id": "book-1",
            "word_book": _book("book-other"),
            "words": _words("book-1", 1),
        },
    )
    word_mismatch = _import(client, "book-2", _words("book-elsewhere", 1), new_book=True)

    assert book_mismatch.status_code == 400
    assert word_mismatch.status_code == 400
    assert client.get("/v1/word-books").json() == []


def test_failure_in_the_middle_leaves_nothing(monkeypatch: pytest.MonkeyPatch) -> None:
    """단어를 넣다 터지면 단어장도, 앞서 넣은 단어도, 기록도 남지 않는다."""
    client = _client(_user())
    real_upsert = services.upsert_word
    calls = {"count": 0}

    def flaky_upsert(session, user_id, payload):
        calls["count"] += 1
        if calls["count"] == 3:
            raise RuntimeError("중간 실패")
        return real_upsert(session, user_id, payload)

    monkeypatch.setattr(services, "upsert_word", flaky_upsert)

    with pytest.raises(RuntimeError):
        _import(client, "book-half", _words("book-half", 5), new_book=True)

    monkeypatch.undo()
    assert client.get("/v1/word-books").json() == []
    assert client.get("/v1/pack-imports").json() == []


def test_deleted_book_drops_out_of_the_import_list() -> None:
    client = _client(_user())
    _import(client, "book-keep", _words("book-keep", 1), new_book=True)
    _import(client, "book-drop", _words("book-drop", 1), new_book=True)

    assert client.delete("/v1/word-books/book-drop").status_code == 204

    imports = client.get("/v1/pack-imports").json()
    assert [row["word_book_id"] for row in imports] == ["book-keep"]


def test_imported_words_reach_the_app_through_sync_pull() -> None:
    client = _client(_user())
    words = _words("book-sync", 2)
    _import(client, "book-sync", words, new_book=True)

    pulled = client.get("/v1/sync/pull?cursor=0").json()["changes"]

    pulled_books = {c["word_book"]["id"] for c in pulled if c["entity_type"] == "word_book"}
    pulled_words = {c["word"]["id"] for c in pulled if c["entity_type"] == "word"}
    assert pulled_books == {"book-sync"}
    assert pulled_words == {word["id"] for word in words}


def test_word_count_limits_are_422() -> None:
    client = _client(_user())

    empty = _import(client, "book-0", [], new_book=True)
    too_many = _import(client, "book-501", _words("book-501", 501), new_book=True)

    assert empty.status_code == 422
    assert too_many.status_code == 422
