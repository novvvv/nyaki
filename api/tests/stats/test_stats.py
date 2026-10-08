"""통계 — 날짜별 추가 개수, 암기 단계 분포, 날짜별 복습 수.

전체 통계 화면의 추이 차트가 쓰는 값이다. 한때 웹이 스토어의 단어만 세어
빈칸 노트가 통째로 빠졌다. 같은 화면 안에서 위 타일은 "항목", 가운데 차트는
"단어" 기준이 되는 상태였다.

여기서 지키는 것
- 단어와 빈칸 노트를 함께 센다
- 삭제한 항목은 빼고 센다
- 로컬 날짜로 묶는다 (저장은 UTC)
- days 밖은 빼고, days가 없으면 전부 센다
- 남의 데이터는 안 섞인다
"""

from datetime import datetime, timedelta, timezone

from fastapi.testclient import TestClient

from app.core.auth import get_current_user_id
from app.core.database import Base, engine
from app.main import app

BOOK = "stats-book"
KST = 540  # UTC+9, 분 단위


def _client(user: str) -> TestClient:
    Base.metadata.create_all(bind=engine)
    app.dependency_overrides[get_current_user_id] = lambda: user
    client = TestClient(app)

    now = datetime.now(timezone.utc).isoformat()
    assert (
        client.put(
            f"/v1/word-books/{BOOK}",
            json={
                "id": BOOK,
                "title": "통계",
                "created_at": now,
                "updated_at": now,
                "is_deleted": False,
            },
        ).status_code
        == 200
    )
    return client


def _add_word(client: TestClient, word_id: str, created: datetime) -> None:
    iso = created.isoformat()
    assert (
        client.put(
            f"/v1/word-books/{BOOK}/words/{word_id}",
            json={
                "id": word_id,
                "word_book_id": BOOK,
                "term": word_id,
                "meaning": "뜻",
                "created_at": iso,
                "updated_at": iso,
                "is_deleted": False,
            },
        ).status_code
        == 200
    )


def _add_note(client: TestClient, note_id: str, created: datetime) -> None:
    iso = created.isoformat()
    assert (
        client.put(
            f"/v1/word-books/{BOOK}/cloze-notes/{note_id}",
            json={
                "id": note_id,
                "word_book_id": BOOK,
                "text": "{{c1::답}}",
                "created_at": iso,
                "updated_at": iso,
                "is_deleted": False,
            },
        ).status_code
        == 200
    )


def _daily(client: TestClient, **params) -> dict[str, int]:
    query = "&".join(f"{key}={value}" for key, value in params.items())
    rows = client.get(f"/v1/stats/daily-added?{query}").json()
    return {row["date"]: row["count"] for row in rows}


def test_counts_words_and_cloze_notes_together() -> None:
    """사용자에게는 단어도 빈칸 노트도 "외울 거리 하나"다."""
    client = _client("firebase-user-stats-both")
    now = datetime.now(timezone.utc)

    _add_word(client, "w1", now)
    _add_word(client, "w2", now)
    _add_note(client, "n1", now)

    today = (now + timedelta(minutes=KST)).date().isoformat()
    assert _daily(client, tz_offset=KST) == {today: 3}

    app.dependency_overrides.clear()


def test_deleted_items_are_not_counted() -> None:
    client = _client("firebase-user-stats-deleted")
    now = datetime.now(timezone.utc)

    _add_word(client, "w1", now)
    _add_word(client, "w2", now)
    _add_note(client, "n1", now)

    assert client.delete(f"/v1/word-books/{BOOK}/words/w2").status_code == 204
    assert (
        client.delete(f"/v1/word-books/{BOOK}/cloze-notes/n1").status_code == 204
    )

    today = (now + timedelta(minutes=KST)).date().isoformat()
    assert _daily(client, tz_offset=KST) == {today: 1}

    app.dependency_overrides.clear()


def test_local_date_decides_the_bucket() -> None:
    """UTC 23시 30분은 KST로는 다음 날 아침이다.

    시차를 안 더하면 자정 무렵 추가한 항목이 하루씩 어긋난다.
    """
    client = _client("firebase-user-stats-tz")
    late = datetime.now(timezone.utc).replace(
        hour=23, minute=30, second=0, microsecond=0
    ) - timedelta(days=2)

    _add_word(client, "w1", late)

    utc_day = late.date().isoformat()
    kst_day = (late + timedelta(minutes=KST)).date().isoformat()
    assert utc_day != kst_day

    assert _daily(client, tz_offset=0) == {utc_day: 1}
    assert _daily(client, tz_offset=KST) == {kst_day: 1}

    app.dependency_overrides.clear()


def test_days_window_cuts_off_older_items() -> None:
    client = _client("firebase-user-stats-window")
    now = datetime.now(timezone.utc)

    _add_word(client, "recent", now - timedelta(days=1))
    _add_word(client, "old", now - timedelta(days=40))

    # days=7이면 오늘 포함 7일. 40일 전 항목은 빠진다.
    assert len(_daily(client, days=7, tz_offset=KST)) == 1
    # 창을 안 주면 전부 센다.
    assert len(_daily(client, tz_offset=KST)) == 2

    app.dependency_overrides.clear()


def test_empty_days_are_not_sent() -> None:
    """0인 날을 메우는 일은 "오늘"이 며칠인지 아는 클라이언트 몫이다."""
    client = _client("firebase-user-stats-sparse")
    now = datetime.now(timezone.utc)

    _add_word(client, "w1", now)
    _add_word(client, "w2", now - timedelta(days=3))

    rows = _daily(client, days=30, tz_offset=KST)
    assert len(rows) == 2  # 사이의 이틀은 아예 오지 않는다

    app.dependency_overrides.clear()


def test_rows_come_back_in_date_order() -> None:
    client = _client("firebase-user-stats-order")
    now = datetime.now(timezone.utc)

    _add_word(client, "b", now - timedelta(days=1))
    _add_word(client, "a", now - timedelta(days=5))

    dates = list(_daily(client, tz_offset=KST))
    assert dates == sorted(dates)

    app.dependency_overrides.clear()


def test_other_users_items_are_not_counted() -> None:
    client = _client("firebase-user-stats-mine")
    now = datetime.now(timezone.utc)
    _add_word(client, "mine", now)

    other = _client("firebase-user-stats-theirs")
    _add_word(other, "theirs", now)

    today = (now + timedelta(minutes=KST)).date().isoformat()
    assert _daily(other, tz_offset=KST) == {today: 1}

    app.dependency_overrides.clear()


# ==================== 암기 단계 분포 ====================
#
# 단어장 집계의 stages — 새 카드 · 학습 중 · 1일 · 3일 · 1주 · 1달+.
# 다음 복습 간격으로 나눈다. 통계 화면의 분포 곡선이 쓴다.


def _set_card(
    user: str, word_id: str, interval_days: int, reviewed: bool = True
) -> None:
    from sqlalchemy import update

    from app.core.database import SessionLocal
    from app.models import CardModel

    with SessionLocal() as session:
        session.execute(
            update(CardModel)
            .where(CardModel.user_id == user, CardModel.word_id == word_id)
            .values(
                srs_interval_days=interval_days,
                srs_last_reviewed_at=datetime.now(timezone.utc) if reviewed else None,
            )
        )
        session.commit()


def _stages(client: TestClient) -> list[int]:
    rows = client.get("/v1/word-books/summaries").json()
    return next(row for row in rows if row["word_book_id"] == BOOK)["stages"]


def test_cards_are_split_into_stages_by_interval() -> None:
    user = "firebase-user-stats-stages"
    client = _client(user)
    now = datetime.now(timezone.utc)
    for word_id in ["new", "learning", "d1", "d2", "d5", "d10", "d45"]:
        _add_word(client, word_id, now)

    _set_card(user, "learning", 0)  # 봤지만 아직 학습 단계
    _set_card(user, "d1", 1)
    _set_card(user, "d2", 2)  # 3일 미만은 1일 칸
    _set_card(user, "d5", 5)
    _set_card(user, "d10", 10)
    _set_card(user, "d45", 45)

    #               새 카드 · 학습 중 · 1일 · 3일 · 1주 · 1달+
    assert _stages(client) == [1, 1, 2, 1, 1, 1]


# ==================== 날짜별 복습 수 ====================


def _log(user: str, log_id: str, card_id: str, at: datetime) -> None:
    """채점 기록을 직접 남긴다. API는 서버 시각을 써서 날짜를 고를 수 없다."""
    from app.core.database import SessionLocal
    from app.models import ReviewLogModel

    with SessionLocal() as session:
        session.add(
            ReviewLogModel(
                id=log_id,
                user_id=user,
                word_id=card_id.split(":")[0],
                card_id=card_id,
                grade="good",
                reviewed_at=at,
                created_at=at,
            )
        )
        session.commit()


def _reviewed(client: TestClient, days: int = 30) -> dict[str, int]:
    response = client.get(f"/v1/stats/daily-reviewed?days={days}&tz_offset={KST}")
    assert response.status_code == 200, response.text
    return {row["date"]: row["count"] for row in response.json()}


def test_same_card_twice_a_day_counts_once() -> None:
    """학습 단계에서 1분 · 10분 뒤 다시 봐도 그날 1개다."""
    user = "firebase-user-stats-reviewed-once"
    client = _client(user)
    now = datetime.now(timezone.utc)
    _log(user, "r1", "w1:recognition", now)
    _log(user, "r2", "w1:recognition", now - timedelta(minutes=1))
    _log(user, "r3", "w2:recognition", now)

    today = (now + timedelta(minutes=KST)).date().isoformat()
    assert _reviewed(client) == {today: 2}


def test_reviews_are_grouped_by_local_date() -> None:
    """UTC 15시 = KST 다음 날 0시. 저장 날짜가 아니라 한국 날짜로 묶는다."""
    user = "firebase-user-stats-reviewed-kst"
    client = _client(user)
    today_utc = datetime.now(timezone.utc).date()
    # 이틀 전 UTC 14:59 → KST 23:59(이틀 전), UTC 15:00 → KST 0:00(어제)
    base = datetime.combine(
        today_utc - timedelta(days=2), datetime.min.time(), tzinfo=timezone.utc
    )
    _log(user, "k1", "w1:recognition", base + timedelta(hours=14, minutes=59))
    _log(user, "k2", "w2:recognition", base + timedelta(hours=15))

    two_days_ago = (today_utc - timedelta(days=2)).isoformat()
    yesterday = (today_utc - timedelta(days=1)).isoformat()
    assert _reviewed(client) == {two_days_ago: 1, yesterday: 1}


def test_reviews_outside_the_window_are_cut() -> None:
    user = "firebase-user-stats-reviewed-window"
    client = _client(user)
    now = datetime.now(timezone.utc)
    _log(user, "o1", "w1:recognition", now - timedelta(days=40))
    _log(user, "o2", "w2:recognition", now)

    assert list(_reviewed(client, days=30).values()) == [1]


def test_reviews_of_other_users_are_not_counted() -> None:
    _log(
        "firebase-user-stats-reviewed-other",
        "x1",
        "w1:recognition",
        datetime.now(timezone.utc),
    )
    client = _client("firebase-user-stats-reviewed-me")

    assert _reviewed(client) == {}
