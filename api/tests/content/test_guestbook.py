"""방명록(2026-10-26) 검증용 테스트.

무엇을 확인하는가:
- 읽기는 로그인 없이, 쓰기는 로그인해야 하고 작성자 이름은 토큰의 구글 이름으로 남는가
- 빈 글·너무 긴 글은 막고, 같은 사람이 연달아 쓰면 429인가
- can_delete가 보는 사람 기준(본인·관리자만 true)이고, 작성자 uid는 응답에 없는가
- 남의 글은 못 지우고(403) 본인·관리자는 지울 수 있는가
- before_id로 이전 글을 이어 받는가

어떻게 확인하는가: test_fish.py와 같이 인증 의존성을 가짜로 바꿔치기하고 TestClient로 호출.
연달아 쓰기 제한은 services.GUESTBOOK_COOLDOWN_SECONDS를 잠깐 0으로 바꿔 넘긴다.
"""

from fastapi.testclient import TestClient

from app.content import routes
from app.core.auth import CurrentUser, get_current_user, get_current_user_id, get_optional_user_id
from app.core.database import Base, engine
from app.main import app


def _login(uid: str, name: str = "") -> None:
    app.dependency_overrides[get_current_user] = lambda: CurrentUser(uid=uid, name=name)
    app.dependency_overrides[get_current_user_id] = lambda: uid
    app.dependency_overrides[get_optional_user_id] = lambda: uid


def test_guestbook_write_list_delete(monkeypatch) -> None:  # noqa: ANN001
    Base.metadata.create_all(bind=engine)
    monkeypatch.setattr(routes, "is_admin", lambda uid: uid == "admin-uid")
    client = TestClient(app)

    # 로그인 안 하면 못 쓴다
    assert client.post("/v1/content/guestbook", json={"body": "안녕"}).status_code == 401

    _login("user-a", "도일")
    r = client.post("/v1/content/guestbook", json={"body": "  첫 글이에요  "})
    assert r.status_code == 201
    first = r.json()
    assert first["author_name"] == "도일"
    assert first["body"] == "첫 글이에요"
    assert first["can_delete"] is True
    assert "user_id" not in first

    # 빈 글·너무 긴 글
    assert client.post("/v1/content/guestbook", json={"body": "   "}).status_code == 422
    assert client.post("/v1/content/guestbook", json={"body": "가" * 501}).status_code == 422

    # 바로 또 쓰면 429
    assert client.post("/v1/content/guestbook", json={"body": "또"}).status_code == 429

    monkeypatch.setattr(routes, "GUESTBOOK_COOLDOWN_SECONDS", 0)
    second = client.post("/v1/content/guestbook", json={"body": "두 번째"}).json()

    # 이름이 없는 계정은 "익명"
    _login("user-b")
    third = client.post("/v1/content/guestbook", json={"body": "다른 사람"}).json()
    assert third["author_name"] == "익명"

    # 최신순, before_id로 이어 받기
    ids = [e["id"] for e in client.get("/v1/content/guestbook").json()]
    assert ids[:3] == [third["id"], second["id"], first["id"]]
    older = client.get(f"/v1/content/guestbook?before_id={second['id']}").json()
    assert [e["id"] for e in older][:1] == [first["id"]]

    # can_delete는 보는 사람 기준 — 로그인 안 하면 전부 false
    by_id = {e["id"]: e for e in client.get("/v1/content/guestbook").json()}
    assert by_id[third["id"]]["can_delete"] is True
    assert by_id[first["id"]]["can_delete"] is False
    app.dependency_overrides.clear()
    assert not any(e["can_delete"] for e in client.get("/v1/content/guestbook").json())

    # 남의 글은 못 지우고, 본인·관리자는 지운다
    _login("user-b")
    assert client.delete(f"/v1/content/guestbook/{first['id']}").status_code == 403
    assert client.delete(f"/v1/content/guestbook/{third['id']}").status_code == 204
    assert client.delete(f"/v1/content/guestbook/{third['id']}").status_code == 404
    _login("admin-uid")
    assert client.get("/v1/content/guestbook").json()[0]["can_delete"] is True
    assert client.delete(f"/v1/content/guestbook/{first['id']}").status_code == 204

    remaining = [e["id"] for e in client.get("/v1/content/guestbook").json()]
    assert first["id"] not in remaining and third["id"] not in remaining
    assert second["id"] in remaining

    app.dependency_overrides.clear()
