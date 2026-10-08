"""단어장 순서 — 사용자가 끌어서 직접 정한다.

전에는 생성일 고정이라 자주 보는 단어장을 위로 올릴 방법이 없었다.

여기서 지키는 것
- 정렬은 sort_order → (없으면) created_at
- 새 단어장은 맨 뒤로 간다
- 순서를 바꿀 때 **옮긴 행 하나만** 쓴다 (실수 자리를 쓰는 이유)
- 순서만 보내도 제목·설명이 지워지지 않는다
"""

from datetime import datetime, timedelta, timezone

from fastapi.testclient import TestClient

from app.core.auth import get_current_user_id
from app.core.database import Base, engine
from app.main import app


def _client(user: str) -> TestClient:
    Base.metadata.create_all(bind=engine)
    app.dependency_overrides[get_current_user_id] = lambda: user
    return TestClient(app)


def _put_book(
    client: TestClient,
    book_id: str,
    *,
    title: str | None = None,
    created: datetime | None = None,
    sort_order: float | None = None,
) -> dict:
    stamp = (created or datetime.now(timezone.utc)).isoformat()
    body: dict = {
        "id": book_id,
        "title": title or book_id,
        "created_at": stamp,
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "is_deleted": False,
    }
    if sort_order is not None:
        body["sort_order"] = sort_order

    response = client.put(f"/v1/word-books/{book_id}", json=body)
    assert response.status_code == 200, response.text
    return response.json()


def _titles(client: TestClient) -> list[str]:
    return [book["id"] for book in client.get("/v1/word-books").json()]


def test_new_books_go_to_the_bottom() -> None:
    client = _client("firebase-user-order-new")
    now = datetime.now(timezone.utc)

    _put_book(client, "first", created=now - timedelta(days=2))
    _put_book(client, "second", created=now - timedelta(days=1))
    _put_book(client, "third", created=now)

    assert _titles(client) == ["first", "second", "third"]
    # 만든 순서대로 1, 2, 3을 받는다.
    orders = [book["sort_order"] for book in client.get("/v1/word-books").json()]
    assert orders == [1.0, 2.0, 3.0]

    app.dependency_overrides.clear()


def test_sort_order_beats_created_at() -> None:
    """나중에 만든 것을 맨 위로 올릴 수 있어야 한다."""
    client = _client("firebase-user-order-move")
    now = datetime.now(timezone.utc)

    _put_book(client, "a", created=now - timedelta(days=2))
    _put_book(client, "b", created=now - timedelta(days=1))
    _put_book(client, "c", created=now)

    # c를 맨 앞으로. 첫 자리 앞이므로 1보다 작은 값이면 된다.
    _put_book(client, "c", sort_order=0.5)

    assert _titles(client) == ["c", "a", "b"]

    app.dependency_overrides.clear()


def test_moving_between_two_books_writes_one_row() -> None:
    """3번과 4번 사이는 3.5다. 아래 행들을 다시 쓰지 않는다."""
    client = _client("firebase-user-order-midpoint")

    for name in ("a", "b", "c"):
        _put_book(client, name)

    before = {
        book["id"]: book["sort_order"]
        for book in client.get("/v1/word-books").json()
    }

    # a를 b와 c 사이로.
    _put_book(client, "a", sort_order=(before["b"] + before["c"]) / 2)

    after = {
        book["id"]: book["sort_order"]
        for book in client.get("/v1/word-books").json()
    }

    assert _titles(client) == ["b", "a", "c"]
    # 옮긴 것 말고는 그대로다.
    assert after["b"] == before["b"]
    assert after["c"] == before["c"]

    app.dependency_overrides.clear()


def test_reordering_keeps_the_rest_of_the_book() -> None:
    """순서만 보내도 제목·설명이 지워지면 안 된다(exclude_unset)."""
    client = _client("firebase-user-order-partial")

    now = datetime.now(timezone.utc).isoformat()
    client.put(
        "/v1/word-books/b1",
        json={
            "id": "b1",
            "title": "비즈니스 일본어",
            "description": "회의에서 쓰는 말",
            "created_at": now,
            "updated_at": now,
            "is_deleted": False,
        },
    )

    client.put(
        "/v1/word-books/b1",
        json={
            "id": "b1",
            "title": "비즈니스 일본어",
            "sort_order": 9.5,
            "created_at": now,
            "updated_at": datetime.now(timezone.utc).isoformat(),
            "is_deleted": False,
        },
    )

    book = client.get("/v1/word-books").json()[0]
    assert book["sort_order"] == 9.5
    assert book["description"] == "회의에서 쓰는 말"

    app.dependency_overrides.clear()


def test_books_without_an_order_go_last() -> None:
    """구버전 클라이언트가 만든 행은 null이다. 맨 뒤로 보낸다."""
    client = _client("firebase-user-order-null")
    now = datetime.now(timezone.utc)

    _put_book(client, "ordered", created=now, sort_order=1.0)

    # 동기화로 들어온 것처럼 sort_order 없이 직접 만든 행.
    from app.core.database import SessionLocal
    from app.models import WordBookModel

    with SessionLocal() as session:
        session.add(
            WordBookModel(
                id="legacy",
                user_id="firebase-user-order-null",
                title="legacy",
                sort_order=None,
                created_at=now - timedelta(days=5),
                updated_at=now - timedelta(days=5),
            )
        )
        session.commit()

    assert _titles(client) == ["ordered", "legacy"]

    app.dependency_overrides.clear()
