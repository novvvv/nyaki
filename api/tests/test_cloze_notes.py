"""빈칸 노트 — 안키의 Cloze 노트 타입.

**단어의 파생물이 아니다.** 문장 한 덩이에 빈칸을 여럿 찍어 카드를 여러 장
만든다. 단어 암기뿐 아니라 정의·조문·개념을 외우는 데 쓴다.

문법은 안키와 같은 `{{cN::답}}`이다.
"""

from datetime import datetime, timedelta, timezone

from fastapi.testclient import TestClient

from app.core.auth import get_current_user_id
from app.core.database import Base, engine
from app.main import app
from app.vocab.services import cloze_numbers, render_cloze

BOOK = "cloze-book"
TEXT = "TCP는 {{c1::연결 지향}}, UDP는 {{c2::비연결}} 프로토콜이다"


# ==================== 파서 ====================


def test_parser_finds_blank_numbers() -> None:
    assert cloze_numbers(TEXT) == (1, 2)
    assert cloze_numbers("빈칸 없음") == ()
    # 같은 번호를 여러 번 쓰면 한 카드다 — 안키와 같다.
    assert cloze_numbers("{{c1::A}}와 {{c1::B}}") == (1,)


def test_parser_hides_only_the_asked_blank() -> None:
    front, back = render_cloze(TEXT, 1)

    # 묻는 빈칸만 가리고 나머지는 문맥으로 남긴다.
    assert front == "TCP는 [ … ], UDP는 비연결 프로토콜이다"
    assert back == "TCP는 연결 지향, UDP는 비연결 프로토콜이다"

    front2, _ = render_cloze(TEXT, 2)
    assert front2 == "TCP는 연결 지향, UDP는 [ … ] 프로토콜이다"


def test_parser_shows_hint_when_given() -> None:
    front, _ = render_cloze("답은 {{c1::42::숫자}}", 1)
    assert front == "답은 [ 숫자 ]"


# ==================== API ====================


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
                "title": "빈칸",
                "created_at": now,
                "updated_at": now,
                "is_deleted": False,
            },
        ).status_code
        == 200
    )
    client.put(
        "/v1/progress/settings",
        json={"learning_steps": "", "relearning_steps": "", "daily_new_limit": 9999},
    )
    return client


def _put_note(client: TestClient, note_id: str, text: str) -> dict:
    created = (datetime.now(timezone.utc) - timedelta(hours=1)).isoformat()
    response = client.put(
        f"/v1/word-books/{BOOK}/cloze-notes/{note_id}",
        json={
            "id": note_id,
            "word_book_id": BOOK,
            "text": text,
            "created_at": created,
            "updated_at": datetime.now(timezone.utc).isoformat(),
            "is_deleted": False,
        },
    )
    assert response.status_code == 200, response.text
    return response.json()


def _due(client: TestClient) -> list[dict]:
    return client.get("/v1/review/due?limit=9999").json()["cards"]


def test_one_note_makes_one_card_per_blank() -> None:
    """빈칸 두 개면 카드 두 장. 단, 한 세션에는 한 장만 나온다 —
    c1의 앞면이 c2의 답을 그대로 보여주기 때문이다(형제 카드 규칙)."""
    client = _client("firebase-user-cloze-basic")
    _put_note(client, "n1", TEXT)

    cards = _due(client)
    assert len(cards) == 1
    assert all(card["source_type"] == "cloze" for card in cards)
    assert all(card["word"] is None for card in cards)

    c1 = next(card for card in cards if card["kind"] == "c1")
    assert c1["id"] == "n1:c1"
    # 가리는 일은 서버가 한다 — 웹·앱이 각자 파싱하면 렌더가 갈린다.
    assert c1["cloze"]["front"] == "TCP는 [ … ], UDP는 비연결 프로토콜이다"
    assert c1["cloze"]["back"] == "TCP는 연결 지향, UDP는 비연결 프로토콜이다"

    app.dependency_overrides.clear()


def test_each_blank_keeps_its_own_schedule() -> None:
    client = _client("firebase-user-cloze-schedule")
    _put_note(client, "n1", TEXT)

    assert (
        client.post(
            "/v1/review/grades",
            json={
                "grades": [
                    {
                        "id": "log-c1",
                        "word_id": "n1",
                        "card_id": "n1:c1",
                        "grade": "good",
                        "reviewed_at": datetime.now(timezone.utc).isoformat(),
                    }
                ]
            },
        ).json()["applied"]
        == 1
    )

    # c1은 내일로 밀렸으니 이제 c2가 나온다.
    assert [card["kind"] for card in _due(client)] == ["c2"]

    app.dependency_overrides.clear()


def test_adding_a_blank_adds_a_card() -> None:
    client = _client("firebase-user-cloze-grow")
    _put_note(client, "n1", "{{c1::하나}}뿐")

    assert [card["kind"] for card in _due(client)] == ["c1"]

    _put_note(client, "n1", "{{c1::하나}}와 {{c2::둘}}")
    # 카드는 둘이지만 형제라 한 세션에는 하나만 나온다.
    assert len(_due(client)) == 1
    assert client.get("/v1/review/due/count").json()["total"] == 1

    app.dependency_overrides.clear()


def test_removing_a_blank_hides_its_card() -> None:
    client = _client("firebase-user-cloze-shrink")
    _put_note(client, "n1", TEXT)

    _put_note(client, "n1", "TCP는 {{c1::연결 지향}} 프로토콜이다")

    assert [card["kind"] for card in _due(client)] == ["c1"]

    app.dependency_overrides.clear()


def test_deleting_a_note_removes_its_cards() -> None:
    client = _client("firebase-user-cloze-delete")
    _put_note(client, "n1", TEXT)

    assert (
        client.delete(f"/v1/word-books/{BOOK}/cloze-notes/n1").status_code == 204
    )
    assert _due(client) == []

    app.dependency_overrides.clear()


def test_notes_are_listed_per_book() -> None:
    client = _client("firebase-user-cloze-list")
    _put_note(client, "n1", TEXT)
    _put_note(client, "n2", "{{c1::하나}}")

    notes = client.get(f"/v1/word-books/{BOOK}/cloze-notes").json()
    assert [note["id"] for note in notes] == ["n1", "n2"]

    app.dependency_overrides.clear()


def test_sync_carries_notes_and_their_cards() -> None:
    """앱도 빈칸 노트를 받아갈 수 있어야 한다."""
    client = _client("firebase-user-cloze-sync")
    _put_note(client, "n1", TEXT)

    changes = client.get("/v1/sync/pull?cursor=0").json()["changes"]
    kinds = [change["entity_type"] for change in changes]

    assert "cloze_note" in kinds
    assert kinds.count("card") == 2  # c1, c2

    note = next(c for c in changes if c["entity_type"] == "cloze_note")
    assert note["cloze_note"]["text"] == TEXT

    app.dependency_overrides.clear()


def test_word_cards_no_longer_have_a_cloze_kind() -> None:
    """빈칸은 단어의 종류가 아니다 — 0012의 잘못된 모델을 되돌렸다."""
    client = _client("firebase-user-cloze-kinds")

    now = datetime.now(timezone.utc).isoformat()
    body = client.put(
        f"/v1/word-books/{BOOK}",
        json={
            "id": BOOK,
            "title": "빈칸",
            "card_kinds": "recognition,cloze",
            "created_at": now,
            "updated_at": now,
            "is_deleted": False,
        },
    )
    assert body.status_code == 200

    created = (datetime.now(timezone.utc) - timedelta(hours=1)).isoformat()
    client.put(
        f"/v1/word-books/{BOOK}/words/w1",
        json={
            "id": "w1",
            "word_book_id": BOOK,
            "term": "w1",
            "meaning": "뜻",
            "created_at": created,
            "updated_at": created,
            "is_deleted": False,
        },
    )

    # cloze는 모르는 종류라 버려지고 recognition만 남는다.
    assert [card["kind"] for card in _due(client)] == ["recognition"]

    app.dependency_overrides.clear()


def test_different_notes_are_not_siblings() -> None:
    """형제 규칙은 같은 노트 안에서만이다 — 노트가 다르면 둘 다 나온다."""
    client = _client("firebase-user-cloze-two-notes")
    _put_note(client, "n1", "{{c1::하나}}")
    _put_note(client, "n2", "{{c1::둘}}")

    assert sorted(card["id"] for card in _due(client)) == ["n1:c1", "n2:c1"]

    app.dependency_overrides.clear()


# ==================== 집계 ====================


def test_summary_counts_words_and_notes_together() -> None:
    """사용자에게는 단어도 빈칸 노트도 "외울 거리 하나"다."""
    client = _client("firebase-user-summary")
    _put_note(client, "n1", TEXT)

    created = (datetime.now(timezone.utc) - timedelta(hours=1)).isoformat()
    client.put(
        f"/v1/word-books/{BOOK}/words/w1",
        json={
            "id": "w1",
            "word_book_id": BOOK,
            "term": "w1",
            "meaning": "뜻",
            "created_at": created,
            "updated_at": created,
            "is_deleted": False,
        },
    )

    summary = next(
        s
        for s in client.get("/v1/word-books/summaries").json()
        if s["word_book_id"] == BOOK
    )

    assert summary["item_count"] == 2  # 단어 1 + 노트 1
    assert summary["card_count"] == 3  # recognition 1 + c1 · c2
    assert summary["mastery_rate"] == 0  # 아직 아무것도 안 했다

    app.dependency_overrides.clear()


def test_summary_mastery_counts_cloze_cards() -> None:
    """빈칸만 외워도 암기율이 오른다 — 예전엔 단어의 srs_*만 봐서 0%였다."""
    client = _client("firebase-user-summary-mastery")
    _put_note(client, "n1", "{{c1::하나}}")

    client.post(
        "/v1/review/grades",
        json={
            "grades": [
                {
                    "id": "log-1",
                    "word_id": "n1",
                    "card_id": "n1:c1",
                    "grade": "good",
                    "reviewed_at": datetime.now(timezone.utc).isoformat(),
                }
            ]
        },
    )

    summary = next(
        s
        for s in client.get("/v1/word-books/summaries").json()
        if s["word_book_id"] == BOOK
    )

    # 간격 1일 → 20점, 카드가 하나뿐이라 그대로 암기율이 된다.
    assert summary["mastery_rate"] == 20

    app.dependency_overrides.clear()


def test_cloze_segments_mark_the_asked_blank() -> None:
    """화면이 빈칸 자리를 그대로 답으로 바꿀 수 있게 조각으로 준다."""
    client = _client("firebase-user-cloze-segments")
    _put_note(client, "n1", TEXT)

    card = _due(client)[0]
    segments = card["cloze"]["segments"]

    assert [s["text"] for s in segments] == [
        "TCP는 ",
        "연결 지향",
        ", UDP는 ",
        "비연결",
        " 프로토콜이다",
    ]
    # 지금 묻는 빈칸만 blank다. 나머지 빈칸은 답이 보인 채 문맥으로 남는다.
    assert [s["blank"] for s in segments] == [False, True, False, False, False]

    app.dependency_overrides.clear()


def test_due_cards_carry_their_word_book() -> None:
    """빈칸 카드는 단어가 없다 — 단어장으로 거르려면 서버가 알려줘야 한다."""
    client = _client("firebase-user-cloze-book-id")
    _put_note(client, "n1", "{{c1::하나}}")

    card = _due(client)[0]
    assert card["word_book_id"] == BOOK

    app.dependency_overrides.clear()
