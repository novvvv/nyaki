"""하루 한도 — 안키의 "새 카드/일", "최대 복습량/일".

**기본은 한도 없음이다.** 기본으로 걸어두니 "방금 추가한 단어를 오늘 못 푸는"
일이 생겼다. 조절이 필요한 사람이 켜는 기능으로 둔다.

**한도는 단어장별로 적용한다**(안키의 덱별 한도). 전역으로 걸면 먼저 만든
단어장이 몫을 다 가져가고, 방금 단어를 넣은 단어장은 0개가 된다.


단어를 만들면 srs_due_at = created_at이라 그 순간 전부 복습 대상이 된다.
팩으로 300개를 받으면 300개가 오늘 due로 잡힌다. 한도는 그중 오늘 몫만
꺼내 쓰게 한다.

신규/복습을 가르는 기준은 srs_last_reviewed_at이다(null이면 새 카드).
"""

from datetime import datetime, timedelta, timezone

from fastapi.testclient import TestClient

from app.core.auth import get_current_user_id
from app.core.database import Base, engine
from app.main import app

BOOK = "limit-book"


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
                "title": "한도",
                "created_at": now,
                "updated_at": now,
                "is_deleted": False,
            },
        ).status_code
        == 200
    )
    # 이 파일은 하루 한도만 본다. 학습 단계(기본 안키식)가 끼면 "모름 → 1분 뒤"가
    # 돼서 검증하려는 것과 무관한 변수가 는다.
    assert (
        client.put(
            "/v1/progress/settings",
            json={"learning_steps": "", "relearning_steps": ""},
        ).status_code
        == 200
    )
    return client


def _add_words(client: TestClient, count: int, prefix: str) -> list[str]:
    """새 카드 N개. srs_* 를 보내지 않으므로 서버가 즉시 due로 만든다."""
    ids = []
    # 과거 시각이어야 한다 — srs_due_at 기본값이 created_at이라 미래면 아직 due가 아니다.
    base = datetime.now(timezone.utc) - timedelta(hours=1)
    for i in range(count):
        now = (base + timedelta(seconds=i)).isoformat()
        word_id = f"{prefix}-{i}"
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
                    "is_deleted": False,
                },
            ).status_code
            == 200
        )
        ids.append(word_id)
    return ids


def test_no_limit_by_default() -> None:
    """기본은 한도 없음 — 방금 추가한 단어를 바로 풀 수 있어야 한다."""
    client = _client("firebase-user-limit-none")
    _add_words(client, 30, "none")

    assert len(client.get("/v1/review/due?limit=200").json()["words"]) == 30

    app.dependency_overrides.clear()


def test_new_cards_are_capped_when_the_limit_is_set() -> None:
    """팩으로 30개를 담아도 한도를 켜면 그만큼만 나온다."""
    client = _client("firebase-user-limit-new")
    client.put("/v1/progress/settings", json={"daily_new_limit": 10})
    _add_words(client, 30, "new")

    words = client.get("/v1/review/due?limit=200").json()["words"]
    assert len(words) == 10

    assert client.get("/v1/review/due/count").json()["total"] == 10

    app.dependency_overrides.clear()


def test_limit_applies_per_book() -> None:
    """단어장마다 몫이 따로다 — 전역이면 먼저 만든 쪽이 다 가져간다."""
    client = _client("firebase-user-limit-per-book")
    client.put("/v1/progress/settings", json={"daily_new_limit": 2})
    _add_words(client, 5, "a")

    # 두 번째 단어장을 만들고 단어를 넣는다.
    now = datetime.now(timezone.utc).isoformat()
    client.put(
        "/v1/word-books/second",
        json={
            "id": "second",
            "title": "둘째",
            "created_at": now,
            "updated_at": now,
            "is_deleted": False,
        },
    )
    created = (datetime.now(timezone.utc) - timedelta(minutes=1)).isoformat()
    for i in range(3):
        client.put(
            f"/v1/word-books/second/words/b{i}",
            json={
                "id": f"b{i}",
                "word_book_id": "second",
                "term": f"b{i}",
                "meaning": "뜻",
                "created_at": created,
                "updated_at": created,
                "is_deleted": False,
            },
        )

    counts = client.get("/v1/review/due/count").json()["by_book"]
    assert counts[BOOK] == 2
    assert counts["second"] == 2

    app.dependency_overrides.clear()


def test_new_cards_come_in_insertion_order() -> None:
    """앞 단원부터 나가야 한다 — 안키의 Insertion order = Sequential."""
    client = _client("firebase-user-limit-order")
    client.put("/v1/progress/settings", json={"daily_new_limit": 10})
    _add_words(client, 12, "seq")

    words = client.get("/v1/review/due?limit=200").json()["words"]
    assert [w["id"] for w in words] == [f"seq-{i}" for i in range(10)]

    app.dependency_overrides.clear()


def test_limit_can_be_changed_and_is_reported() -> None:
    client = _client("firebase-user-limit-change")
    _add_words(client, 30, "chg")

    body = client.put("/v1/progress/settings", json={"daily_new_limit": 25}).json()
    assert body["daily_new_limit"] == 25
    assert body["daily_review_limit"] == 9999  # 기본값이 채워져 내려온다

    assert len(client.get("/v1/review/due?limit=200").json()["words"]) == 25

    app.dependency_overrides.clear()


def test_grading_new_cards_consumes_today_quota() -> None:
    """오늘 10개를 배우면 그날은 더 안 나온다. 채점 기록으로 센다."""
    client = _client("firebase-user-limit-consume")
    client.put("/v1/progress/settings", json={"daily_new_limit": 10})
    _add_words(client, 30, "con")

    words = client.get("/v1/review/due?limit=200").json()["words"]
    assert len(words) == 10

    grades = [
        {
            "id": f"log-con-{i}",
            "word_id": word["id"],
            "grade": "good",
            "reviewed_at": datetime.now(timezone.utc).isoformat(),
        }
        for i, word in enumerate(words)
    ]
    assert client.post("/v1/review/grades", json={"grades": grades}).json() == {
        "applied": 10,
        "skipped": 0,
        "missing": 0,
    }

    # 채점한 10개는 내일로 밀렸고, 오늘 신규 몫은 다 썼다.
    assert client.get("/v1/review/due?limit=200").json()["words"] == []
    assert client.get("/v1/review/due/count").json()["total"] == 0

    app.dependency_overrides.clear()


def test_review_cards_are_not_limited_by_the_new_card_limit() -> None:
    """복습은 신규 한도와 무관하다. 밀린 복습까지 막으면 간격 반복이 깨진다."""
    client = _client("firebase-user-limit-review")
    client.put("/v1/progress/settings", json={"daily_new_limit": 10})
    words = _add_words(client, 5, "rev")

    # 5개를 '모름'으로 채점 → 즉시 다시 due가 되고, 이제 복습 카드다.
    grades = [
        {
            "id": f"log-rev-{i}",
            "word_id": word_id,
            "grade": "again",
            "reviewed_at": datetime.now(timezone.utc).isoformat(),
        }
        for i, word_id in enumerate(words)
    ]
    assert client.post("/v1/review/grades", json={"grades": grades}).json()["applied"] == 5

    # 신규 몫(10)은 5개를 썼지만, 복습 카드 5개는 그와 별개로 다시 나온다.
    ids = [w["id"] for w in client.get("/v1/review/due?limit=200").json()["words"]]
    assert set(words).issubset(set(ids))

    app.dependency_overrides.clear()


def test_review_limit_caps_review_cards() -> None:
    client = _client("firebase-user-limit-review-cap")
    words = _add_words(client, 4, "cap")

    assert (
        client.put(
            "/v1/progress/settings",
            json={"daily_new_limit": 0, "daily_review_limit": 2},
        ).status_code
        == 200
    )

    grades = [
        {
            "id": f"log-cap-{i}",
            "word_id": word_id,
            "grade": "again",
            "reviewed_at": datetime.now(timezone.utc).isoformat(),
        }
        for i, word_id in enumerate(words)
    ]
    # 신규 한도가 0이어도 이미 나와 있던 단어를 채점하는 것은 막지 않는다.
    assert client.post("/v1/review/grades", json={"grades": grades}).json()["applied"] == 4

    # 이 4번은 각 단어의 **첫 채점**이라 신규 소비로 센다. 복습 몫은 아직 2 그대로다.
    # 4개가 전부 다시 due지만 복습 한도가 2라 2개만 나온다.
    assert len(client.get("/v1/review/due?limit=200").json()["words"]) == 2

    app.dependency_overrides.clear()
