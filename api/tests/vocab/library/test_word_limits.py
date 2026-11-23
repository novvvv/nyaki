"""단어 칸 길이 한도.

여기서 지키는 것
- 한도까지는 저장된다
- 넘으면 422로 거절한다 — 발음은 서버 검사가 없어서 DB(VARCHAR 500)에서 터져 500이 났다
- 태그는 20개, 각 50자까지
"""

import uuid
from datetime import datetime, timezone

import pytest
from fastapi.testclient import TestClient

from app.core.auth import get_current_user_id
from app.core.database import Base, engine
from app.main import app
from app.vocab.schemas import (
    DESCRIPTION_MAX,
    EXAMPLE_MAX,
    MEANING_MAX,
    PRONUNCIATION_MAX,
    TAG_MAX,
    TAGS_MAX,
    TERM_MAX,
)


@pytest.fixture
def client():
    Base.metadata.create_all(bind=engine)
    user = f"limits-{uuid.uuid4().hex[:8]}"
    app.dependency_overrides[get_current_user_id] = lambda: user
    c = TestClient(app, raise_server_exceptions=False)
    now = datetime.now(timezone.utc).isoformat()
    assert c.put("/v1/word-books/b1", json={"id": "b1", "title": "책", "created_at": now, "updated_at": now}).status_code == 200
    yield c
    app.dependency_overrides.pop(get_current_user_id, None)


def _put(client: TestClient, **fields):
    now = datetime.now(timezone.utc).isoformat()
    body = {
        "id": "w1",
        "word_book_id": "b1",
        "term": "猫",
        "meaning": "고양이",
        "created_at": now,
        "updated_at": now,
        **fields,
    }
    return client.put("/v1/word-books/b1/words/w1", json=body)


LIMITS = [
    ("term", TERM_MAX),
    ("pronunciation", PRONUNCIATION_MAX),
    ("meaning", MEANING_MAX),
    ("example", EXAMPLE_MAX),
    ("example_meaning", EXAMPLE_MAX),
    ("description", DESCRIPTION_MAX),
]


@pytest.mark.parametrize(("field", "limit"), LIMITS)
def test_up_to_limit_is_saved(client: TestClient, field: str, limit: int) -> None:
    assert _put(client, **{field: "あ" * limit}).status_code == 200


@pytest.mark.parametrize(("field", "limit"), LIMITS)
def test_over_limit_is_rejected_cleanly(client: TestClient, field: str, limit: int) -> None:
    assert _put(client, **{field: "あ" * (limit + 1)}).status_code == 422


def test_tags_count_and_length(client: TestClient) -> None:
    assert _put(client, tags=["t"] * TAGS_MAX).status_code == 200
    assert _put(client, tags=["t"] * (TAGS_MAX + 1)).status_code == 422
    assert _put(client, tags=["あ" * TAG_MAX]).status_code == 200
    assert _put(client, tags=["あ" * (TAG_MAX + 1)]).status_code == 422
