from datetime import date, datetime, timezone
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient

from app.core.auth import get_current_user_id
from app.core.database import Base, engine
from app.gamification.services import CAPELIN, QUEST_REWARDS, _today
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
