"""단어장을 지우면 빈칸 노트도 같이 지워진다.

단어장 삭제가 단어와 단어 카드만 지우고 빈칸 노트 · 빈칸 카드는 남겨뒀다.
출제도 단어장이 살아 있는지 보지 않아서, 지운 단어장의 빈칸 카드가 복습에
계속 나왔다.

여기서 지키는 것
- 단어장을 지우면 그 안의 빈칸 노트와 빈칸 카드도 지워진다
- 폴더를 지울 때도 같다 (폴더 삭제는 단어장 삭제를 부른다)
- 지운 단어장의 빈칸 카드는 복습 목록 · 개수에 나오지 않는다 — 노트가
  살아 있더라도 (앱이 오프라인에서 만든 노트가 단어장 삭제 뒤에 늦게 올라오는 경우)
- 다른 단어장의 빈칸 노트는 그대로다
"""

import uuid
from datetime import datetime, timezone

from fastapi.testclient import TestClient

from app.core.auth import get_current_user_id
from app.core.database import Base, engine
from app.main import app


def _client() -> TestClient:
    Base.metadata.create_all(bind=engine)
    user = f"book-delete-{uuid.uuid4().hex[:8]}"
    app.dependency_overrides[get_current_user_id] = lambda: user
    return TestClient(app)


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _book(client: TestClient, book_id: str, folder_id: str | None = None) -> None:
    body = {"id": book_id, "title": book_id, "created_at": _now(), "updated_at": _now()}
    if folder_id:
        body["folder_id"] = folder_id
    assert client.put(f"/v1/word-books/{book_id}", json=body).status_code == 200


def _note(client: TestClient, book_id: str, note_id: str) -> None:
    assert (
        client.put(
            f"/v1/word-books/{book_id}/cloze-notes/{note_id}",
            json={
                "id": note_id,
                "word_book_id": book_id,
                "text": "{{c1::猫}}が好き",
                "created_at": _now(),
                "updated_at": _now(),
            },
        ).status_code
        == 200
    )


def _due_note_ids(client: TestClient) -> set[str]:
    cards = client.get("/v1/review/due?limit=100").json()["cards"]
    return {card["cloze"]["note_id"] for card in cards if card["cloze"]}


def _due_books(client: TestClient) -> set[str]:
    return set(client.get("/v1/review/due/count").json()["by_book"])


def test_deleting_a_book_deletes_its_cloze_notes() -> None:
    client = _client()
    _book(client, "gone")
    _book(client, "kept")
    _note(client, "gone", "n-gone")
    _note(client, "kept", "n-kept")
    assert _due_note_ids(client) == {"n-gone", "n-kept"}

    assert client.delete("/v1/word-books/gone").status_code == 204

    # 노트가 지워졌으니 동기화로 받는 쪽에서도 지워진 상태로 보인다.
    pulled = client.get("/v1/sync/pull?cursor=0").json()["changes"]
    notes = {c["cloze_note"]["id"]: c["cloze_note"] for c in pulled if c["cloze_note"]}
    assert notes["n-gone"]["is_deleted"] is True
    assert notes["n-kept"]["is_deleted"] is False

    assert _due_note_ids(client) == {"n-kept"}
    assert _due_books(client) == {"kept"}


def test_deleting_a_folder_deletes_cloze_notes_of_its_books() -> None:
    client = _client()
    assert (
        client.put(
            "/v1/folders/f1",
            json={"id": "f1", "title": "폴더", "created_at": _now(), "updated_at": _now()},
        ).status_code
        == 200
    )
    _book(client, "in-folder", folder_id="f1")
    _note(client, "in-folder", "n1")

    assert client.delete("/v1/folders/f1").status_code == 204

    assert _due_note_ids(client) == set()
    assert _due_books(client) == set()


def test_late_note_in_a_deleted_book_is_not_due() -> None:
    """단어장을 지운 뒤에 노트가 늦게 올라와도 출제하지 않는다."""
    client = _client()
    _book(client, "late")
    assert client.delete("/v1/word-books/late").status_code == 204

    # 앱이 오프라인에서 만든 노트가 동기화로 뒤늦게 들어온다.
    assert (
        client.post(
            "/v1/sync/push",
            json={
                "changes": [
                    {
                        "entity_type": "cloze_note",
                        "action": "upsert",
                        "cloze_note": {
                            "id": "n-late",
                            "word_book_id": "late",
                            "text": "{{c1::犬}}",
                            "created_at": _now(),
                            "updated_at": _now(),
                        },
                    }
                ]
            },
        ).status_code
        == 200
    )

    assert _due_note_ids(client) == set()
    assert _due_books(client) == set()
