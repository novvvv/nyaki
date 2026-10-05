"""회원 탈퇴.

여기서 지키는 것
- 내 데이터가 사용자 테이블 **전부**에서 실제로 사라진다 (표시만 하는 게 아니다)
- 다른 사용자의 데이터는 그대로다
- 데이터를 지운 **다음에** Firebase 계정을 지운다
- 계정 삭제가 실패해도 다시 부르면 끝까지 간다
- 로그인 없이는 못 부른다
"""

import uuid
from datetime import datetime, timezone

import pytest
from fastapi.testclient import TestClient
from firebase_admin import auth
from sqlalchemy import func, select

from app.account.services import USER_TABLES
from app.core.auth import get_current_user_id
from app.core.database import Base, SessionLocal, engine
from app.main import app


def _client(user: str, **kwargs) -> TestClient:
    Base.metadata.create_all(bind=engine)
    app.dependency_overrides[get_current_user_id] = lambda: user
    return TestClient(app, **kwargs)


def _user() -> str:
    return f"account-{uuid.uuid4().hex[:8]}"


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _fill(client: TestClient) -> None:
    """사용자 테이블 10개에 전부 한 줄 이상 남긴다."""
    stamp = {"created_at": _now(), "updated_at": _now()}
    # 폴더
    assert client.put("/v1/folders/f1", json={"id": "f1", "title": "폴더", **stamp}).status_code == 200
    # 단어장 · 단어(→ 카드 · 동기화 기록)
    assert client.put("/v1/word-books/b1", json={"id": "b1", "title": "단어장", "folder_id": "f1", **stamp}).status_code == 200
    assert client.put(
        "/v1/word-books/b1/words/w1",
        json={"id": "w1", "word_book_id": "b1", "term": "猫", "meaning": "고양이", **stamp},
    ).status_code == 200
    # 빈칸 노트
    assert client.put(
        "/v1/word-books/b1/cloze-notes/n1",
        json={"id": "n1", "word_book_id": "b1", "text": "{{c1::猫}}が好き", **stamp},
    ).status_code == 200
    # 복습 기록
    assert client.post(
        "/v1/review/grades",
        json={"grades": [{"id": "g1", "word_id": "w1", "grade": "good", "reviewed_at": _now()}]},
    ).status_code == 200
    # 재화 · 퀘스트
    assert client.post("/v1/progress/quests/pet_cat/complete").status_code == 200
    # 묶음 담기
    assert client.post(
        "/v1/pack-imports",
        json={
            "id": "i1",
            "pack_id": "pack",
            "word_book_id": "b1",
            "words": [{"id": "w2", "word_book_id": "b1", "term": "犬", "meaning": "개", **stamp}],
        },
    ).status_code == 201


def _counts(user: str) -> dict[str, int]:
    with SessionLocal() as session:
        return {
            model.__tablename__: session.scalar(
                select(func.count()).select_from(model).where(model.user_id == user)
            )
            or 0
            for model in USER_TABLES
        }


@pytest.fixture
def firebase_deleted(monkeypatch: pytest.MonkeyPatch) -> list[str]:
    """Firebase를 실제로 부르지 않는다. 지운 uid만 적어둔다."""
    deleted: list[str] = []
    monkeypatch.setattr(auth, "delete_user", lambda uid: deleted.append(uid))
    return deleted


def test_withdrawal_removes_every_row_of_mine(firebase_deleted: list[str]) -> None:
    user = _user()
    client = _client(user)
    _fill(client)
    # 채운 게 정말 전부 들어갔는지부터 — 비어 있으면 아래 검사가 의미 없다.
    assert all(count > 0 for count in _counts(user).values()), _counts(user)

    response = client.delete("/v1/account")

    assert response.status_code == 204
    assert _counts(user) == {model.__tablename__: 0 for model in USER_TABLES}
    assert firebase_deleted == [user]


def test_other_users_are_untouched(firebase_deleted: list[str]) -> None:
    me, other = _user(), _user()
    _fill(_client(other))
    before = _counts(other)

    _fill(_client(me))
    assert _client(me).delete("/v1/account").status_code == 204

    assert _counts(other) == before
    assert firebase_deleted == [me]


def test_data_is_gone_before_firebase_is_called(monkeypatch: pytest.MonkeyPatch) -> None:
    """계정을 지우는 순간에는 데이터가 이미 커밋돼 사라져 있어야 한다."""
    user = _user()
    client = _client(user)
    _fill(client)
    seen: dict[str, int] = {}

    def check_then_delete(uid: str) -> None:
        seen.update(_counts(uid))

    monkeypatch.setattr(auth, "delete_user", check_then_delete)

    assert client.delete("/v1/account").status_code == 204
    assert seen and all(count == 0 for count in seen.values())


def test_retry_finishes_after_firebase_failed(monkeypatch: pytest.MonkeyPatch) -> None:
    user = _user()
    _fill(_client(user))

    def fail(uid: str) -> None:
        raise RuntimeError("Firebase 일시 장애")

    monkeypatch.setattr(auth, "delete_user", fail)
    first = _client(user, raise_server_exceptions=False).delete("/v1/account")

    assert first.status_code == 500
    # 데이터는 이미 지워졌다.
    assert all(count == 0 for count in _counts(user).values())

    deleted: list[str] = []
    monkeypatch.setattr(auth, "delete_user", lambda uid: deleted.append(uid))
    again = _client(user).delete("/v1/account")

    assert again.status_code == 204
    assert deleted == [user]


def test_missing_firebase_user_is_not_an_error(monkeypatch: pytest.MonkeyPatch) -> None:
    def already_gone(uid: str) -> None:
        raise auth.UserNotFoundError("없는 사용자")

    monkeypatch.setattr(auth, "delete_user", already_gone)

    assert _client(_user()).delete("/v1/account").status_code == 204


def test_withdrawal_needs_login() -> None:
    Base.metadata.create_all(bind=engine)
    app.dependency_overrides.pop(get_current_user_id, None)

    assert TestClient(app).delete("/v1/account").status_code == 401
