from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import select
from dataclasses import asdict

from sqlalchemy.orm import Session

from ..core.auth import get_current_user_id
from ..core.database import get_session
from ..models import (
    CardModel,
    ClozeNoteModel,
    SyncChangeModel,
    WordBookModel,
    WordModel,
)
from .schemas import (
    CardResponse,
    DailyAddedResponse,
    ClozeFaceResponse,
    ClozeNotePayload,
    ClozeNoteResponse,
    ClozeSegmentResponse,
    DueCardResponse,
    GradePreviewResponse,
    ReviewDueCountResponse,
    ReviewDueResponse,
    ReviewGradesRequest,
    ReviewGradesResponse,
    SyncChange,
    SyncMutation,
    SyncPullResponse,
    SyncPushRequest,
    SyncPushResponse,
    WordBookPayload,
    WordBookResponse,
    WordBookSummaryResponse,
    WordPayload,
    WordResponse,
)
from .srs import Sm2State, preview
from .services import (
    apply_review_grades,
    daily_added_counts,
    delete_word,
    delete_word_book,
    book_summaries,
    count_due_cards,
    delete_card,
    delete_cloze_note,
    list_cloze_notes,
    cloze_segments,
    render_cloze,
    load_step_config,
    select_due_cards,
    upsert_card,
    upsert_cloze_note,
    utc_now,
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


# ====================================== #
# [web] ✨ word-book delete routing✨ #
# param 
#   - user_id : Firebase Login Token 
#   - Depends가 뜻하는게 뭐지. Depends(get_current_user_id?)
# Success -> Return HTTP_204_NO_CONTENT # 
# ====================================== #

@router.delete("/word-books/{word_book_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_word_book(
    word_book_id: str,
    session: Session = Depends(get_session),
    user_id: str = Depends(get_current_user_id),
) -> Response:
    # entity : 단어장 DB Raw 
    entity, _ = delete_word_book(session, user_id, word_book_id)
    # [Exception] 
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


@router.get("/word-books/summaries", response_model=list[WordBookSummaryResponse])
def get_word_book_summaries(
    session: Session = Depends(get_session),
    user_id: str = Depends(get_current_user_id),
) -> list[WordBookSummaryResponse]:
    """단어장별 항목 수·카드 수·암기율.

    클라이언트가 각자 세면 숫자가 갈린다 — 웹은 단어만 세어 빈칸 노트가 빠졌고,
    암기율은 단어의 srs_*를 읽어 빈칸 카드를 무시했다.
    """
    return [
        WordBookSummaryResponse(word_book_id=book_id, **summary)
        for book_id, summary in book_summaries(session, user_id).items()
    ]


@router.get("/stats/daily-added", response_model=list[DailyAddedResponse])
def get_daily_added(
    days: int | None = Query(default=None, ge=1, le=3650),
    tz_offset: int = Query(default=0, ge=-720, le=840),
    session: Session = Depends(get_session),
    user_id: str = Depends(get_current_user_id),
) -> list[DailyAddedResponse]:
    """날짜별 추가 개수. 단어와 빈칸 노트를 함께 센다.

    클라이언트가 항목을 전부 받아와서 세면 빈칸 노트의 문장까지 실어 나르게 된다 —
    차트에 필요한 것은 날짜와 개수뿐이다.

    tz_offset은 UTC 기준 분 단위 시차(KST면 540)다. 저장은 UTC지만 "며칠에
    추가했나"는 로컬 날짜라, 이 값이 없으면 자정 무렵 항목이 하루씩 어긋난다.
    """
    return [
        DailyAddedResponse(date=date, count=count)
        for date, count in daily_added_counts(session, user_id, days, tz_offset)
    ]


@router.get(
    "/word-books/{word_book_id}/cloze-notes",
    response_model=list[ClozeNoteResponse],
)
def get_cloze_notes(
    word_book_id: str,
    session: Session = Depends(get_session),
    user_id: str = Depends(get_current_user_id),
) -> list[ClozeNoteResponse]:
    _get_word_book(session, user_id, word_book_id)
    return [
        ClozeNoteResponse.model_validate(note)
        for note in list_cloze_notes(session, user_id, word_book_id)
    ]


@router.put(
    "/word-books/{word_book_id}/cloze-notes/{note_id}",
    response_model=ClozeNoteResponse,
)
def put_cloze_note(
    word_book_id: str,
    note_id: str,
    payload: ClozeNotePayload,
    session: Session = Depends(get_session),
    user_id: str = Depends(get_current_user_id),
) -> ClozeNoteResponse:
    if payload.id != note_id or payload.word_book_id != word_book_id:
        raise HTTPException(status_code=400, detail="URL과 payload의 ID가 다릅니다.")
    _get_word_book(session, user_id, word_book_id)
    entity, _ = upsert_cloze_note(session, user_id, payload)
    session.commit()
    session.refresh(entity)
    return ClozeNoteResponse.model_validate(entity)


@router.delete(
    "/word-books/{word_book_id}/cloze-notes/{note_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def remove_cloze_note(
    word_book_id: str,
    note_id: str,
    session: Session = Depends(get_session),
    user_id: str = Depends(get_current_user_id),
) -> Response:
    _get_word_book(session, user_id, word_book_id)
    entity, _ = delete_cloze_note(session, user_id, note_id)
    if entity is None:
        raise HTTPException(status_code=404, detail="빈칸 노트를 찾을 수 없습니다.")
    session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/review/due", response_model=ReviewDueResponse)
def get_review_due(
    limit: int = Query(default=50, ge=1, le=9999),
    session: Session = Depends(get_session),
    user_id: str = Depends(get_current_user_id),
) -> ReviewDueResponse:
    """오늘 낼 카드. 하루 한도가 이미 적용된 목록이다."""
    cards = select_due_cards(session, user_id, limit)
    config = load_step_config(session, user_id)
    now = utc_now()

    words = {
        word.id: word
        for word in session.scalars(
            select(WordModel).where(
                WordModel.user_id == user_id,
                WordModel.id.in_(
                    [card.word_id for card in cards if card.word_id is not None]
                ),
            )
        )
    }
    notes = {
        note.id: note
        for note in session.scalars(
            select(ClozeNoteModel).where(
                ClozeNoteModel.user_id == user_id,
                ClozeNoteModel.id.in_(
                    [card.note_id for card in cards if card.note_id is not None]
                ),
            )
        )
    }

    due_cards: list[DueCardResponse] = []
    previews: dict[str, GradePreviewResponse] = {}
    for card in cards:
        word = words.get(card.word_id) if card.word_id else None
        note = notes.get(card.note_id) if card.note_id else None
        if word is None and note is None:
            continue

        preview_value = GradePreviewResponse(
            **asdict(
                preview(
                    Sm2State(
                        ease_factor=card.srs_ease_factor,
                        interval_days=card.srs_interval_days,
                        repetitions=card.srs_repetitions,
                        lapses=card.srs_lapses,
                        due_at=card.srs_due_at,
                        last_reviewed_at=card.srs_last_reviewed_at,
                        learning_step=card.srs_learning_step,
                    ),
                    now,
                    config,
                )
            )
        )
        if note is not None:
            # 가리는 일은 서버가 한다 — 웹·앱이 각자 파싱하면 렌더가 갈린다.
            number = int(card.kind[1:]) if card.kind[1:].isdigit() else 1
            front, back = render_cloze(note.text, number)
            due_cards.append(
                DueCardResponse(
                    id=card.id,
                    kind=card.kind,
                    source_type="cloze",
                    word_book_id=note.word_book_id,
                    cloze=ClozeFaceResponse(
                        note_id=note.id,
                        front=front,
                        back=back,
                        segments=[
                            ClozeSegmentResponse(text=chunk, blank=is_blank, hint=hint)
                            for chunk, is_blank, hint in cloze_segments(
                                note.text, number
                            )
                        ],
                    ),
                    preview=preview_value,
                )
            )
            continue

        word_payload = WordResponse.model_validate(word)
        due_cards.append(
            DueCardResponse(
                id=card.id,
                kind=card.kind,
                source_type="word",
                word_book_id=word.word_book_id,
                word=word_payload,
                preview=preview_value,
            )
        )
        previews[word.id] = preview_value

    return ReviewDueResponse(
        cards=due_cards,
        # 호환 필드 — 카드 도입 전 클라이언트가 words/previews를 읽는다.
        words=[card.word for card in due_cards if card.word is not None],
        previews=previews,
    )


@router.get("/review/due/count", response_model=ReviewDueCountResponse)
def get_review_due_count(
    session: Session = Depends(get_session),
    user_id: str = Depends(get_current_user_id),
) -> ReviewDueCountResponse:
    """복습 대상 개수만 센다.

    /review/due는 한 번에 최대 200개라 개수를 세는 용도로 쓰면 201개부터 틀린다.
    이쪽은 COUNT라 상한이 필요 없다.
    """
    by_book = count_due_cards(session, user_id)
    return ReviewDueCountResponse(total=sum(by_book.values()), by_book=by_book)


@router.post("/review/grades", response_model=ReviewGradesResponse)
def post_review_grades(
    payload: ReviewGradesRequest,
    session: Session = Depends(get_session),
    user_id: str = Depends(get_current_user_id),
) -> ReviewGradesResponse:
    """세션 하나의 채점 결과를 한 번에 받는다.

    재전송해도 안전하다 — 이미 본 id는 skipped로 세고 넘어간다.
    """
    applied, skipped, missing = apply_review_grades(session, user_id, payload.grades)
    session.commit()
    return ReviewGradesResponse(applied=applied, skipped=skipped, missing=missing)


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

    if mutation.entity_type == "cloze_note":
        if mutation.cloze_note is None:
            raise HTTPException(status_code=400, detail="빈칸 노트 payload가 필요합니다.")
        if mutation.action == "delete":
            entity = session.get(
                ClozeNoteModel, {"id": mutation.cloze_note.id, "user_id": user_id}
            )
            if entity is None:
                payload = mutation.cloze_note.model_copy(update={"is_deleted": True})
                _, cursor = upsert_cloze_note(session, user_id, payload)
                return cursor
            _, cursor = delete_cloze_note(session, user_id, mutation.cloze_note.id)
            return cursor
        _, cursor = upsert_cloze_note(session, user_id, mutation.cloze_note)
        return cursor

    if mutation.entity_type == "card":
        if mutation.card is None:
            raise HTTPException(status_code=400, detail="카드 payload가 필요합니다.")
        if mutation.action == "delete":
            entity = session.get(CardModel, {"id": mutation.card.id, "user_id": user_id})
            if entity is None:
                payload = mutation.card.model_copy(update={"is_deleted": True})
                _, cursor = upsert_card(session, user_id, payload)
                return cursor
            _, cursor = delete_card(session, user_id, mutation.card.id)
            return cursor
        _, cursor = upsert_card(session, user_id, mutation.card)
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
        elif change.entity_type == "cloze_note":
            entity = session.get(
                ClozeNoteModel, {"id": change.entity_id, "user_id": user_id}
            )
            if entity is not None:
                result.append(
                    SyncChange(
                        cursor=change.cursor,
                        entity_type="cloze_note",
                        cloze_note=ClozeNoteResponse.model_validate(entity),
                    )
                )
        elif change.entity_type == "card":
            entity = session.get(CardModel, {"id": change.entity_id, "user_id": user_id})
            if entity is not None:
                result.append(
                    SyncChange(
                        cursor=change.cursor,
                        entity_type="card",
                        card=CardResponse.model_validate(entity),
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
