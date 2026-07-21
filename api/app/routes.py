from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from .auth import get_current_user_id
from .database import get_session
from .models import SyncChangeModel, WordBookModel, WordModel
from .schemas import (
    SyncChange,
    SyncMutation,
    SyncPullResponse,
    SyncPushRequest,
    SyncPushResponse,
    WordBookPayload,
    WordBookResponse,
    WordPayload,
    WordResponse,
)
from .services import (
    delete_word,
    delete_word_book,
    list_word_books,
    list_words,
    upsert_word,
    upsert_word_book,
)

router = APIRouter(prefix="/v1", tags=["v1"])


def _get_word_book(session: Session, user_id: str, word_book_id: str) -> WordBookModel:
    entity = session.get(WordBookModel, {"id": word_book_id, "user_id": user_id})
    if entity is None or entity.is_deleted:
        raise HTTPException(status_code=404, detail="단어장을 찾을 수 없습니다.")
    return entity


def _get_word(session: Session, user_id: str, word_id: str) -> WordModel:
    entity = session.get(WordModel, {"id": word_id, "user_id": user_id})
    if entity is None or entity.is_deleted:
        raise HTTPException(status_code=404, detail="단어를 찾을 수 없습니다.")
    return entity


@router.get("/word-books", response_model=list[WordBookResponse])
def get_word_books(
    session: Session = Depends(get_session),
    user_id: str = Depends(get_current_user_id),
) -> list[WordBookModel]:
    return list_word_books(session, user_id)


@router.put("/word-books/{word_book_id}", response_model=WordBookResponse)
def put_word_book(
    word_book_id: str,
    payload: WordBookPayload,
    session: Session = Depends(get_session),
    user_id: str = Depends(get_current_user_id),
) -> WordBookModel:
    if word_book_id != payload.id:
        raise HTTPException(status_code=400, detail="URL과 payload ID가 일치하지 않습니다.")
    entity, _ = upsert_word_book(session, user_id, payload)
    session.commit()
    return entity


@router.delete("/word-books/{word_book_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_word_book(
    word_book_id: str,
    session: Session = Depends(get_session),
    user_id: str = Depends(get_current_user_id),
) -> Response:
    entity, _ = delete_word_book(session, user_id, word_book_id)
    if entity is None:
        raise HTTPException(status_code=404, detail="단어장을 찾을 수 없습니다.")
    session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/word-books/{word_book_id}/words", response_model=list[WordResponse])
def get_words(
    word_book_id: str,
    session: Session = Depends(get_session),
    user_id: str = Depends(get_current_user_id),
) -> list[WordModel]:
    _get_word_book(session, user_id, word_book_id)
    return list_words(session, user_id, word_book_id)


@router.put("/word-books/{word_book_id}/words/{word_id}", response_model=WordResponse)
def put_word(
    word_book_id: str,
    word_id: str,
    payload: WordPayload,
    session: Session = Depends(get_session),
    user_id: str = Depends(get_current_user_id),
) -> WordModel:
    if word_id != payload.id or word_book_id != payload.word_book_id:
        raise HTTPException(status_code=400, detail="URL과 payload ID가 일치하지 않습니다.")
    _get_word_book(session, user_id, word_book_id)
    entity, _ = upsert_word(session, user_id, payload)
    session.commit()
    return entity


@router.delete(
    "/word-books/{word_book_id}/words/{word_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def remove_word(
    word_book_id: str,
    word_id: str,
    session: Session = Depends(get_session),
    user_id: str = Depends(get_current_user_id),
) -> Response:
    entity = _get_word(session, user_id, word_id)
    if entity.word_book_id != word_book_id:
        raise HTTPException(status_code=404, detail="단어를 찾을 수 없습니다.")
    delete_word(session, user_id, word_id)
    session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


def _apply_mutation(session: Session, user_id: str, mutation: SyncMutation) -> int | None:
    if mutation.entity_type == "word_book":
        if mutation.action == "delete":
            if mutation.word_book is None:
                raise HTTPException(status_code=400, detail="삭제할 단어장 payload가 필요합니다.")
            entity = session.get(
                WordBookModel, {"id": mutation.word_book.id, "user_id": user_id}
            )
            if entity is None:
                payload = mutation.word_book.model_copy(update={"is_deleted": True})
                _, cursor = upsert_word_book(session, user_id, payload)
                return cursor
            _, cursor = delete_word_book(session, user_id, mutation.word_book.id)
            return cursor
        if mutation.word_book is None:
            raise HTTPException(status_code=400, detail="단어장 payload가 필요합니다.")
        _, cursor = upsert_word_book(session, user_id, mutation.word_book)
        return cursor

    if mutation.action == "delete":
        if mutation.word is None:
            raise HTTPException(status_code=400, detail="삭제할 단어 payload가 필요합니다.")
        entity = session.get(WordModel, {"id": mutation.word.id, "user_id": user_id})
        if entity is None:
            payload = mutation.word.model_copy(update={"is_deleted": True})
            _, cursor = upsert_word(session, user_id, payload)
            return cursor
        _, cursor = delete_word(session, user_id, mutation.word.id)
        return cursor
    if mutation.word is None:
        raise HTTPException(status_code=400, detail="단어 payload가 필요합니다.")
    _, cursor = upsert_word(session, user_id, mutation.word)
    return cursor


@router.post("/sync/push", response_model=SyncPushResponse)
def sync_push(
    request: SyncPushRequest,
    session: Session = Depends(get_session),
    user_id: str = Depends(get_current_user_id),
) -> SyncPushResponse:
    last_cursor = session.scalar(
        select(SyncChangeModel.cursor)
        .where(SyncChangeModel.user_id == user_id)
        .order_by(SyncChangeModel.cursor.desc())
        .limit(1)
    ) or 0
    accepted = 0
    for mutation in request.changes:
        cursor = _apply_mutation(session, user_id, mutation)
        if cursor is not None:
            accepted += 1
            last_cursor = cursor
    session.commit()
    return SyncPushResponse(cursor=last_cursor, accepted=accepted)


@router.get("/sync/pull", response_model=SyncPullResponse)
def sync_pull(
    cursor: int = 0,
    session: Session = Depends(get_session),
    user_id: str = Depends(get_current_user_id),
) -> SyncPullResponse:
    changes = list(
        session.scalars(
            select(SyncChangeModel)
            .where(SyncChangeModel.user_id == user_id, SyncChangeModel.cursor > cursor)
            .order_by(SyncChangeModel.cursor)
            .limit(500)
        )
    )
    result: list[SyncChange] = []
    for change in changes:
        if change.entity_type == "word_book":
            entity = session.get(
                WordBookModel, {"id": change.entity_id, "user_id": user_id}
            )
            if entity is not None:
                result.append(
                    SyncChange(
                        cursor=change.cursor,
                        entity_type="word_book",
                        word_book=WordBookResponse.model_validate(entity),
                    )
                )
        else:
            entity = session.get(WordModel, {"id": change.entity_id, "user_id": user_id})
            if entity is not None:
                result.append(
                    SyncChange(
                        cursor=change.cursor,
                        entity_type="word",
                        word=WordResponse.model_validate(entity),
                    )
                )

    next_cursor = changes[-1].cursor if changes else cursor
    return SyncPullResponse(cursor=next_cursor, changes=result)
