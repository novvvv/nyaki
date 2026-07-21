from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from .models import SyncChangeModel, WordBookModel, WordModel
from .schemas import WordBookPayload, WordPayload


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
        for field, value in payload.model_dump().items():
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
        for field, value in payload.model_dump().items():
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
