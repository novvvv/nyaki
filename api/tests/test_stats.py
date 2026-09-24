"""통계 — 날짜별 추가 개수.

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
