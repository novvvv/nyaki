import math
import re
from datetime import datetime, time, timedelta, timezone

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..models import (
    CardModel,
    ClozeNoteModel,
    ReviewLogModel,
    SyncChangeModel,
    UserProgressModel,
    WordBookModel,
    WordModel,
)
from .schemas import (
    CardPayload,
    ClozeNotePayload,
    ReviewGradeItem,
    WordBookPayload,
    WordPayload,
)
from .srs import DEFAULT_STEPS, Sm2State, StepConfig, grade


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _new_change(session: Session, user_id: str, entity_type: str, entity_id: str) -> int:
    change = SyncChangeModel(
        user_id=user_id,
        entity_type=entity_type,
        entity_id=entity_id,
    )
    session.add(change)
    session.flush()
    return change.cursor


def _as_utc(value: datetime) -> datetime:
    """시간대 없는 값은 UTC로 본다.

    우리는 UTC로만 저장하지만 SQLite 경로는 naive datetime을 돌려준다.
    그걸 그대로 astimezone에 넘기면 **로컬 시간(KST)으로 해석돼 9시간 어긋난다** —
    충돌 판정이 뒤집혀 오래된 변경이 최신 값을 덮어쓴다.
    """
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def _is_newer(incoming: datetime, current: datetime) -> bool:
    return _as_utc(incoming) > _as_utc(current)


def upsert_word_book(
    session: Session, user_id: str, payload: WordBookPayload
) -> tuple[WordBookModel, int | None]:
    entity = session.get(WordBookModel, {"id": payload.id, "user_id": user_id})
    if entity is not None and not _is_newer(payload.updated_at, entity.updated_at):
        return entity, None

    if entity is None:
        entity = WordBookModel(user_id=user_id, **payload.model_dump())
        session.add(entity)
    else:
        # 보낸 필드만 덮어쓴다. model_dump()는 안 보낸 필드까지 기본값으로 뱉어서,
        # 일부 필드만 아는 클라이언트가 나머지를 지워버린다 (ARCHITECTURE.md §4.6).
        for field, value in payload.model_dump(exclude_unset=True).items():
            setattr(entity, field, value)

    session.flush()
    # 카드 종류가 바뀌었으면 그 단어장의 단어들이 가진 카드를 맞춘다.
    sync_cards_for_book(session, user_id, payload.id)
    return entity, _new_change(session, user_id, "word_book", payload.id)


def upsert_word(
    session: Session, user_id: str, payload: WordPayload
) -> tuple[WordModel, int | None]:
    entity = session.get(WordModel, {"id": payload.id, "user_id": user_id})
    if entity is not None and not _is_newer(payload.updated_at, entity.updated_at):
        return entity, None

    if entity is None:
        entity = WordModel(user_id=user_id, **payload.model_dump())
        session.add(entity)
    else:
        # 보낸 필드만 덮어쓴다 (ARCHITECTURE.md §4.6).
        # 웹은 단어를 저장할 때 srs_*를 보내지 않는다 — 전체 덮어쓰기였을 때는
        # 뜻 한 글자만 고쳐도 그 단어의 복습 기록이 통째로 초기화됐다.
        for field, value in payload.model_dump(exclude_unset=True).items():
            setattr(entity, field, value)

    session.flush()
    # 단어가 생기거나 바뀌면 카드도 맞춘다 — 출제되는 것은 카드다.
    sync_cards_for_word(session, user_id, entity)
    return entity, _new_change(session, user_id, "word", payload.id)


def delete_word(session: Session, user_id: str, word_id: str) -> tuple[WordModel | None, int | None]:
    entity = session.get(WordModel, {"id": word_id, "user_id": user_id})
    if entity is None:
        return None, None
    if entity.is_deleted:
        return entity, None
    entity.is_deleted = True
    entity.updated_at = utc_now()
    session.flush()
    # 단어가 지워지면 그 카드도 출제 대상에서 빠져야 한다.
    sync_cards_for_word(session, user_id, entity)
    return entity, _new_change(session, user_id, "word", word_id)


def delete_word_book(
    session: Session, user_id: str, word_book_id: str
) -> tuple[WordBookModel | None, int | None]:
    entity = session.get(WordBookModel, {"id": word_book_id, "user_id": user_id})
    if entity is None:
        return None, None
    if entity.is_deleted:
        return entity, None
    entity.is_deleted = True
    entity.updated_at = utc_now()
    session.execute(
        WordModel.__table__.update()
        .where(
            WordModel.user_id == user_id,
            WordModel.word_book_id == word_book_id,
            WordModel.is_deleted.is_(False),
        )
        .values(is_deleted=True, updated_at=entity.updated_at)
    )
    # 단어장이 지워지면 그 안의 카드도 전부 지운다. 단어를 한 건씩 훑지 않고
    # word_id 목록으로 한 번에 처리한다 — 단어가 수백 개일 수 있다.
    session.execute(
        CardModel.__table__.update()
        .where(
            CardModel.user_id == user_id,
            CardModel.is_deleted.is_(False),
            CardModel.word_id.in_(
                select(WordModel.id).where(
                    WordModel.user_id == user_id,
                    WordModel.word_book_id == word_book_id,
                )
            ),
        )
        .values(is_deleted=True, updated_at=entity.updated_at)
    )
    session.flush()
    return entity, _new_change(session, user_id, "word_book", word_book_id)


def list_word_books(session: Session, user_id: str) -> list[WordBookModel]:
    return list(
        session.scalars(
            select(WordBookModel)
            .where(WordBookModel.user_id == user_id, WordBookModel.is_deleted.is_(False))
            .order_by(WordBookModel.created_at)
        )
    )


def list_words(session: Session, user_id: str, word_book_id: str) -> list[WordModel]:
    return list(
        session.scalars(
            select(WordModel)
            .where(
                WordModel.user_id == user_id,
                WordModel.word_book_id == word_book_id,
                WordModel.is_deleted.is_(False),
            )
            .order_by(WordModel.created_at)
        )
    )


# ==================== 카드 ====================
#
# 안키의 Note/Card 구분. 단어는 정보를 담고, 출제되는 것은 카드다.
# 같은 단어라도 "単語 → 뜻"과 "뜻 → 単語"는 익는 속도가 다르므로 SRS 상태가
# 카드마다 따로 있어야 한다.
#
# 종류는 고정 enum이다. 안키처럼 사용자가 템플릿을 짜게 하지 않는다 —
# 개인 단어장에 HTML 편집기는 과하고, 종류를 늘리려면 여기에 한 줄 추가하면 된다.

# 단어에서 나오는 카드 종류. 빈칸은 여기 없다 — 단어의 파생물이 아니라
# 별개 노트 타입이라서다(ClozeNoteModel).
CARD_KINDS = ("recognition", "recall")
DEFAULT_CARD_KINDS = ("recognition",)

# 안키와 같은 문법. `{{c1::답}}` · `{{c2::답::힌트}}`
CLOZE_PATTERN = re.compile(r"\{\{c(\d+)::(.+?)(?:::(.+?))?\}\}", re.DOTALL)


def cloze_numbers(text: str) -> tuple[int, ...]:
    """이 텍스트가 만드는 빈칸 번호들. 중복은 하나로 본다.

    같은 번호를 여러 번 쓰면(`{{c1::A}} … {{c1::B}}`) 한 카드에서 둘 다 가려진다 —
    안키와 같은 동작이다.
    """
    found = {int(match.group(1)) for match in CLOZE_PATTERN.finditer(text)}
    return tuple(sorted(n for n in found if n > 0))


def cloze_segments(text: str, number: int) -> list[tuple[str, bool, str | None]]:
    """문장을 조각으로 쪼갠다 — (글자, 이 자리가 묻는 빈칸인가, 힌트).

    앞뒤를 **문장 두 개**로 내려주면 화면이 "가린 문장"과 "답 문장"을 위아래로
    늘어놓게 된다. 사용자가 보고 싶은 것은 빈칸 자리가 답으로 바뀌는 것이다.
    그래서 자리 정보를 그대로 준다.
    """
    out: list[tuple[str, bool, str | None]] = []
    cursor = 0
    for match in CLOZE_PATTERN.finditer(text):
        if match.start() > cursor:
            out.append((text[cursor : match.start()], False, None))
        answer = match.group(2)
        if int(match.group(1)) == number:
            out.append((answer, True, match.group(3)))
        else:
            # 묻지 않는 빈칸은 답을 그대로 둔다 — 문맥으로 남긴다.
            out.append((answer, False, None))
        cursor = match.end()
    if cursor < len(text):
        out.append((text[cursor:], False, None))
    return out


def render_cloze(text: str, number: int) -> tuple[str, str]:
    """(앞면, 뒷면). 앞면은 해당 번호만 가리고 나머지는 답을 보여준다.

    안키와 같다 — 한 번에 한 빈칸만 묻고, 나머지는 문맥으로 남긴다.
    """

    def to_front(match: re.Match[str]) -> str:
        if int(match.group(1)) != number:
            return match.group(2)
        hint = match.group(3)
        return f"[ {hint} ]" if hint else "[ … ]"

    def to_back(match: re.Match[str]) -> str:
        return match.group(2)

    return CLOZE_PATTERN.sub(to_front, text), CLOZE_PATTERN.sub(to_back, text)


def card_id_for(word_id: str, kind: str) -> str:
    """카드 id는 규칙으로 만든다 — 클라이언트도 같은 값을 계산할 수 있어야 한다."""
    return f"{word_id}:{kind}"


def parse_card_kinds(raw: str | None) -> tuple[str, ...]:
    """단어장의 card_kinds 문자열 → 종류 목록. 모르는 값은 버린다."""
    if raw is None:
        return DEFAULT_CARD_KINDS
    kinds = tuple(
        chunk.strip()
        for chunk in raw.replace(",", " ").split()
        if chunk.strip() in CARD_KINDS
    )
    # 전부 지우면 출제할 게 없어진다 — 최소 한 종류는 남긴다.
    return kinds or DEFAULT_CARD_KINDS


def sync_cards_for_word(session: Session, user_id: str, word: WordModel) -> None:
    """단어의 카드를 단어장 설정에 맞춘다.

    - 없는 종류는 만든다. 새 카드는 단어와 같은 시각에 due로 시작한다.
    - 빠진 종류는 soft delete 한다. 되살릴 때 복습 기록이 남아 있어야 한다.
    - 단어가 지워졌으면 카드도 전부 지운다.
    """
    book = session.get(WordBookModel, {"id": word.word_book_id, "user_id": user_id})
    kinds = () if word.is_deleted else parse_card_kinds(
        book.card_kinds if book is not None else None
    )

    existing = {
        card.kind: card
        for card in session.scalars(
            select(CardModel).where(
                CardModel.user_id == user_id, CardModel.word_id == word.id
            )
        )
    }

    touched: list[str] = []

    for kind in kinds:
        card = existing.get(kind)
        if card is None:
            session.add(
                CardModel(
                    id=card_id_for(word.id, kind),
                    user_id=user_id,
                    source_type="word",
                    word_id=word.id,
                    kind=kind,
                    srs_due_at=word.srs_due_at,
                    created_at=word.created_at,
                    updated_at=word.updated_at,
                )
            )
            touched.append(card_id_for(word.id, kind))
        elif card.is_deleted:
            card.is_deleted = False
            card.updated_at = word.updated_at
            touched.append(card.id)

    for kind, card in existing.items():
        if kind not in kinds and not card.is_deleted:
            card.is_deleted = True
            card.updated_at = word.updated_at
            touched.append(card.id)

    session.flush()

    # 앱이 pull로 받아가야 한다 — 카드가 생겼는데 알려주지 않으면 앱은 계속
    # 단어 단위로만 보게 된다.
    for card_id in touched:
        _new_change(session, user_id, "card", card_id)


# ==================== 단어장 집계 ====================
#
# 개수와 암기율을 서버가 센다. 클라이언트가 각자 세면 "무엇을 한 개로 볼지"가
# 갈린다 — 실제로 웹은 단어만 세어 빈칸 노트가 빠졌고, 암기율은 words.srs_*를
# 읽어 빈칸 카드를 아예 무시했다.

MASTERY_DAYS = 30


def _card_score(interval_days: int) -> float:
    """카드 1장의 암기 점수(0~100).

    SM-2 간격이 1 → 3 → 8 → 20일로 지수적으로 늘어나므로 로그로 환산해야
    단계가 20 / 40 / 64 / 89로 고르게 벌어진다. 선형이면 첫 성공이 3점이다.
    """
    if interval_days <= 0:
        return 0.0
    ratio = math.log(1 + interval_days) / math.log(1 + MASTERY_DAYS)
    return min(ratio, 1.0) * 100


def book_summaries(session: Session, user_id: str) -> dict[str, dict[str, int]]:
    """단어장별 항목 수와 암기율.

    항목 = 단어 + 빈칸 노트. 사용자에게는 둘 다 "외울 거리 하나"다.
    암기율 = 그 단어장에 속한 **카드** 점수의 평균 — 아직 안 한 카드는 0점으로
    분모에 들어간다.
    """
    summaries: dict[str, dict[str, int]] = {}

    def bucket(book_id: str) -> dict[str, int]:
        return summaries.setdefault(
            book_id, {"item_count": 0, "card_count": 0, "mastery_rate": 0}
        )

    word_book_of: dict[str, str] = {}
    for word_id, book_id in session.execute(
        select(WordModel.id, WordModel.word_book_id).where(
            WordModel.user_id == user_id, WordModel.is_deleted.is_(False)
        )
    ):
        word_book_of[word_id] = book_id
        bucket(book_id)["item_count"] += 1

    note_book_of: dict[str, str] = {}
    for note_id, book_id in session.execute(
        select(ClozeNoteModel.id, ClozeNoteModel.word_book_id).where(
            ClozeNoteModel.user_id == user_id, ClozeNoteModel.is_deleted.is_(False)
        )
    ):
        note_book_of[note_id] = book_id
        bucket(book_id)["item_count"] += 1

    totals: dict[str, float] = {}
    for word_id, note_id, interval in session.execute(
        select(
            CardModel.word_id, CardModel.note_id, CardModel.srs_interval_days
        ).where(CardModel.user_id == user_id, CardModel.is_deleted.is_(False))
    ):
        book_id = word_book_of.get(word_id or "") or note_book_of.get(note_id or "")
        if book_id is None:
            continue
        bucket(book_id)["card_count"] += 1
        totals[book_id] = totals.get(book_id, 0.0) + _card_score(interval)

    for book_id, summary in summaries.items():
        if summary["card_count"] > 0:
            summary["mastery_rate"] = round(totals.get(book_id, 0.0) / summary["card_count"])

    return summaries


def upsert_card(
    session: Session, user_id: str, payload: "CardPayload"
) -> tuple[CardModel, int | None]:
    """앱이 동기화로 올린 카드를 반영한다. 충돌 규칙은 단어와 같다(updated_at 최신 우선).

    recognition 카드는 결과를 단어 행에도 복사한다. 웹의 암기율이 아직
    words.srs_interval_days를 읽기 때문이다 — 그쪽을 카드로 옮기면 지운다.
    """
    entity = session.get(CardModel, {"id": payload.id, "user_id": user_id})
    if entity is not None and not _is_newer(payload.updated_at, entity.updated_at):
        return entity, None

    if entity is None:
        entity = CardModel(user_id=user_id, **payload.model_dump())
        session.add(entity)
    else:
        for field, value in payload.model_dump(exclude_unset=True).items():
            setattr(entity, field, value)

    session.flush()

    if entity.kind == "recognition":
        word = session.get(WordModel, {"id": entity.word_id, "user_id": user_id})
        if word is not None:
            word.srs_ease_factor = entity.srs_ease_factor
            word.srs_interval_days = entity.srs_interval_days
            word.srs_repetitions = entity.srs_repetitions
            word.srs_lapses = entity.srs_lapses
            word.srs_due_at = entity.srs_due_at
            word.srs_last_reviewed_at = entity.srs_last_reviewed_at
            word.srs_learning_step = entity.srs_learning_step

    return entity, _new_change(session, user_id, "card", payload.id)


def delete_card(
    session: Session, user_id: str, card_id: str
) -> tuple[CardModel | None, int | None]:
    entity = session.get(CardModel, {"id": card_id, "user_id": user_id})
    if entity is None:
        return None, None
    if entity.is_deleted:
        return entity, None
    entity.is_deleted = True
    entity.updated_at = utc_now()
    session.flush()
    return entity, _new_change(session, user_id, "card", card_id)


def sync_cards_for_note(session: Session, user_id: str, note: ClozeNoteModel) -> None:
    """빈칸 노트의 카드를 텍스트에 맞춘다.

    빈칸 번호가 곧 카드 종류다(c1, c2 …). 번호를 지우면 그 카드는 soft delete —
    다시 넣으면 복습 기록이 살아난다.
    """
    numbers = () if note.is_deleted else cloze_numbers(note.text)
    kinds = tuple(f"c{number}" for number in numbers)

    existing = {
        card.kind: card
        for card in session.scalars(
            select(CardModel).where(
                CardModel.user_id == user_id, CardModel.note_id == note.id
            )
        )
    }

    touched: list[str] = []

    for kind in kinds:
        card = existing.get(kind)
        if card is None:
            session.add(
                CardModel(
                    id=card_id_for(note.id, kind),
                    user_id=user_id,
                    source_type="cloze",
                    note_id=note.id,
                    kind=kind,
                    srs_due_at=note.created_at,
                    created_at=note.created_at,
                    updated_at=note.updated_at,
                )
            )
            touched.append(card_id_for(note.id, kind))
        elif card.is_deleted:
            card.is_deleted = False
            card.updated_at = note.updated_at
            touched.append(card.id)

    for kind, card in existing.items():
        if kind not in kinds and not card.is_deleted:
            card.is_deleted = True
            card.updated_at = note.updated_at
            touched.append(card.id)

    session.flush()
    for card_id in touched:
        _new_change(session, user_id, "card", card_id)


def upsert_cloze_note(
    session: Session, user_id: str, payload: "ClozeNotePayload"
) -> tuple[ClozeNoteModel, int | None]:
    entity = session.get(ClozeNoteModel, {"id": payload.id, "user_id": user_id})
    if entity is not None and not _is_newer(payload.updated_at, entity.updated_at):
        return entity, None

    if entity is None:
        entity = ClozeNoteModel(user_id=user_id, **payload.model_dump())
        session.add(entity)
    else:
        for field, value in payload.model_dump(exclude_unset=True).items():
            setattr(entity, field, value)

    session.flush()
    sync_cards_for_note(session, user_id, entity)
    return entity, _new_change(session, user_id, "cloze_note", payload.id)


def delete_cloze_note(
    session: Session, user_id: str, note_id: str
) -> tuple[ClozeNoteModel | None, int | None]:
    entity = session.get(ClozeNoteModel, {"id": note_id, "user_id": user_id})
    if entity is None:
        return None, None
    if entity.is_deleted:
        return entity, None
    entity.is_deleted = True
    entity.updated_at = utc_now()
    session.flush()
    sync_cards_for_note(session, user_id, entity)
    return entity, _new_change(session, user_id, "cloze_note", note_id)


def list_cloze_notes(
    session: Session, user_id: str, word_book_id: str
) -> list[ClozeNoteModel]:
    return list(
        session.scalars(
            select(ClozeNoteModel)
            .where(
                ClozeNoteModel.user_id == user_id,
                ClozeNoteModel.word_book_id == word_book_id,
                ClozeNoteModel.is_deleted.is_(False),
            )
            .order_by(ClozeNoteModel.created_at)
        )
    )


def sync_cards_for_book(session: Session, user_id: str, word_book_id: str) -> None:
    """단어장의 카드 종류가 바뀌었을 때 그 안의 단어를 전부 맞춘다."""
    words = session.scalars(
        select(WordModel).where(
            WordModel.user_id == user_id,
            WordModel.word_book_id == word_book_id,
            WordModel.is_deleted.is_(False),
        )
    )
    for word in words:
        sync_cards_for_word(session, user_id, word)


# ==================== 하루 한도 ====================
#
# 단어를 만들면 srs_due_at = created_at이라 그 순간 전부 복습 대상이 된다.
# 팩으로 300개를 받으면 300개가 오늘 due로 잡히고, 사용자는 "300개 밀렸다"는
# 압박만 받는다. 안키는 이걸 신규 카드 한도로 막는다 — 하루 20개씩 꺼내 쓴다.
#
# 신규/복습을 가르는 기준은 srs_last_reviewed_at이다. null이면 한 번도 채점하지
# 않은 "새 카드"다. 컬럼을 새로 만들 필요가 없다.

KST = timezone(timedelta(hours=9))

# 기본은 **한도 없음**이다.
#
# 원래 목적은 복습 폭발을 막는 것이다 — 하루에 새 단어 100개를 배우면 며칠 뒤
# 복습이 수백 개로 불어난다. 하지만 기본으로 걸어두니 "방금 추가한 단어를 바로
# 못 푸는" 일이 생겼다. 조절이 필요한 사람이 켜는 기능으로 둔다.
DEFAULT_NEW_LIMIT = 9999
DEFAULT_REVIEW_LIMIT = 9999


def _today_start_utc() -> datetime:
    """오늘(KST) 자정을 UTC 절대시각으로. 퀘스트와 같은 날짜 경계를 쓴다."""
    now_kst = datetime.now(KST)
    return datetime.combine(now_kst.date(), time.min, tzinfo=KST).astimezone(timezone.utc)


def _daily_limits(session: Session, user_id: str) -> tuple[int, int]:
    progress = session.get(UserProgressModel, user_id)
    if progress is None:
        return DEFAULT_NEW_LIMIT, DEFAULT_REVIEW_LIMIT
    return (
        progress.daily_new_limit
        if progress.daily_new_limit is not None
        else DEFAULT_NEW_LIMIT,
        progress.daily_review_limit
        if progress.daily_review_limit is not None
        else DEFAULT_REVIEW_LIMIT,
    )


def _consumed_today(session: Session, user_id: str) -> tuple[int, int]:
    """오늘 쓴 몫 (신규, 복습).

    신규는 "오늘 처음 채점된 단어 수"다 — review_logs에서 단어별 첫 기록이
    오늘인 것을 센다. 복습은 오늘 전체 채점 수에서 그만큼을 뺀 값이다.
    """
    start = _today_start_utc()

    first_seen = (
        select(
            ReviewLogModel.word_id,
            func.min(ReviewLogModel.created_at).label("first_at"),
        )
        .where(ReviewLogModel.user_id == user_id)
        .group_by(ReviewLogModel.word_id)
        .subquery()
    )
    new_used = session.scalar(
        select(func.count())
        .select_from(first_seen)
        .where(first_seen.c.first_at >= start)
    ) or 0

    total_today = session.scalar(
        select(func.count()).where(
            ReviewLogModel.user_id == user_id,
            ReviewLogModel.created_at >= start,
        )
    ) or 0

    return new_used, max(0, total_today - new_used)


def _parse_steps(raw: str | None) -> tuple[int, ...]:
    """"1,10" → (1, 10). 공백·쉼표 아무거나 허용하고 잘못된 값은 버린다.

    설정 화면에서 손으로 치는 값이라 관대하게 읽는다. 0 이하는 의미가 없어 뺀다.
    """
    if not raw:
        return ()
    out: list[int] = []
    for chunk in raw.replace(",", " ").split():
        try:
            minutes = int(chunk)
        except ValueError:
            continue
        if minutes > 0:
            out.append(minutes)
    return tuple(out)


# 안키 기본값과 같다. 컬럼이 null이면(= 한 번도 설정한 적 없으면) 이 값을 쓴다.
DEFAULT_LEARNING_STEPS = (1, 10)
DEFAULT_RELEARNING_STEPS = (10,)


def steps_or_default(raw: str | None, default: tuple[int, ...]) -> tuple[int, ...]:
    """null과 빈 문자열을 구분한다.

    - null  = 설정한 적 없음 → 기본값
    - ""    = 사용자가 일부러 비움 → 단계 없이 바로 일 단위로
    """
    if raw is None:
        return default
    return _parse_steps(raw)


def load_step_config(session: Session, user_id: str) -> StepConfig:
    """저장된 복습 흐름 설정. 설정한 적 없으면 안키 기본값."""
    progress = session.get(UserProgressModel, user_id)
    if progress is None:
        return StepConfig(
            learning_steps=DEFAULT_LEARNING_STEPS,
            relearning_steps=DEFAULT_RELEARNING_STEPS,
            graduating_interval_days=1,
        )
    return StepConfig(
        learning_steps=steps_or_default(progress.learning_steps, DEFAULT_LEARNING_STEPS),
        relearning_steps=steps_or_default(
            progress.relearning_steps, DEFAULT_RELEARNING_STEPS
        ),
        graduating_interval_days=progress.graduating_interval_days or 1,
    )


def _book_of_sources(session: Session, user_id: str) -> dict[str, str]:
    """카드의 출처 id → 단어장 id. 단어와 빈칸 노트를 한 표로 합친다."""
    mapping = {
        row[0]: row[1]
        for row in session.execute(
            select(WordModel.id, WordModel.word_book_id).where(
                WordModel.user_id == user_id, WordModel.is_deleted.is_(False)
            )
        )
    }
    mapping.update(
        {
            row[0]: row[1]
            for row in session.execute(
                select(ClozeNoteModel.id, ClozeNoteModel.word_book_id).where(
                    ClozeNoteModel.user_id == user_id,
                    ClozeNoteModel.is_deleted.is_(False),
                )
            )
        }
    )
    return mapping


def _consumed_today_by_book(
    session: Session, user_id: str, book_of: dict[str, str]
) -> dict[str, tuple[int, int]]:
    """오늘 쓴 몫을 단어장별로. (신규, 복습)

    한도를 단어장별로 적용하므로 소비량도 단어장별로 세야 한다 —
    안키의 덱별 한도와 같은 구조다.
    """
    start = _today_start_utc()

    first_seen = (
        select(
            ReviewLogModel.card_id,
            func.min(ReviewLogModel.created_at).label("first_at"),
        )
        .where(ReviewLogModel.user_id == user_id)
        .group_by(ReviewLogModel.card_id)
        .subquery()
    )
    new_card_ids = {
        row[0]
        for row in session.execute(
            select(first_seen.c.card_id).where(first_seen.c.first_at >= start)
        )
        if row[0]
    }

    used: dict[str, list[int]] = {}
    rows = session.execute(
        select(ReviewLogModel.card_id, CardModel.word_id, CardModel.note_id)
        .join(
            CardModel,
            (CardModel.id == ReviewLogModel.card_id)
            & (CardModel.user_id == ReviewLogModel.user_id),
        )
        .where(
            ReviewLogModel.user_id == user_id,
            ReviewLogModel.created_at >= start,
        )
    )
    for card_id, word_id, note_id in rows:
        book_id = book_of.get(word_id or "") or book_of.get(note_id or "")
        if book_id is None:
            continue
        bucket = used.setdefault(book_id, [0, 0])
        if card_id in new_card_ids:
            bucket[0] += 1
        else:
            bucket[1] += 1

    return {book_id: (value[0], value[1]) for book_id, value in used.items()}


def _due_base(user_id: str):
    """출제 대상 카드의 공통 조건. 단어가 지워졌으면 카드도 지워지므로 카드만 본다."""
    return (
        CardModel.user_id == user_id,
        CardModel.is_deleted.is_(False),
        CardModel.srs_due_at <= utc_now(),
    )


def _one_card_per_source(cards: list[CardModel]) -> list[CardModel]:
    """같은 출처(단어 또는 빈칸 노트)의 형제 카드는 한 세션에 하나만 낸다.

    "単語 → 뜻"을 풀고 곧바로 "뜻 → 単語"가 나오면 답을 이미 봐서 채점이 무의미하다.
    빈칸 노트는 더 직접적이다 — c1 카드의 앞면이 c2의 답을 그대로 보여준다.

    안키의 bury siblings와 같은 목적이고, 여기서는 **이번 출제분에서 빼는** 것으로
    가볍게 처리한다. 밀려난 카드는 다음 세션에 나온다.

    묶는 기준은 word_id가 아니라 **출처 키**다 — 빈칸 카드는 word_id가 전부 null이라
    그걸로 묶으면 서로 다른 노트까지 한 장으로 합쳐진다.
    """
    seen: set[str] = set()
    out: list[CardModel] = []
    for card in cards:
        key = card.note_id or card.word_id or card.id
        if key in seen:
            continue
        seen.add(key)
        out.append(card)
    return out


def select_due_cards(
    session: Session,
    user_id: str,
    limit: int | None = None,
    book_ids: list[str] | None = None,
) -> list[CardModel]:
    """오늘 낼 수 있는 카드.

    **하루 한도는 단어장별로 적용한다** — 안키의 덱별 한도와 같다. 전역으로 걸면
    먼저 만든 단어장이 몫을 다 가져가고, 방금 단어를 넣은 단어장은 0개가 된다.

    복습 카드를 먼저(오래 밀린 순), 남은 자리에 새 카드를 채운다.
    """
    new_limit, review_limit = _daily_limits(session, user_id)
    book_of = _book_of_sources(session, user_id)
    used = _consumed_today_by_book(session, user_id, book_of)

    wanted = set(book_ids) if book_ids else None

    due_cards = list(
        session.scalars(
            select(CardModel)
            .where(*_due_base(user_id))
            .order_by(CardModel.srs_due_at.asc(), CardModel.created_at.asc())
        )
    )

    per_book: dict[str, list[CardModel]] = {}
    for card in due_cards:
        book_id = book_of.get(card.word_id or "") or book_of.get(card.note_id or "")
        if book_id is None:
            continue
        if wanted is not None and book_id not in wanted:
            continue
        per_book.setdefault(book_id, []).append(card)

    picked: list[CardModel] = []
    for book_id, cards in per_book.items():
        new_used, review_used = used.get(book_id, (0, 0))
        review_quota = max(0, review_limit - review_used)
        new_quota = max(0, new_limit - new_used)

        reviews = [c for c in cards if c.srs_last_reviewed_at is not None]
        news = [c for c in cards if c.srs_last_reviewed_at is None]

        picked.extend(_one_card_per_source(reviews)[:review_quota])
        picked.extend(_one_card_per_source(news)[:new_quota])

    # 단어장 경계를 넘어 다시 한 번 형제를 거른다(같은 출처가 두 번 들어올 일은
    # 없지만, 정렬을 되돌려 오래 밀린 순으로 맞추기 위해 한 번 더 훑는다).
    picked.sort(key=lambda card: (card.srs_due_at, card.created_at))
    picked = _one_card_per_source(picked)

    return picked[:limit] if limit is not None else picked


def count_due_cards(
    session: Session, user_id: str, book_ids: list[str] | None = None
) -> dict[str, int]:
    """오늘 낼 수 있는 카드 수를 단어장별로 센다.

    select_due_cards와 같은 규칙이어야 한다 — 화면의 숫자와 실제 출제량이
    다르면 사용자는 어느 쪽도 믿지 않는다. 한도가 단어장별이므로 이 숫자도
    "그 단어장만 고르면 몇 개를 할 수 있나"와 같은 뜻이다.
    """
    cards = select_due_cards(session, user_id, book_ids=book_ids)
    if not cards:
        return {}

    book_of = _book_of_sources(session, user_id)
    counts: dict[str, int] = {}
    for card in cards:
        book_id = book_of.get(card.word_id or "") or book_of.get(card.note_id or "")
        if book_id is None:
            continue
        counts[book_id] = counts.get(book_id, 0) + 1
    return counts


def _parse_steps(raw: str | None) -> tuple[int, ...]:
    """"1,10" → (1, 10). 공백·쉼표 아무거나 허용하고 잘못된 값은 버린다.

    설정 화면에서 손으로 치는 값이라 관대하게 읽는다. 0 이하는 의미가 없어 뺀다.
    """
    if not raw:
        return ()
    out: list[int] = []
    for chunk in raw.replace(",", " ").split():
        try:
            minutes = int(chunk)
        except ValueError:
            continue
        if minutes > 0:
            out.append(minutes)
    return tuple(out)


# 안키 기본값과 같다. 컬럼이 null이면(= 한 번도 설정한 적 없으면) 이 값을 쓴다.
DEFAULT_LEARNING_STEPS = (1, 10)
DEFAULT_RELEARNING_STEPS = (10,)


def steps_or_default(raw: str | None, default: tuple[int, ...]) -> tuple[int, ...]:
    """null과 빈 문자열을 구분한다.

    - null  = 설정한 적 없음 → 기본값
    - ""    = 사용자가 일부러 비움 → 단계 없이 바로 일 단위로
    """
    if raw is None:
        return default
    return _parse_steps(raw)


def load_step_config(session: Session, user_id: str) -> StepConfig:
    """저장된 복습 흐름 설정. 설정한 적 없으면 안키 기본값."""
    progress = session.get(UserProgressModel, user_id)
    if progress is None:
        return StepConfig(
            learning_steps=DEFAULT_LEARNING_STEPS,
            relearning_steps=DEFAULT_RELEARNING_STEPS,
            graduating_interval_days=1,
        )
    return StepConfig(
        learning_steps=steps_or_default(progress.learning_steps, DEFAULT_LEARNING_STEPS),
        relearning_steps=steps_or_default(
            progress.relearning_steps, DEFAULT_RELEARNING_STEPS
        ),
        graduating_interval_days=progress.graduating_interval_days or 1,
    )


def _book_of_sources(session: Session, user_id: str) -> dict[str, str]:
    """카드의 출처 id → 단어장 id. 단어와 빈칸 노트를 한 표로 합친다."""
    mapping = {
        row[0]: row[1]
        for row in session.execute(
            select(WordModel.id, WordModel.word_book_id).where(
                WordModel.user_id == user_id, WordModel.is_deleted.is_(False)
            )
        )
    }
    mapping.update(
        {
            row[0]: row[1]
            for row in session.execute(
                select(ClozeNoteModel.id, ClozeNoteModel.word_book_id).where(
                    ClozeNoteModel.user_id == user_id,
                    ClozeNoteModel.is_deleted.is_(False),
                )
            )
        }
    )
    return mapping


def _consumed_today_by_book(
    session: Session, user_id: str, book_of: dict[str, str]
) -> dict[str, tuple[int, int]]:
    """오늘 쓴 몫을 단어장별로. (신규, 복습)

    한도를 단어장별로 적용하므로 소비량도 단어장별로 세야 한다 —
    안키의 덱별 한도와 같은 구조다.
    """
    start = _today_start_utc()

    first_seen = (
        select(
            ReviewLogModel.card_id,
            func.min(ReviewLogModel.created_at).label("first_at"),
        )
        .where(ReviewLogModel.user_id == user_id)
        .group_by(ReviewLogModel.card_id)
        .subquery()
    )
    new_card_ids = {
        row[0]
        for row in session.execute(
            select(first_seen.c.card_id).where(first_seen.c.first_at >= start)
        )
        if row[0]
    }

    used: dict[str, list[int]] = {}
    rows = session.execute(
        select(ReviewLogModel.card_id, CardModel.word_id, CardModel.note_id)
        .join(
            CardModel,
            (CardModel.id == ReviewLogModel.card_id)
            & (CardModel.user_id == ReviewLogModel.user_id),
        )
        .where(
            ReviewLogModel.user_id == user_id,
            ReviewLogModel.created_at >= start,
        )
    )
    for card_id, word_id, note_id in rows:
        book_id = book_of.get(word_id or "") or book_of.get(note_id or "")
        if book_id is None:
            continue
        bucket = used.setdefault(book_id, [0, 0])
        if card_id in new_card_ids:
            bucket[0] += 1
        else:
            bucket[1] += 1

    return {book_id: (value[0], value[1]) for book_id, value in used.items()}


def _due_base(user_id: str):
    """출제 대상 카드의 공통 조건. 단어가 지워졌으면 카드도 지워지므로 카드만 본다."""
    return (
        CardModel.user_id == user_id,
        CardModel.is_deleted.is_(False),
        CardModel.srs_due_at <= utc_now(),
    )


def _one_card_per_source(cards: list[CardModel]) -> list[CardModel]:
    """같은 출처(단어 또는 빈칸 노트)의 형제 카드는 한 세션에 하나만 낸다.

    "単語 → 뜻"을 풀고 곧바로 "뜻 → 単語"가 나오면 답을 이미 봐서 채점이 무의미하다.
    빈칸 노트는 더 직접적이다 — c1 카드의 앞면이 c2의 답을 그대로 보여준다.

    안키의 bury siblings와 같은 목적이고, 여기서는 **이번 출제분에서 빼는** 것으로
    가볍게 처리한다. 밀려난 카드는 다음 세션에 나온다.

    묶는 기준은 word_id가 아니라 **출처 키**다 — 빈칸 카드는 word_id가 전부 null이라
    그걸로 묶으면 서로 다른 노트까지 한 장으로 합쳐진다.
    """
    seen: set[str] = set()
    out: list[CardModel] = []
    for card in cards:
        key = card.note_id or card.word_id or card.id
        if key in seen:
            continue
        seen.add(key)
        out.append(card)
    return out


def select_due_cards(
    session: Session,
    user_id: str,
    limit: int | None = None,
    book_ids: list[str] | None = None,
) -> list[CardModel]:
    """오늘 낼 수 있는 카드.

    **하루 한도는 단어장별로 적용한다** — 안키의 덱별 한도와 같다. 전역으로 걸면
    먼저 만든 단어장이 몫을 다 가져가고, 방금 단어를 넣은 단어장은 0개가 된다.

    복습 카드를 먼저(오래 밀린 순), 남은 자리에 새 카드를 채운다.
    """
    new_limit, review_limit = _daily_limits(session, user_id)
    book_of = _book_of_sources(session, user_id)
    used = _consumed_today_by_book(session, user_id, book_of)

    wanted = set(book_ids) if book_ids else None

    due_cards = list(
        session.scalars(
            select(CardModel)
            .where(*_due_base(user_id))
            .order_by(CardModel.srs_due_at.asc(), CardModel.created_at.asc())
        )
    )

    per_book: dict[str, list[CardModel]] = {}
    for card in due_cards:
        book_id = book_of.get(card.word_id or "") or book_of.get(card.note_id or "")
        if book_id is None:
            continue
        if wanted is not None and book_id not in wanted:
            continue
        per_book.setdefault(book_id, []).append(card)

    picked: list[CardModel] = []
    for book_id, cards in per_book.items():
        new_used, review_used = used.get(book_id, (0, 0))
        review_quota = max(0, review_limit - review_used)
        new_quota = max(0, new_limit - new_used)

        reviews = [c for c in cards if c.srs_last_reviewed_at is not None]
        news = [c for c in cards if c.srs_last_reviewed_at is None]

        picked.extend(_one_card_per_source(reviews)[:review_quota])
        picked.extend(_one_card_per_source(news)[:new_quota])

    # 단어장 경계를 넘어 다시 한 번 형제를 거른다(같은 출처가 두 번 들어올 일은
    # 없지만, 정렬을 되돌려 오래 밀린 순으로 맞추기 위해 한 번 더 훑는다).
    picked.sort(key=lambda card: (card.srs_due_at, card.created_at))
    picked = _one_card_per_source(picked)

    return picked[:limit] if limit is not None else picked


def count_due_cards(session: Session, user_id: str) -> dict[str, int]:
    """오늘 낼 수 있는 카드 수를 **단어장별로** 센다.

    select_due_cards와 같은 규칙으로 세야 한다 — 화면의 숫자와 실제 출제량이
    다르면 사용자는 어느 쪽도 믿지 않는다.
    """
    cards = select_due_cards(session, user_id)
    if not cards:
        return {}

    book_of = dict(
        session.execute(
            select(WordModel.id, WordModel.word_book_id).where(
                WordModel.user_id == user_id,
                WordModel.id.in_(
                    [card.word_id for card in cards if card.word_id is not None]
                ),
            )
        ).all()
    )
    book_of.update(
        dict(
            session.execute(
                select(ClozeNoteModel.id, ClozeNoteModel.word_book_id).where(
                    ClozeNoteModel.user_id == user_id,
                    ClozeNoteModel.id.in_(
                        [card.note_id for card in cards if card.note_id is not None]
                    ),
                )
            ).all()
        )
    )

    counts: dict[str, int] = {}
    for card in cards:
        book_id = book_of.get(card.note_id or card.word_id)
        if book_id is None:
            continue
        counts[book_id] = counts.get(book_id, 0) + 1
    return counts


def apply_review_grades(
    session: Session, user_id: str, items: list[ReviewGradeItem]
) -> tuple[int, int, int]:
    """채점 묶음을 반영한다. (applied, skipped, missing)

    웹 테스트는 카드를 한 장씩 보내지 않고 세션이 끝날 때 모아서 보낸다
    (docs/WEB-REVIEW-PLAN.md 1절). 그래서 여기가 여러 건을 한 트랜잭션으로 받는다.

    **같은 요청을 두 번 받아도 결과가 같아야 한다.** 응답이 끊겨 클라이언트가
    재전송하는 일이 실제로 생기는데, good이 두 번 반영되면 repetitions가 2 올라가고
    복습 간격이 실제보다 훨씬 길어진다. 사용자는 단어가 한참 안 나오는 이유를 모른다.
    이미 기록된 id를 먼저 걸러내는 게 그래서 첫 단계다.

    SM-2 계산에는 클라이언트가 보낸 reviewed_at이 아니라 **서버 수신 시각**을 쓴다.
    기기 시계를 미래로 돌려 간격을 늘리는 걸 막는다. 간격이 일 단위라 세션이 몇 분
    걸려도 결과는 같다.
    """
    if not items:
        return 0, 0, 0

    now = utc_now()
    config = load_step_config(session, user_id)

    # 1. 이미 처리한 id 걸러내기
    seen = set(
        session.scalars(
            select(ReviewLogModel.id).where(
                ReviewLogModel.user_id == user_id,
                ReviewLogModel.id.in_([item.id for item in items]),
            )
        )
    )

    applied = 0
    skipped = 0
    missing = 0

    for item in items:
        if item.id in seen:
            skipped += 1
            continue
        # 한 요청 안에 같은 id가 두 번 들어온 경우도 막는다.
        seen.add(item.id)

        # 카드를 찾는다. card_id를 안 보낸 클라이언트(앱)는 아직 단어 단위로
        # 채점하므로 recognition 카드로 본다 — 동기화 전환 전까지의 다리다.
        card_id = item.card_id or card_id_for(item.word_id, "recognition")
        card = session.get(CardModel, (card_id, user_id))
        if card is None or card.is_deleted:
            missing += 1
            continue

        # 빈칸 카드에는 단어가 없다. 단어 카드일 때만 단어를 확인한다.
        word = (
            session.get(WordModel, (card.word_id, user_id))
            if card.word_id is not None
            else None
        )
        if card.word_id is not None and (word is None or word.is_deleted):
            missing += 1
            continue

        # 2. 카드의 srs_* 컬럼을 Sm2State로 묶어 계산한다
        result = grade(
            Sm2State(
                ease_factor=card.srs_ease_factor,
                interval_days=card.srs_interval_days,
                repetitions=card.srs_repetitions,
                lapses=card.srs_lapses,
                due_at=card.srs_due_at,
                last_reviewed_at=card.srs_last_reviewed_at,
                learning_step=card.srs_learning_step,
            ),
            item.grade,
            now,
            config,
        )

        # 3. 결과를 카드에 되쓴다
        card.srs_ease_factor = result.state.ease_factor
        card.srs_interval_days = result.state.interval_days
        card.srs_repetitions = result.state.repetitions
        card.srs_lapses = result.state.lapses
        card.srs_due_at = result.state.due_at
        card.srs_last_reviewed_at = result.state.last_reviewed_at
        card.srs_learning_step = result.state.learning_step
        card.updated_at = now

        # 앱은 아직 단어 단위로 동기화한다. recognition 카드의 결과를 단어에도
        # 복사해 두 경로가 같은 값을 보게 한다. 앱이 카드로 넘어오면 지운다.
        if card.kind == "recognition" and word is not None:
            word.srs_ease_factor = result.state.ease_factor
            word.srs_interval_days = result.state.interval_days
            word.srs_repetitions = result.state.repetitions
            word.srs_lapses = result.state.lapses
            word.srs_due_at = result.state.due_at
            word.srs_last_reviewed_at = result.state.last_reviewed_at
            word.srs_learning_step = result.state.learning_step
            word.memorization_status = result.memorization_status
            word.updated_at = now
            _new_change(session, user_id, "word", word.id)

        session.add(
            ReviewLogModel(
                id=item.id,
                user_id=user_id,
                # 빈칸 카드는 단어가 없다 — 기록에는 출처 id를 남긴다.
                word_id=card.word_id or card.note_id or card.id,
                card_id=card.id,
                grade=item.grade,
                reviewed_at=item.reviewed_at,
                created_at=now,
            )
        )
        applied += 1

    return applied, skipped, missing
