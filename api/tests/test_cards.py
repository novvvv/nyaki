"""카드 — 안키의 Note/Card 구분.

단어는 정보를 담고, 출제되는 것은 카드다. 같은 단어라도 "単語 → 뜻"과
"뜻 → 単語"는 익는 속도가 달라서 SRS 상태가 카드마다 따로 있어야 한다.

여기서 지키는 것
- 단어장이 고른 종류대로 카드가 생기고 사라진다
- 카드마다 복습 일정이 따로 간다
- 같은 단어의 형제 카드가 한 세션에 같이 나오지 않는다
- card_id 없이 보낸 채점(앱)은 recognition 카드로 간다
"""

from datetime import datetime, timedelta, timezone

from fastapi.testclient import TestClient

from app.core.auth import get_current_user_id
from app.core.database import Base, engine
from app.main import app

BOOK = "card-book"


def _client(user: str, card_kinds: str | None = None) -> TestClient:
    Base.metadata.create_all(bind=engine)
    app.dependency_overrides[get_current_user_id] = lambda: user
    client = TestClient(app)

    now = datetime.now(timezone.utc).isoformat()
    payload = {
        "id": BOOK,
        "title": "카드",
        "created_at": now,
        "updated_at": now,
        "is_deleted": False,
    }
    if card_kinds is not None:
        payload["card_kinds"] = card_kinds
    assert client.put(f"/v1/word-books/{BOOK}", json=payload).status_code == 200

    # 학습 단계는 이 파일의 관심사가 아니다 — 일 단위로 단순하게 본다.
    client.put(
        "/v1/progress/settings",
        json={"learning_steps": "", "relearning_steps": "", "daily_new_limit": 9999},
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


def _due(client: TestClient) -> list[dict]:
    return client.get("/v1/review/due?limit=9999").json()["cards"]


def _grade(client: TestClient, card_id: str, value: str, log_id: str) -> dict:
    return client.post(
        "/v1/review/grades",
        json={
            "grades": [
                {
                    "id": log_id,
                    "word_id": card_id.split(":")[0],
                    "card_id": card_id,
                    "grade": value,
                    "reviewed_at": datetime.now(timezone.utc).isoformat(),
                }
            ]
        },
    ).json()


def test_default_book_makes_one_card_per_word() -> None:
    """설정을 안 건드린 단어장은 recognition 하나 — 지금까지의 동작이다."""
    client = _client("firebase-user-card-default")
    _add_word(client, "w1")

    cards = _due(client)
    assert [card["kind"] for card in cards] == ["recognition"]
    assert cards[0]["id"] == "w1:recognition"
    # 화면에 필요한 단어 내용이 함께 온다 — 조회를 두 번 하지 않는다.
    assert cards[0]["word"]["term"] == "w1"


def test_two_kinds_make_two_cards() -> None:
    client = _client("firebase-user-card-two", card_kinds="recognition,recall")
    _add_word(client, "w1")

    kinds = {card["kind"] for card in _due(client)}
    # 형제 카드는 한 세션에 하나만 나오므로 출제는 1장이다.
    assert len(_due(client)) == 1
    assert kinds <= {"recognition", "recall"}


def test_sibling_cards_do_not_appear_in_the_same_session() -> None:
    """같은 단어의 다른 방향이 연달아 나오면 답을 이미 봐서 채점이 무의미하다."""
    client = _client("firebase-user-card-sibling", card_kinds="recognition,recall")
    _add_word(client, "w1")
    _add_word(client, "w2")

    cards = _due(client)
    word_ids = [card["word"]["id"] for card in cards]

    assert len(word_ids) == 2
    assert len(set(word_ids)) == 2  # 단어당 한 장씩


def test_each_card_keeps_its_own_schedule() -> None:
    """카드를 나눈 이유 그 자체 — 방향마다 간격이 다르게 간다."""
    client = _client("firebase-user-card-schedule", card_kinds="recognition,recall")
    _add_word(client, "w1")

    # recognition만 두 번 맞힌다.
    _grade(client, "w1:recognition", "good", "log-1")
    _grade(client, "w1:recognition", "good", "log-2")

    cards = _due(client)
    # recognition은 3일 뒤로 밀려 오늘 목록에 없고, recall은 아직 새 카드다.
    assert [card["id"] for card in cards] == ["w1:recall"]


def test_removing_a_kind_hides_its_card_and_adding_it_back_restores() -> None:
    client = _client("firebase-user-card-kinds", card_kinds="recognition,recall")
    _add_word(client, "w1")
    _grade(client, "w1:recall", "good", "log-recall")

    now = datetime.now(timezone.utc).isoformat()
    book = {
        "id": BOOK,
        "title": "카드",
        "card_kinds": "recognition",
        "created_at": now,
        "updated_at": now,
        "is_deleted": False,
    }
    assert client.put(f"/v1/word-books/{BOOK}", json=book).status_code == 200

    # recall 카드는 출제에서 빠진다.
    assert all(card["kind"] == "recognition" for card in _due(client))

    # 다시 켜면 복습 기록이 살아 있어야 한다(soft delete라 행이 남는다).
    book["card_kinds"] = "recognition,recall"
    book["updated_at"] = datetime.now(timezone.utc).isoformat()
    assert client.put(f"/v1/word-books/{BOOK}", json=book).status_code == 200

    body = _grade(client, "w1:recall", "good", "log-recall-2")
    assert body["applied"] == 1


def test_grade_without_card_id_goes_to_recognition() -> None:
    """앱은 아직 단어 단위로 채점한다 — recognition 카드로 본다."""
    client = _client("firebase-user-card-compat", card_kinds="recognition,recall")
    _add_word(client, "w1")

    body = client.post(
        "/v1/review/grades",
        json={
            "grades": [
                {
                    "id": "log-compat",
                    "word_id": "w1",
                    "grade": "good",
                    "reviewed_at": datetime.now(timezone.utc).isoformat(),
                }
            ]
        },
    ).json()
    assert body["applied"] == 1

    # recognition만 밀렸고 recall은 그대로 남는다.
    assert [card["id"] for card in _due(client)] == ["w1:recall"]


def test_deleting_a_word_removes_its_cards() -> None:
    client = _client("firebase-user-card-delete", card_kinds="recognition,recall")
    _add_word(client, "w1")
    _add_word(client, "w2")

    assert (
        client.delete(f"/v1/word-books/{BOOK}/words/w1").status_code == 204
    )

    word_ids = {card["word"]["id"] for card in _due(client)}
    assert word_ids == {"w2"}


def test_count_matches_what_is_served() -> None:
    """화면 숫자와 실제 출제량이 다르면 사용자는 어느 쪽도 믿지 않는다."""
    client = _client("firebase-user-card-count", card_kinds="recognition,recall")
    for i in range(5):
        _add_word(client, f"w{i}")

    counted = client.get("/v1/review/due/count").json()
    assert counted["total"] == len(_due(client))
    assert counted["by_book"] == {BOOK: 5}
