from datetime import datetime, time, timedelta, timezone

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..models import (
    CardModel,
    ReviewLogModel,
    SyncChangeModel,
    UserProgressModel,
    WordBookModel,
    WordModel,
)
from .schemas import ReviewGradeItem, WordBookPayload, WordPayload
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


def _is_newer(incoming: datetime, current: datetime) -> bool:
    return incoming.astimezone(timezone.utc) > current.astimezone(timezone.utc)


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

CARD_KINDS = ("recognition", "recall", "cloze")
DEFAULT_CARD_KINDS = ("recognition",)


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

    for kind in kinds:
        card = existing.get(kind)
        if card is None:
            session.add(
                CardModel(
                    id=card_id_for(word.id, kind),
                    user_id=user_id,
                    word_id=word.id,
                    kind=kind,
                    srs_due_at=word.srs_due_at,
                    created_at=word.created_at,
                    updated_at=word.updated_at,
                )
            )
        elif card.is_deleted:
            card.is_deleted = False
            card.updated_at = word.updated_at

    for kind, card in existing.items():
        if kind not in kinds and not card.is_deleted:
            card.is_deleted = True
            card.updated_at = word.updated_at

    session.flush()


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

DEFAULT_NEW_LIMIT = 10
# 복습은 한도를 두지 않는 것이 기본이다 — 밀린 복습을 안 하면 간격 반복이
# 성립하지 않는다. 한도는 "복습이 폭발했을 때 숨 쉴 구멍"으로만 쓴다.
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


def _due_base(user_id: str):
    """출제 대상 카드의 공통 조건. 단어가 지워졌으면 카드도 지워지므로 카드만 본다."""
    return (
        CardModel.user_id == user_id,
        CardModel.is_deleted.is_(False),
        CardModel.srs_due_at <= utc_now(),
    )


def _one_card_per_word(cards: list[CardModel]) -> list[CardModel]:
    """같은 단어의 형제 카드는 한 세션에 하나만 낸다.

    "単語 → 뜻"을 풀고 곧바로 "뜻 → 単語"가 나오면 답을 이미 봐서 채점이 무의미하다.
    안키의 bury siblings와 같은 목적이고, 여기서는 **이번 출제분에서 빼는** 것으로
    가볍게 처리한다. 밀려난 카드는 다음 세션에 나온다.
    """
    seen: set[str] = set()
    out: list[CardModel] = []
    for card in cards:
        if card.word_id in seen:
            continue
        seen.add(card.word_id)
        out.append(card)
    return out


def select_due_cards(
    session: Session, user_id: str, limit: int | None = None
) -> list[CardModel]:
    """오늘 낼 수 있는 카드. 하루 한도와 형제 카드 규칙을 적용한다.

    복습 카드를 먼저(오래 밀린 순), 남은 자리에 새 카드를 채운다.
    새 카드는 due(= created_at) 순이라 결과적으로 추가한 순서가 된다.
    """
    new_limit, review_limit = _daily_limits(session, user_id)
    new_used, review_used = _consumed_today(session, user_id)

    review_quota = max(0, review_limit - review_used)
    new_quota = max(0, new_limit - new_used)

    reviews: list[CardModel] = []
    if review_quota > 0:
        reviews = _one_card_per_word(
            list(
                session.scalars(
                    select(CardModel)
                    .where(*_due_base(user_id), CardModel.srs_last_reviewed_at.is_not(None))
                    .order_by(CardModel.srs_due_at.asc())
                    .limit(review_quota * 2)
                )
            )
        )[:review_quota]

    news: list[CardModel] = []
    if new_quota > 0:
        news = _one_card_per_word(
            list(
                session.scalars(
                    select(CardModel)
                    .where(*_due_base(user_id), CardModel.srs_last_reviewed_at.is_(None))
                    .order_by(CardModel.srs_due_at.asc(), CardModel.created_at.asc())
                    .limit(new_quota * 2)
                )
            )
        )[:new_quota]

    cards = reviews + news
    return cards[:limit] if limit is not None else cards


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
                WordModel.id.in_([card.word_id for card in cards]),
            )
        ).all()
    )

    counts: dict[str, int] = {}
    for card in cards:
        book_id = book_of.get(card.word_id)
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

        word = session.get(WordModel, (card.word_id, user_id))
        if word is None or word.is_deleted:
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
        if card.kind == "recognition":
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
                word_id=card.word_id,
                card_id=card.id,
                grade=item.grade,
                reviewed_at=item.reviewed_at,
                created_at=now,
            )
        )
        applied += 1

    return applied, skipped, missing
