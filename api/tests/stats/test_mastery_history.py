"""날짜별 암기 추이 — 채점 기록을 다시 돌려 그날 끝의 OK / 전체 카드 수를 센다.

여기서 지키는 것
- 그날 아직 없던 카드는 분모에도 없다
- 외움 두 번(10분 단계 통과)이면 그날부터 OK
- 복습일을 자기 간격만큼 넘기면 X로 내려간다(암기율과 같은 기준)
- 오늘은 지금 카드 상태 — 암기율 막대와 같은 값
"""

import uuid
from datetime import datetime, time, timedelta, timezone

from fastapi.testclient import TestClient
from sqlalchemy import update

from app.core.auth import get_current_user_id
from app.core.database import Base, SessionLocal, engine
from app.main import app
from app.models import CardModel, ReviewLogModel

BOOK = "history-book"


def _client() -> tuple[TestClient, str]:
    Base.metadata.create_all(bind=engine)
    user = f"history-{uuid.uuid4().hex[:8]}"
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


def _word(client: TestClient, word_id: str) -> None:
    now = datetime.now(timezone.utc).isoformat()
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


def _noon(days_ago: int) -> datetime:
    """며칠 전 정오(UTC). 자정 경계를 피한다."""
    day = datetime.now(timezone.utc).date() - timedelta(days=days_ago)
    return datetime.combine(day, time(12), tzinfo=timezone.utc)


def _backdate(user: str, word_id: str, created: datetime) -> None:
    with SessionLocal() as session:
        session.execute(
            update(CardModel)
            .where(CardModel.user_id == user, CardModel.word_id == word_id)
            .values(created_at=created, srs_due_at=created)
        )
        session.commit()


def _log(user: str, word_id: str, grade: str, at: datetime) -> None:
    with SessionLocal() as session:
        session.add(
            ReviewLogModel(
                id=uuid.uuid4().hex,
                user_id=user,
                word_id=word_id,
                card_id=f"{word_id}:recognition",
                grade=grade,
                reviewed_at=at,
                created_at=at,
            )
        )
        session.commit()


def _set_now_state(user: str, word_id: str, interval: int, due: datetime) -> None:
    with SessionLocal() as session:
        session.execute(
            update(CardModel)
            .where(CardModel.user_id == user, CardModel.word_id == word_id)
            .values(srs_interval_days=interval, srs_due_at=due)
        )
        session.commit()


def _points(client: TestClient, days: int) -> list[tuple[int, int]]:
    rows = client.get(
        "/v1/stats/mastery-history", params={"days": days, "tz_offset": 0}
    ).json()
    row = next(row for row in rows if row["word_book_id"] == BOOK)
    return [(p["ok"], p["cards"]) for p in row["points"]]


def test_card_counts_only_from_the_day_it_was_added() -> None:
    client, user = _client()
    _word(client, "old")
    _word(client, "new")
    _backdate(user, "old", _noon(2))

    # 2일 전 · 어제 · 오늘. "new"는 오늘 생겼다.
    assert _points(client, 3) == [(0, 1), (0, 1), (0, 2)]


def test_learning_then_forgetting_shows_up_by_date() -> None:
    client, user = _client()
    _word(client, "w1")
    _backdate(user, "w1", _noon(9))
    # 9일 전: 외움 두 번(0분 · 10분 단계) → 졸업, 1일 간격.
    _log(user, "w1", "good", _noon(9))
    _log(user, "w1", "good", _noon(9) + timedelta(minutes=10))
    # 그 뒤로 복습을 안 했다. 복습일(8일 전)에서 1일이 더 지난 7일 전 정오부터 X.
    _set_now_state(user, "w1", 1, _noon(8))

    points = _points(client, 10)
    #        9일 전   8일 전  7일 전부터 · · · 오늘
    assert points == [(1, 1), (1, 1)] + [(0, 1)] * 8


def test_today_matches_current_mastery_rate() -> None:
    client, user = _client()
    _word(client, "w1")
    _word(client, "w2")
    # 기록 없이 동기화된 카드처럼 지금 상태만 OK로 둔다.
    _set_now_state(
        user, "w1", 3, datetime.now(timezone.utc) + timedelta(days=3)
    )

    assert _points(client, 1) == [(1, 2)]
    rows = client.get("/v1/word-books/summaries").json()
    assert next(r for r in rows if r["word_book_id"] == BOOK)["mastery_rate"] == 50
