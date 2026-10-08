"""출석 — 하루 한 번 츄르 5개.

여기서 지키는 것
- 처음 출석하면 츄르 +5, 같은 날 다시 하면 0
- **동시에 두 번 눌러도 한 번만 준다** (Postgres에서만 — SQLite는 연결이 하나라 동시가 안 된다)
- "오늘"은 서버 시각(KST)이 정한다. UTC 14:59와 15:00은 다른 날이다
- 자정이 지나면 다시 받을 수 있다
- 연속 출석: 이어지면 늘고, 하루 빠지면 끊기고, 오늘 출석 전이면 어제까지로 센다
- 다음 리셋 시각은 다음 KST 자정
- 진행도(/v1/progress)에 출석 상태가 실린다
- 로그인 없이는 못 한다
"""

import threading
import uuid
from datetime import datetime, timedelta, timezone

import pytest
from fastapi.testclient import TestClient

from app.core.auth import get_current_user_id
from app.core.database import Base, SessionLocal, engine
from app.gamification import services
from app.main import app
from app.models import AttendanceLogModel

KST = timezone(timedelta(hours=9))


def _client(user: str | None = None) -> tuple[TestClient, str]:
    Base.metadata.create_all(bind=engine)
    user = user or f"attend-{uuid.uuid4().hex[:8]}"
    app.dependency_overrides[get_current_user_id] = lambda: user
    return TestClient(app), user


@pytest.fixture
def clock(monkeypatch: pytest.MonkeyPatch) -> dict[str, datetime]:
    """서버의 "지금"(KST)을 정한다."""
    now = {"kst": datetime(2026, 10, 8, 12, 0, tzinfo=KST)}
    monkeypatch.setattr(services, "_now_kst", lambda: now["kst"])
    return now


def _logs(user: str) -> int:
    with SessionLocal() as session:
        return (
            session.query(AttendanceLogModel)
            .filter(AttendanceLogModel.user_id == user)
            .count()
        )


def test_first_check_in_gives_five_churu(clock) -> None:
    client, user = _client()

    body = client.post("/v1/attendance").json()

    assert body["granted"] == 5
    assert body["churu_balance"] == 5
    assert body["date"] == "2026-10-08"
    assert body["streak"] == 1
    assert _logs(user) == 1


def test_second_check_in_same_day_gives_nothing(clock) -> None:
    client, user = _client()
    client.post("/v1/attendance")

    again = client.post("/v1/attendance").json()

    assert again["granted"] == 0
    assert again["churu_balance"] == 5
    assert again["checked_in"] is True
    assert _logs(user) == 1


def test_next_day_can_check_in_again(clock) -> None:
    client, _ = _client()
    client.post("/v1/attendance")

    clock["kst"] += timedelta(days=1)
    body = client.post("/v1/attendance").json()

    assert body["granted"] == 5
    assert body["churu_balance"] == 10
    assert body["streak"] == 2


def test_day_boundary_is_kst_midnight(clock) -> None:
    """UTC 14:59는 KST 23:59(그날), UTC 15:00은 KST 0:00(다음 날)."""
    client, _ = _client()
    clock["kst"] = datetime(2026, 10, 8, 14, 59, tzinfo=timezone.utc).astimezone(KST)
    first = client.post("/v1/attendance").json()

    clock["kst"] = datetime(2026, 10, 8, 15, 0, tzinfo=timezone.utc).astimezone(KST)
    second = client.post("/v1/attendance").json()

    assert first["date"] == "2026-10-08"
    assert second["date"] == "2026-10-09"
    assert second["granted"] == 5


def test_client_cannot_pick_the_date(clock) -> None:
    """본문에 날짜를 넣어 보내도 무시한다 — 날짜는 서버 시각으로만 정한다."""
    client, _ = _client()

    body = client.post("/v1/attendance", json={"date": "2030-01-01"}).json()

    assert body["date"] == "2026-10-08"


def test_streak_breaks_on_a_missed_day(clock) -> None:
    client, _ = _client()
    for _ in range(3):
        client.post("/v1/attendance")
        clock["kst"] += timedelta(days=1)
    # 3일 연속 뒤 하루 건너뛴다.
    clock["kst"] += timedelta(days=1)

    body = client.post("/v1/attendance").json()

    assert body["streak"] == 1


def test_streak_counts_until_yesterday_before_todays_check_in(clock) -> None:
    """자정이 지났다고 어제까지의 연속이 바로 0이 되지 않는다."""
    client, _ = _client()
    for _ in range(4):
        client.post("/v1/attendance")
        clock["kst"] += timedelta(days=1)

    progress = client.get("/v1/progress").json()["attendance"]

    assert progress["checked_in_today"] is False
    assert progress["streak"] == 4


def test_next_reset_is_next_kst_midnight(clock) -> None:
    client, _ = _client()
    clock["kst"] = datetime(2026, 10, 8, 23, 30, tzinfo=KST)

    body = client.post("/v1/attendance").json()

    # KST 10월 9일 0시 = UTC 10월 8일 15시
    assert body["next_reset_at"].startswith("2026-10-08T15:00:00")


def test_progress_carries_attendance(clock) -> None:
    client, _ = _client()
    before = client.get("/v1/progress").json()
    client.post("/v1/attendance")
    after = client.get("/v1/progress").json()

    assert before["attendance"]["checked_in_today"] is False
    assert before["attendance"]["streak"] == 0
    assert after["attendance"]["checked_in_today"] is True
    assert after["churu_balance"] == 5


def test_check_in_and_quest_rewards_add_up(clock) -> None:
    """출석과 다른 퀘스트 보상이 서로를 덮어쓰지 않는다."""
    client, _ = _client()
    client.post("/v1/progress/quests/pet_cat/complete")

    body = client.post("/v1/attendance").json()

    assert body["churu_balance"] == 10


@pytest.mark.skipif(
    engine.dialect.name != "postgresql",
    reason="SQLite 테스트 DB는 연결 하나를 나눠 써서 진짜 동시 요청을 만들 수 없다",
)
def test_concurrent_check_ins_pay_once(clock) -> None:
    """버튼 연타 · 웹과 앱 동시 클릭 — 같은 순간 두 요청이 와도 한 번만 준다."""
    _, user = _client()
    start = threading.Barrier(4)
    results: list[int] = []

    def press() -> None:
        client = TestClient(app)
        start.wait()
        results.append(client.post("/v1/attendance").json()["granted"])

    threads = [threading.Thread(target=press) for _ in range(4)]
    for thread in threads:
        thread.start()
    for thread in threads:
        thread.join()

    assert sorted(results) == [0, 0, 0, 5]
    assert _logs(user) == 1
    progress = TestClient(app).get("/v1/progress").json()
    assert progress["churu_balance"] == 5


def test_check_in_needs_login() -> None:
    Base.metadata.create_all(bind=engine)
    app.dependency_overrides.pop(get_current_user_id, None)

    assert TestClient(app).post("/v1/attendance").status_code == 401
