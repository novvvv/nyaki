from datetime import date, datetime, timedelta, timezone
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient

from app.core.auth import get_current_user_id
from app.core.database import Base, engine
from app.gamification.services import (
    CAPELIN,
    QUEST_REWARDS,
    _assert_in_time_window,
    _today,
)
from app.main import app


def test_today_resets_at_kst_midnight_not_utc_midnight() -> None:
    # 2026-08-27 23:00 UTC == 2026-08-28 08:00 KST — UTC 기준이면 아직
    # 8/27이지만, KST 기준이면 이미 8/28로 날짜가 넘어가 있어야 한다.
    fixed_utc = datetime(2026, 8, 27, 23, 0, tzinfo=timezone.utc)
    with patch("app.gamification.services.datetime") as mock_datetime:
        mock_datetime.now.side_effect = lambda tz=None: fixed_utc.astimezone(tz)
        assert _today() == date(2026, 8, 28)


def test_complete_quest_add_word_is_idempotent_per_day() -> None:
    Base.metadata.create_all(bind=engine)
    app.dependency_overrides[get_current_user_id] = lambda: "firebase-user-add-word"
    client = TestClient(app)

    # 1번째 호출(오늘 첫 단어) — 츄르 +5 지급, completed_today에 add_word 포함
    first = client.post("/v1/progress/quests/add_word/complete")
    assert first.status_code == 200
    first_body = first.json()
    assert first_body["churu_balance"] == 5
    assert "add_word" in first_body["completed_today"]

    # 2번째 호출(같은 날 단어 하나 더 추가) — idempotent라 잔액 안 늘어남
    second = client.post("/v1/progress/quests/add_word/complete")
    assert second.status_code == 200
    second_body = second.json()
    assert second_body["churu_balance"] == 5
    assert second_body["completed_today"] == first_body["completed_today"]

    # GET /v1/progress도 같은 상태를 반영
    progress = client.get("/v1/progress")
    assert progress.status_code == 200
    assert progress.json()["churu_balance"] == 5


def test_complete_quest_add_word_does_not_affect_other_users() -> None:
    Base.metadata.create_all(bind=engine)
    app.dependency_overrides[get_current_user_id] = lambda: "firebase-user-a"
    client = TestClient(app)
    assert client.post("/v1/progress/quests/add_word/complete").status_code == 200

    app.dependency_overrides[get_current_user_id] = lambda: "firebase-user-b"
    other_client = TestClient(app)
    other_progress = other_client.get("/v1/progress")
    assert other_progress.status_code == 200
    assert other_progress.json()["churu_balance"] == 0


def test_capelin_quest_grants_capelin_not_churu() -> None:
    """재화 분기 검증 — 열빙어 보상은 츄르 잔액을 건드리지 않아야 한다.

    아침/저녁 복습 퀘스트는 서버가 복습 횟수를 확인한 뒤에만 지급해야 해서
    QUEST_REWARDS에 넣지 않았다(넣으면 복습 없이 API 호출만으로 받아간다).
    그래서 임시 퀘스트를 끼워 넣어 지급 분기 자체를 검증한다.
    """
    Base.metadata.create_all(bind=engine)
    app.dependency_overrides[get_current_user_id] = lambda: "firebase-user-capelin"
    client = TestClient(app)

    with patch.dict(QUEST_REWARDS, {"_test_capelin": (CAPELIN, 1)}):
        first = client.post("/v1/progress/quests/_test_capelin/complete")
        assert first.status_code == 200
        assert first.json()["capelin_balance"] == 1
        assert first.json()["churu_balance"] == 0

        # 같은 날 두 번째 — idempotent라 열빙어도 안 늘어난다
        second = client.post("/v1/progress/quests/_test_capelin/complete")
        assert second.json()["capelin_balance"] == 1

    # 츄르 퀘스트와 잔액이 서로 섞이지 않는다
    assert client.post("/v1/progress/quests/pet_cat/complete").status_code == 200
    progress = client.get("/v1/progress").json()
    assert progress["capelin_balance"] == 1
    assert progress["churu_balance"] == 5


def test_progress_includes_capelin_for_new_user() -> None:
    """잔액 row가 없는 신규 유저도 capelin_balance 0을 받아야 한다."""
    Base.metadata.create_all(bind=engine)
    app.dependency_overrides[get_current_user_id] = lambda: "firebase-user-fresh"
    client = TestClient(app)

    body = client.get("/v1/progress").json()
    assert body["capelin_balance"] == 0
    assert body["churu_balance"] == 0


def test_unknown_currency_raises() -> None:
    """모르는 재화는 조용히 넘어가지 않고 터져야 한다."""
    from app.gamification.services import _grant
    from app.models import UserProgressModel

    progress = UserProgressModel(user_id="x")
    with pytest.raises(ValueError):
        _grant(progress, "gold", 10)


# ==================== 시간대 퀘스트 (아침/저녁 복습) ==================== #
# 복습을 몇 개 했는지는 앱이 로컬에서 세고 판정한다 — 서버는 검증할 방법이 없다.
# 서버가 확인할 수 있는 유일한 조건이 "지금이 그 시간대인가"라서 여기를 테스트한다.

_KST_TZ = timezone(timedelta(hours=9))


def _kst(hour: int, minute: int = 0) -> datetime:
    """2026-09-11 KST의 특정 시각."""
    return datetime(2026, 9, 11, hour, minute, tzinfo=_KST_TZ)


def test_time_quest_window_boundaries() -> None:
    """경계 시각 — 시작은 포함, 끝은 미포함(6 <= hour < 14)."""
    cases = [
        ("morning_review", 5, False),   # 창 직전
        ("morning_review", 6, True),    # 시작 정각 — 포함
        ("morning_review", 13, True),   # 창 끝 직전
        ("morning_review", 14, False),  # 끝 정각 — 미포함
        ("evening_review", 17, False),
        ("evening_review", 18, True),
        ("evening_review", 23, True),   # 하루 마지막 시각
    ]
    for quest_id, hour, should_pass in cases:
        with patch("app.gamification.services._now_kst", return_value=_kst(hour)):
            if should_pass:
                _assert_in_time_window(quest_id)  # 예외가 안 나면 통과
            else:
                with pytest.raises(ValueError):
                    _assert_in_time_window(quest_id)


def test_flag_quests_ignore_time_window() -> None:
    """pet_cat·add_word는 시간 제약이 없다 — 새벽 3시에도 통과해야 한다."""
    with patch("app.gamification.services._now_kst", return_value=_kst(3)):
        _assert_in_time_window("pet_cat")
        _assert_in_time_window("add_word")


def test_time_quest_outside_window_returns_400() -> None:
    """창 밖 호출은 400. 새벽에 아침 퀘스트를 받아가는 것을 막는다."""
    Base.metadata.create_all(bind=engine)
    app.dependency_overrides[get_current_user_id] = lambda: "firebase-user-window"
    client = TestClient(app)

    with patch("app.gamification.services._now_kst", return_value=_kst(3)):
        response = client.post("/v1/progress/quests/morning_review/complete")
    assert response.status_code == 400

    # 잔액이 오르지 않았는지 확인 — 거절이 '조용한 성공'이 아니어야 한다
    with patch("app.gamification.services._now_kst", return_value=_kst(3)):
        assert client.get("/v1/progress").json()["capelin_balance"] == 0


def test_time_quest_grants_capelin_once_per_day() -> None:
    """창 안에서는 열빙어 1개. 같은 날 재호출해도 안 늘어난다(멱등)."""
    Base.metadata.create_all(bind=engine)
    app.dependency_overrides[get_current_user_id] = lambda: "firebase-user-timequest"
    client = TestClient(app)

    with patch("app.gamification.services._now_kst", return_value=_kst(9)):
        first = client.post("/v1/progress/quests/morning_review/complete")
        assert first.status_code == 200
        assert first.json()["capelin_balance"] == 1
        assert first.json()["churu_balance"] == 0
        assert "morning_review" in first.json()["completed_today"]

        second = client.post("/v1/progress/quests/morning_review/complete")
        assert second.json()["capelin_balance"] == 1

    # 같은 날 저녁 퀘스트는 별개로 하나 더 — 하루 상한 열빙어 2가 여기서 나온다
    with patch("app.gamification.services._now_kst", return_value=_kst(20)):
        evening = client.post("/v1/progress/quests/evening_review/complete")
        assert evening.json()["capelin_balance"] == 2
