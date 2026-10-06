"""단어장 암기율 — OK ÷ 전체 카드 × 100.

카드는 OK 아니면 X다.
- OK: 학습 단계를 통과해 다음 복습이 1일 이상 뒤로 잡힌 카드 (srs_interval_days ≥ 1)
- X: 새 카드, 학습 단계 중인 카드, 틀려서 다시 배우는 카드

여기서 지키는 것
- 새 카드만 있으면 0%
- 절반을 외우면 50%, 셋 중 하나면 33% (반올림)
- 외운 카드를 틀리면 X로 내려간다
- **복습일이 지나도 OK다** — 아무것도 안 했는데 아침마다 떨어지지 않게
"""

import uuid
from datetime import datetime, timedelta, timezone

from fastapi.testclient import TestClient
from sqlalchemy import update

from app.core.auth import get_current_user_id
from app.core.database import Base, SessionLocal, engine
from app.main import app
from app.models import CardModel

BOOK = "mastery-book"


def _client() -> tuple[TestClient, str]:
    Base.metadata.create_all(bind=engine)
    user = f"mastery-{uuid.uuid4().hex[:8]}"
    app.dependency_overrides[get_current_user_id] = lambda: user
    client = TestClient(app)
    now = datetime.now(timezone.utc).isoformat()
    assert (
        client.put(
            f"/v1/word-books/{BOOK}",
            json={"id": BOOK, "title": BOOK, "created_at": now, "updated_at": now},
        ).status_code
        == 200
    )
    return client, user


def _words(client: TestClient, *word_ids: str) -> None:
    now = datetime.now(timezone.utc).isoformat()
    for word_id in word_ids:
        assert (
            client.put(
                f"/v1/word-books/{BOOK}/words/{word_id}",
                json={
                    "id": word_id,
                    "word_book_id": BOOK,
                    "term": word_id,
                    "meaning": "뜻",
                    "created_at": now,
                    "updated_at": now,
                },
            ).status_code
            == 200
        )


def _set_card(user: str, word_id: str, interval_days: int, due_in: timedelta) -> None:
    """카드의 SRS 상태를 직접 맞춘다. 며칠을 기다릴 수 없어서다."""
    with SessionLocal() as session:
        session.execute(
            update(CardModel)
            .where(CardModel.user_id == user, CardModel.word_id == word_id)
            .values(
                srs_interval_days=interval_days,
                srs_repetitions=1 if interval_days >= 1 else 0,
                srs_last_reviewed_at=datetime.now(timezone.utc),
                srs_due_at=datetime.now(timezone.utc) + due_in,
            )
        )
        session.commit()


def _rate(client: TestClient) -> int:
    rows = client.get("/v1/word-books/summaries").json()
    return next(row for row in rows if row["word_book_id"] == BOOK)["mastery_rate"]


def test_new_cards_only_is_zero() -> None:
    client, _ = _client()
    _words(client, "w1", "w2")

    assert _rate(client) == 0


def test_half_learned_is_fifty() -> None:
    client, user = _client()
    _words(client, "w1", "w2")
    _set_card(user, "w1", interval_days=1, due_in=timedelta(days=1))

    assert _rate(client) == 50


def test_one_of_three_rounds_to_33() -> None:
    client, user = _client()
    _words(client, "w1", "w2", "w3")
    _set_card(user, "w1", interval_days=3, due_in=timedelta(days=3))

    assert _rate(client) == 33


def test_learning_step_card_is_not_learned_yet() -> None:
    """10분 뒤 다시 나올 카드는 아직 외운 게 아니다."""
    client, user = _client()
    _words(client, "w1")
    _set_card(user, "w1", interval_days=0, due_in=timedelta(minutes=10))

    assert _rate(client) == 0


def test_failing_a_learned_card_drops_it_to_x() -> None:
    client, user = _client()
    _words(client, "w1")
    # 복습일이 된 외운 카드를 틀린다.
    _set_card(user, "w1", interval_days=3, due_in=timedelta(seconds=-1))
    assert _rate(client) == 100

    response = client.post(
        "/v1/review/grades",
        json={
            "grades": [
                {
                    "id": "fail-1",
                    "word_id": "w1",
                    "card_id": "w1:recognition",
                    "grade": "again",
                    "reviewed_at": datetime.now(timezone.utc).isoformat(),
                }
            ]
        },
    )

    assert response.json()["applied"] == 1
    assert _rate(client) == 0


def test_overdue_learned_card_stays_ok() -> None:
    """복습일이 지나도 틀리기 전까지는 외운 카드다."""
    client, user = _client()
    _words(client, "w1", "w2")
    _set_card(user, "w1", interval_days=3, due_in=-timedelta(days=2))
    _set_card(user, "w2", interval_days=8, due_in=-timedelta(hours=1))

    assert _rate(client) == 100
    # 오늘 할 일로는 잡힌다 — 암기율과 별개로 센다.
    assert client.get("/v1/review/due/count").json()["by_book"][BOOK] == 2
