from datetime import datetime, time, timedelta, timezone

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..models import (
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


def load_step_config(session: Session, user_id: str) -> StepConfig:
    """저장된 복습 흐름 설정. 없으면 단계 없음(= 기존 동작)."""
    progress = session.get(UserProgressModel, user_id)
    if progress is None:
        return DEFAULT_STEPS
    return StepConfig(
        learning_steps=_parse_steps(progress.learning_steps),
        relearning_steps=_parse_steps(progress.relearning_steps),
        graduating_interval_days=progress.graduating_interval_days or 1,
    )


def _due_base(user_id: str):
    return (
        WordModel.user_id == user_id,
        WordModel.is_deleted.is_(False),
        WordModel.srs_due_at <= utc_now(),
    )


def select_due_words(session: Session, user_id: str, limit: int | None = None) -> list[WordModel]:
    """오늘 낼 수 있는 단어. 하루 한도를 적용한다.

    복습 카드를 먼저(오래 밀린 순), 남은 자리에 새 카드를 채운다.

    새 카드는 due(= created_at) 순이라 결과적으로 추가한 순서가 된다. 안키의
    Insertion order 기본값이 Sequential인 것과 같은 이유다 — 팩을 받으면 앞
    단원부터 나가야 한다.
    """
    new_limit, review_limit = _daily_limits(session, user_id)
    new_used, review_used = _consumed_today(session, user_id)

    review_quota = max(0, review_limit - review_used)
    new_quota = max(0, new_limit - new_used)

    reviews: list[WordModel] = []
    if review_quota > 0:
        reviews = list(
            session.scalars(
                select(WordModel)
                .where(*_due_base(user_id), WordModel.srs_last_reviewed_at.is_not(None))
                .order_by(WordModel.srs_due_at.asc())
                .limit(review_quota)
            )
        )

    news: list[WordModel] = []
    if new_quota > 0:
        news = list(
            session.scalars(
                select(WordModel)
                .where(*_due_base(user_id), WordModel.srs_last_reviewed_at.is_(None))
                .order_by(WordModel.srs_due_at.asc(), WordModel.created_at.asc())
                .limit(new_quota)
            )
        )

    words = reviews + news
    return words[:limit] if limit is not None else words


def list_due_words(session: Session, user_id: str, limit: int) -> list[WordModel]:
    return list(
        session.scalars(
            select(WordModel)
            .where(
                WordModel.user_id == user_id,
                WordModel.is_deleted.is_(False),
                WordModel.srs_due_at <= utc_now(),
            )
            .order_by(WordModel.srs_due_at.asc())
            .limit(limit)
        )
    )


def count_due_words(session: Session, user_id: str) -> dict[str, int]:
    """오늘 낼 수 있는 단어 수를 단어장별로 센다.

    select_due_words와 **같은 규칙**(하루 한도 적용)으로 세야 한다. 화면의 숫자와
    실제 출제량이 다르면 사용자는 어느 쪽도 믿지 않는다.

    단어 본문은 읽지 않고 (id, word_book_id) 두 칼럼만 읽는다.
    """
    new_limit, review_limit = _daily_limits(session, user_id)
    new_used, review_used = _consumed_today(session, user_id)

    counts: dict[str, int] = {}

    review_quota = max(0, review_limit - review_used)
    if review_quota > 0:
        rows = session.execute(
            select(WordModel.word_book_id)
            .where(*_due_base(user_id), WordModel.srs_last_reviewed_at.is_not(None))
            .order_by(WordModel.srs_due_at.asc())
            .limit(review_quota)
        )
        for (book_id,) in rows:
            counts[book_id] = counts.get(book_id, 0) + 1

    new_quota = max(0, new_limit - new_used)
    if new_quota > 0:
        rows = session.execute(
            select(WordModel.word_book_id)
            .where(*_due_base(user_id), WordModel.srs_last_reviewed_at.is_(None))
            .order_by(WordModel.srs_due_at.asc(), WordModel.created_at.asc())
            .limit(new_quota)
        )
        for (book_id,) in rows:
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

        word = session.get(WordModel, (item.word_id, user_id))
        if word is None or word.is_deleted:
            missing += 1
            continue

        # 2. 단어의 srs_* 컬럼을 Sm2State로 묶어 계산한다
        result = grade(
            Sm2State(
                ease_factor=word.srs_ease_factor,
                interval_days=word.srs_interval_days,
                repetitions=word.srs_repetitions,
                lapses=word.srs_lapses,
                due_at=word.srs_due_at,
                last_reviewed_at=word.srs_last_reviewed_at,
                learning_step=word.srs_learning_step,
            ),
            item.grade,
            now,
            config,
        )

        # 3. 결과를 다시 컬럼으로 푼다
        word.srs_ease_factor = result.state.ease_factor
        word.srs_interval_days = result.state.interval_days
        word.srs_repetitions = result.state.repetitions
        word.srs_lapses = result.state.lapses
        word.srs_due_at = result.state.due_at
        word.srs_last_reviewed_at = result.state.last_reviewed_at
        word.srs_learning_step = result.state.learning_step
        word.memorization_status = result.memorization_status
        word.updated_at = now

        # 앱이 pull로 이 변경을 받아가야 한다.
        _new_change(session, user_id, "word", word.id)

        session.add(
            ReviewLogModel(
                id=item.id,
                user_id=user_id,
                word_id=item.word_id,
                grade=item.grade,
                reviewed_at=item.reviewed_at,
                created_at=now,
            )
        )
        applied += 1

    return applied, skipped, missing
