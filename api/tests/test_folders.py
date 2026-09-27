"""폴더 — 단어장의 상위 개념.

한 단계뿐이다. 폴더 안에 폴더는 없다.

여기서 지키는 것
- 단어장은 폴더에 안 속해도 된다
- 폴더를 지우면 **안의 단어장과 그 단어까지** 함께 지워진다
- 폴더 밖 단어장은 폴더를 지워도 남는다
- 폴더도 순서를 갖는다 (단어장과 같은 규칙)
- 동기화로 폴더가 오르내린다
"""

from datetime import datetime, timezone

from fastapi.testclient import TestClient

from app.core.auth import get_current_user_id
from app.core.database import Base, engine
from app.main import app


def _client(user: str) -> TestClient:
    Base.metadata.create_all(bind=engine)
    app.dependency_overrides[get_current_user_id] = lambda: user
    return TestClient(app)


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _put_folder(client: TestClient, folder_id: str, title: str | None = None) -> dict:
    response = client.put(
        f"/v1/folders/{folder_id}",
        json={
            "id": folder_id,
            "title": title or folder_id,
            "created_at": _now(),
            "updated_at": _now(),
            "is_deleted": False,
        },
    )
    assert response.status_code == 200, response.text
    return response.json()


def _put_book(client: TestClient, book_id: str, folder_id: str | None = None) -> dict:
    body: dict = {
        "id": book_id,
        "title": book_id,
        "created_at": _now(),
        "updated_at": _now(),
        "is_deleted": False,
    }
    if folder_id is not None:
        body["folder_id"] = folder_id

    response = client.put(f"/v1/word-books/{book_id}", json=body)
    assert response.status_code == 200, response.text
    return response.json()


def _put_word(client: TestClient, book_id: str, word_id: str) -> None:
    assert (
        client.put(
            f"/v1/word-books/{book_id}/words/{word_id}",
            json={
                "id": word_id,
                "word_book_id": book_id,
                "term": word_id,
                "meaning": "뜻",
                "created_at": _now(),
                "updated_at": _now(),
                "is_deleted": False,
            },
        ).status_code
        == 200
    )


def _book_ids(client: TestClient) -> list[str]:
    return [book["id"] for book in client.get("/v1/word-books").json()]


def test_word_books_may_live_outside_a_folder() -> None:
    """기존 단어장을 전부 어딘가에 넣도록 강제하지 않는다."""
    client = _client("firebase-user-folder-loose")

    book = _put_book(client, "loose")

    assert book["folder_id"] is None
    assert _book_ids(client) == ["loose"]

    app.dependency_overrides.clear()


def test_book_can_be_put_in_and_taken_out() -> None:
    client = _client("firebase-user-folder-move")
    _put_folder(client, "f1", "일본어")
    _put_book(client, "b1")

    assert _put_book(client, "b1", folder_id="f1")["folder_id"] == "f1"

    # 꺼낼 때는 null을 명시해야 한다 — 안 보내면 서버가 기존 값을 유지한다.
    response = client.put(
        "/v1/word-books/b1",
        json={
            "id": "b1",
            "title": "b1",
            "folder_id": None,
            "created_at": _now(),
            "updated_at": _now(),
            "is_deleted": False,
        },
    )
    assert response.json()["folder_id"] is None

    app.dependency_overrides.clear()


def test_deleting_a_folder_deletes_the_books_inside() -> None:
    """화면이 미리 알려주고 통째로 지운다."""
    client = _client("firebase-user-folder-cascade")
    _put_folder(client, "f1")
    _put_book(client, "inside", folder_id="f1")
    _put_word(client, "inside", "w1")
    _put_book(client, "outside")

    assert client.delete("/v1/folders/f1").status_code == 204

    assert client.get("/v1/folders").json() == []
    # 폴더 밖 단어장은 남는다.
    assert _book_ids(client) == ["outside"]
    # 단어장이 사라졌으므로 조회 자체가 404다.
    assert client.get("/v1/word-books/inside/words").status_code == 404
    # 안의 단어와 카드까지 함께 지워진다 — 남으면 출제 목록에 유령이 뜬다.
    due = client.get("/v1/review/due?limit=9999").json()["cards"]
    assert [card["id"] for card in due] == []

    app.dependency_overrides.clear()


def test_deleting_a_missing_folder_is_404() -> None:
    client = _client("firebase-user-folder-404")
    assert client.delete("/v1/folders/nope").status_code == 404

    app.dependency_overrides.clear()


def test_folders_keep_their_own_order() -> None:
    client = _client("firebase-user-folder-order")
    _put_folder(client, "a")
    _put_folder(client, "b")

    folders = client.get("/v1/folders").json()
    assert [f["id"] for f in folders] == ["a", "b"]
    assert [f["sort_order"] for f in folders] == [1.0, 2.0]

    # b를 맨 앞으로.
    client.put(
        "/v1/folders/b",
        json={
            "id": "b",
            "title": "b",
            "sort_order": 0.5,
            "created_at": _now(),
            "updated_at": _now(),
            "is_deleted": False,
        },
    )
    assert [f["id"] for f in client.get("/v1/folders").json()] == ["b", "a"]

    app.dependency_overrides.clear()


def test_folders_ride_the_sync_channel() -> None:
    """앱도 폴더를 받아갈 수 있어야 한다."""
    client = _client("firebase-user-folder-sync")
    _put_folder(client, "f1", "시험")

    changes = client.get("/v1/sync/pull?cursor=0").json()["changes"]
    folder = next(c for c in changes if c["entity_type"] == "folder")

    assert folder["folder"]["title"] == "시험"

    # 앱이 올리는 경로도 열려 있어야 한다.
    pushed = client.post(
        "/v1/sync/push",
        json={
            "changes": [
                {
                    "entity_type": "folder",
                    "action": "upsert",
                    "folder": {
                        "id": "f2",
                        "title": "앱에서 만든 폴더",
                        "created_at": _now(),
                        "updated_at": _now(),
                        "is_deleted": False,
                    },
                }
            ]
        },
    )
    assert pushed.status_code == 200, pushed.text
    assert [f["id"] for f in client.get("/v1/folders").json()] == ["f1", "f2"]

    app.dependency_overrides.clear()


def test_other_users_folders_are_invisible() -> None:
    client = _client("firebase-user-folder-mine")
    _put_folder(client, "mine")

    other = _client("firebase-user-folder-theirs")

    assert [f["id"] for f in other.get("/v1/folders").json()] == []

    app.dependency_overrides.clear()
