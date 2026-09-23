"""복습 흐름 설정이 실제 채점에 반영되는지 — 순수 계산은 test_srs_steps.py가 본다.

여기서 보는 것은 "설정 → 저장 → 채점 → 다음 복습 시각" 한 바퀴다.
"""

from datetime import datetime, timedelta, timezone

from fastapi.testclient import TestClient

from app.core.auth import get_current_user_id
from app.core.database import Base, engine
from app.main import app

BOOK = "steps-book"


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
                "title": "단계",
                "created_at": now,
                "updated_at": now,
                "is_deleted": False,
            },
        ).status_code
        == 200
    )
    return client


def _add_word(client: TestClient, word_id: str) -> None:
    created = (datetime.now(timezone.utc) - timedelta(hours=1)).isoformat()
    assert (
        client.put(
            f"/v1/word-books/{BOOK}/words/{word_id}",
            json={
                "id": word_id,
                "word_book_id": BOOK,
                "term": word_id,
                "meaning": "뜻",
                "created_at": created,
                "updated_at": created,
                "is_deleted": False,
            },
        ).status_code
        == 200
    )


def _grade(client: TestClient, word_id: str, value: str, log_id: str) -> None:
    body = client.post(
        "/v1/review/grades",
        json={
            "grades": [
                {
                    "id": log_id,
                    "word_id": word_id,
                    "grade": value,
                    "reviewed_at": datetime.now(timezone.utc).isoformat(),
                }
            ]
        },
    ).json()
    assert body["applied"] == 1, body


def _word(client: TestClient, word_id: str) -> dict:
    words = client.get(f"/v1/word-books/{BOOK}/words").json()
    return next(w for w in words if w["id"] == word_id)


def test_settings_round_trip() -> None:
    client = _client("firebase-user-steps-settings")

    body = client.put(
        "/v1/progress/settings",
        json={
            "learning_steps": "1, 10",
            "relearning_steps": "10",
            "graduating_interval_days": 2,
        },
    ).json()

    # 문자열로 저장하지만 숫자 배열로 내려준다.
    assert body["learning_steps"] == [1, 10]
    assert body["relearning_steps"] == [10]
    assert body["graduating_interval_days"] == 2

    # 다시 읽어도 같다.
    assert client.get("/v1/progress").json()["learning_steps"] == [1, 10]

    app.dependency_overrides.clear()


def test_default_is_anki_like() -> None:
    """설정을 건드린 적 없으면 안키 기본값(1m 10m / 10m)이 적용된다."""
    client = _client("firebase-user-steps-default")

    body = client.get("/v1/progress").json()
    assert body["learning_steps"] == [1, 10]
    assert body["relearning_steps"] == [10]

    _add_word(client, "default-word")
    _grade(client, "default-word", "good", "log-default-1")

    word = _word(client, "default-word")
    assert word["srs_learning_step"] == 1  # 10분 단계
    assert word["srs_interval_days"] == 0  # 아직 졸업 전

    app.dependency_overrides.clear()


def test_empty_string_turns_steps_off() -> None:
    """일부러 비우면 단계를 끈다 — null(설정한 적 없음)과 구분한다."""
    client = _client("firebase-user-steps-off")

    body = client.put(
        "/v1/progress/settings",
        json={"learning_steps": "", "relearning_steps": ""},
    ).json()
    assert body["learning_steps"] == []
    assert body["relearning_steps"] == []

    _add_word(client, "off-word")
    _grade(client, "off-word", "good", "log-off-1")

    word = _word(client, "off-word")
    assert word["srs_interval_days"] == 1  # 바로 일 단위
    assert word["srs_learning_step"] is None

    app.dependency_overrides.clear()


def test_new_card_enters_learning_steps() -> None:
    client = _client("firebase-user-steps-new")
    client.put("/v1/progress/settings", json={"learning_steps": "1,10"})
    _add_word(client, "step-word")

    _grade(client, "step-word", "good", "log-step-1")

    word = _word(client, "step-word")
    assert word["srs_learning_step"] == 1  # 1분 → 10분 단계로
    assert word["srs_interval_days"] == 0  # 아직 졸업 전

    # 10분 뒤가 다음 복습 시각이다 — 일 단위가 아니다.
    due = datetime.fromisoformat(word["srs_due_at"])
    delta = due - datetime.now(timezone.utc).replace(tzinfo=due.tzinfo)
    assert timedelta(minutes=9) < delta < timedelta(minutes=11)

    app.dependency_overrides.clear()


def test_graduates_after_last_step() -> None:
    client = _client("firebase-user-steps-graduate")
    client.put(
        "/v1/progress/settings",
        json={"learning_steps": "1,10", "graduating_interval_days": 1},
    )
    _add_word(client, "grad-word")

    _grade(client, "grad-word", "good", "log-grad-1")  # → 10분 단계
    _grade(client, "grad-word", "good", "log-grad-2")  # → 졸업

    word = _word(client, "grad-word")
    assert word["srs_learning_step"] is None
    assert word["srs_interval_days"] == 1
    assert word["srs_repetitions"] == 1

    app.dependency_overrides.clear()


def test_a_session_worth_of_grades_applies_in_order() -> None:
    """웹은 세션이 끝날 때 채점을 모아 보낸다. 순서대로 적용돼야 한다.

    한 단어를 모름 → 외움 → 외움으로 채점한 기록을 한 요청에 담아 보낸다.
    """
    client = _client("firebase-user-steps-batch")
    client.put("/v1/progress/settings", json={"learning_steps": "1,10"})
    _add_word(client, "batch-word")

    now = datetime.now(timezone.utc)
    grades = [
        {
            "id": f"log-batch-{i}",
            "word_id": "batch-word",
            "grade": value,
            "reviewed_at": (now + timedelta(seconds=i)).isoformat(),
        }
        for i, value in enumerate(["again", "good", "good"])
    ]
    assert client.post("/v1/review/grades", json={"grades": grades}).json()["applied"] == 3

    # again(1분) → good(10분) → good(졸업)
    word = _word(client, "batch-word")
    assert word["srs_learning_step"] is None
    assert word["srs_interval_days"] == 1

    app.dependency_overrides.clear()


def test_review_card_failure_uses_relearning_steps() -> None:
    client = _client("firebase-user-steps-relearn")
    client.put(
        "/v1/progress/settings",
        json={"learning_steps": "1,10", "relearning_steps": "20"},
    )
    _add_word(client, "relearn-word")

    _grade(client, "relearn-word", "good", "log-rl-1")  # 10분 단계
    _grade(client, "relearn-word", "good", "log-rl-2")  # 졸업 (복습 카드)
    _grade(client, "relearn-word", "again", "log-rl-3")  # 실패 → 재학습

    word = _word(client, "relearn-word")
    assert word["srs_learning_step"] == 0
    assert word["srs_lapses"] == 1  # 복습 카드의 실패만 센다

    due = datetime.fromisoformat(word["srs_due_at"])
    delta = due - datetime.now(timezone.utc).replace(tzinfo=due.tzinfo)
    assert timedelta(minutes=19) < delta < timedelta(minutes=21)

    app.dependency_overrides.clear()


def test_due_response_carries_button_previews() -> None:
    """버튼에 띄울 다음 간격을 서버가 계산해 내려준다 — 웹은 SM-2를 모른다."""
    client = _client("firebase-user-steps-preview")
    client.put(
        "/v1/progress/settings",
        json={"learning_steps": "1,10", "relearning_steps": "10"},
    )
    _add_word(client, "preview-word")

    body = client.get("/v1/review/due?limit=10").json()
    preview = body["previews"]["preview-word"]

    # 새 카드: 모름 → 1분, 외움 → 10분
    assert preview["again_seconds"] == 60
    assert preview["good_seconds"] == 600

    app.dependency_overrides.clear()


def test_previews_follow_the_steps_setting() -> None:
    client = _client("firebase-user-steps-preview-off")
    client.put(
        "/v1/progress/settings",
        json={"learning_steps": "", "relearning_steps": ""},
    )
    _add_word(client, "preview-off-word")

    preview = client.get("/v1/review/due?limit=10").json()["previews"][
        "preview-off-word"
    ]

    # 단계를 끄면 모름 = 즉시, 외움 = 1일
    assert preview["again_seconds"] == 0
    assert preview["good_seconds"] == 86400

    app.dependency_overrides.clear()
