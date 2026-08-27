from fastapi.testclient import TestClient

from app.core.auth import get_current_user_id
from app.core.database import Base, engine
from app.main import app


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
