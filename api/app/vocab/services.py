from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..models import ReviewLogModel, SyncChangeModel, WordBookModel, WordModel
from .schemas import ReviewGradeItem, WordBookPayload, WordPayload
from .srs import Sm2State, grade


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
            ),
            item.grade,
            now,
        )

        # 3. 결과를 다시 컬럼으로 푼다
        word.srs_ease_factor = result.state.ease_factor
        word.srs_interval_days = result.state.interval_days
        word.srs_repetitions = result.state.repetitions
        word.srs_lapses = result.state.lapses
        word.srs_due_at = result.state.due_at
        word.srs_last_reviewed_at = result.state.last_reviewed_at
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
