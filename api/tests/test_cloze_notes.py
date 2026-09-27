"""빈칸 노트.

**단어의 파생물이 아니다.** 문장 한 덩이에 빈칸을 여럿 찍어 한 번에 묻는다.
단어 암기뿐 아니라 정의·조문·개념을 외우는 데 쓴다.

**노트 하나가 카드 한 장이다.** 빈칸이 셋이어도 카드는 하나다 —
"각 빈칸에 알맞은 용어를 쓰시오"가 문제 하나인 것과 같다.
(안키는 번호마다 카드를 따로 만들지만, 그 모델은 우리 쓰임에 안 맞았다.)

문법은 안키와 같은 `{{cN::답}}`이고, 번호는 어디를 가릴지 표시하는 용도다.
"""

from datetime import datetime, timedelta, timezone

from fastapi.testclient import TestClient

from app.core.auth import get_current_user_id
from app.core.database import Base, engine
from app.main import app
from app.vocab.services import cloze_count, render_cloze

BOOK = "cloze-book"
TEXT = "TCP는 {{c1::연결 지향}}, UDP는 {{c2::비연결}} 프로토콜이다"


# ==================== 파서 ====================


def test_parser_counts_blanks() -> None:
    assert cloze_count(TEXT) == 2
    assert cloze_count("빈칸 없음") == 0
    # 번호를 같게 쓰든 다르게 쓰든 자리 수만큼 센다.
    assert cloze_count("{{c1::A}}와 {{c1::B}}") == 2


def test_parser_hides_every_blank() -> None:
    front, back = render_cloze(TEXT)

    assert front == "TCP는 [ … ], UDP는 [ … ] 프로토콜이다"
    assert back == "TCP는 연결 지향, UDP는 비연결 프로토콜이다"


def test_parser_shows_hint_when_given() -> None:
    front, _ = render_cloze("답은 {{c1::42::숫자}}")
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


def test_one_note_makes_one_card() -> None:
    """빈칸이 둘이어도 카드는 하나다. 한 문제이기 때문이다."""
    client = _client("firebase-user-cloze-basic")
    _put_note(client, "n1", TEXT)

    cards = _due(client)
    assert len(cards) == 1

    card = cards[0]
    assert card["id"] == "n1:cloze"
    assert card["kind"] == "cloze"
    assert card["source_type"] == "cloze"
    assert card["word"] is None
    # 가리는 일은 서버가 한다 — 웹·앱이 각자 파싱하면 렌더가 갈린다.
    assert card["cloze"]["front"] == "TCP는 [ … ], UDP는 [ … ] 프로토콜이다"
    assert card["cloze"]["back"] == "TCP는 연결 지향, UDP는 비연결 프로토콜이다"

    app.dependency_overrides.clear()


def test_grading_the_note_pushes_the_whole_card_out() -> None:
    """빈칸별 일정은 없다 — 노트 하나에 일정 하나다."""
    client = _client("firebase-user-cloze-schedule")
    _put_note(client, "n1", TEXT)

    assert (
        client.post(
            "/v1/review/grades",
            json={
                "grades": [
                    {
                        "id": "log-1",
                        "word_id": "n1",
                        "card_id": "n1:cloze",
                        "grade": "good",
                        "reviewed_at": datetime.now(timezone.utc).isoformat(),
                    }
                ]
            },
        ).json()["applied"]
        == 1
    )

    assert _due(client) == []

    app.dependency_overrides.clear()


def test_adding_a_blank_does_not_add_a_card() -> None:
    client = _client("firebase-user-cloze-grow")
    _put_note(client, "n1", "{{c1::하나}}뿐")

    assert [card["kind"] for card in _due(client)] == ["cloze"]

    _put_note(client, "n1", "{{c1::하나}}와 {{c2::둘}}")
    assert [card["kind"] for card in _due(client)] == ["cloze"]
    assert client.get("/v1/review/due/count").json()["total"] == 1

    app.dependency_overrides.clear()


def test_removing_every_blank_hides_the_card() -> None:
    """물을 게 없으면 낼 것도 없다."""
    client = _client("firebase-user-cloze-shrink")
    _put_note(client, "n1", TEXT)
    assert len(_due(client)) == 1

    _put_note(client, "n1", "빈칸이 없는 문장")
    assert _due(client) == []

    # 다시 넣으면 살아난다.
    _put_note(client, "n1", TEXT)
    assert [card["id"] for card in _due(client)] == ["n1:cloze"]

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
    assert kinds.count("card") == 1  # 노트 하나에 카드 하나

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


def test_different_notes_each_bring_their_own_card() -> None:
    """노트가 다르면 각자 카드를 낸다 — 출처 키가 섞이지 않는지 본다."""
    client = _client("firebase-user-cloze-two-notes")
    _put_note(client, "n1", "{{c1::하나}}")
    _put_note(client, "n2", "{{c1::둘}}")

    assert sorted(card["id"] for card in _due(client)) == ["n1:cloze", "n2:cloze"]

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
    assert summary["card_count"] == 2  # 단어의 recognition 1 + 노트 1
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
                    "card_id": "n1:cloze",
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


def test_cloze_segments_mark_every_blank() -> None:
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
    # 빈칸 자리는 전부 blank다 — 한 번에 묻는다.
    assert [s["blank"] for s in segments] == [False, True, False, True, False]

    app.dependency_overrides.clear()


def test_due_cards_carry_their_word_book() -> None:
    """빈칸 카드는 단어가 없다 — 단어장으로 거르려면 서버가 알려줘야 한다."""
    client = _client("firebase-user-cloze-book-id")
    _put_note(client, "n1", "{{c1::하나}}")

    card = _due(client)[0]
    assert card["word_book_id"] == BOOK

    app.dependency_overrides.clear()
