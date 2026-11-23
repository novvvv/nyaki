"""카드 사진 — 유료 기능.

흐름: upload-url로 5분짜리 주소를 받아 브라우저가 R2에 바로 올리고, PUT photo로
단어에 붙인다. 막는 건 여기다 — 화면이 버튼을 숨기는 것만으로는 주소를 직접
부르는 걸 못 막는다.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..core.auth import get_current_user_id
from ..core.database import get_session
from ..core.photos import (
    MAX_PHOTO_BYTES,
    PHOTO_TYPES,
    get_photo_store,
    has_card_photos,
    new_photo_key,
    schedule_delete,
    word_prefix,
)
from ..models import WordModel
from .schemas import (
    FeaturesResponse,
    PhotoAttachRequest,
    PhotoUploadRequest,
    PhotoUploadResponse,
    WordResponse,
)

router = APIRouter(prefix="/v1", tags=["photos"])

PREMIUM_ONLY = "프리미엄에서 쓸 수 있는 기능이에요."


def _require_photos(user_id: str) -> None:
    if not has_card_photos(user_id):
        raise HTTPException(status_code=403, detail=PREMIUM_ONLY)


def _word(session: Session, user_id: str, word_id: str) -> WordModel:
    entity = session.get(WordModel, {"id": word_id, "user_id": user_id})
    if entity is None or entity.is_deleted:
        raise HTTPException(status_code=404, detail="단어를 찾을 수 없습니다.")
    return entity


@router.get("/me/features", response_model=FeaturesResponse)
def get_features(user_id: str = Depends(get_current_user_id)) -> FeaturesResponse:
    return FeaturesResponse(card_photos=has_card_photos(user_id))


@router.post("/words/{word_id}/photo/upload-url", response_model=PhotoUploadResponse)
def post_photo_upload_url(
    word_id: str,
    payload: PhotoUploadRequest,
    session: Session = Depends(get_session),
    user_id: str = Depends(get_current_user_id),
) -> PhotoUploadResponse:
    _require_photos(user_id)
    _word(session, user_id, word_id)
    store = get_photo_store()
    assert store is not None  # has_card_photos가 확인했다
    key = new_photo_key(user_id, word_id, payload.content_type)
    return PhotoUploadResponse(
        upload_url=store.presign_put(key, payload.content_type),
        key=key,
        content_type=payload.content_type,
    )


@router.put("/words/{word_id}/photo", response_model=WordResponse)
def put_photo(
    word_id: str,
    payload: PhotoAttachRequest,
    session: Session = Depends(get_session),
    user_id: str = Depends(get_current_user_id),
) -> WordModel:
    _require_photos(user_id)
    entity = _word(session, user_id, word_id)
    key = payload.key
    # 이 사용자 · 이 단어 앞으로 만든 키만 받는다 — 남의 사진을 붙여 보는 걸 막는다.
    if not key.startswith(word_prefix(user_id, word_id)) or key.rsplit(".", 1)[-1] not in set(
        PHOTO_TYPES.values()
    ):
        raise HTTPException(status_code=400, detail="올린 사진을 찾을 수 없어요.")
    store = get_photo_store()
    assert store is not None
    size = store.size(key)
    if size is None:
        raise HTTPException(status_code=400, detail="올린 사진을 찾을 수 없어요.")
    # 서명 주소는 크기를 못 막는다 — 올라온 뒤에 재고, 크면 지운다.
    if size > MAX_PHOTO_BYTES:
        store.delete(key)
        raise HTTPException(status_code=413, detail="사진이 너무 커요.")

    if entity.photo_key != key:
        schedule_delete(session, entity.photo_key)
        entity.photo_key = key
        # updated_at은 건드리지 않는다 — 클라이언트의 단어 수정과 "더 새 것" 비교가
        # 꼬이지 않게. 사진은 단어 내용과 따로 산다.
    session.commit()
    return entity


@router.delete("/words/{word_id}/photo", response_model=WordResponse)
def delete_photo(
    word_id: str,
    session: Session = Depends(get_session),
    user_id: str = Depends(get_current_user_id),
) -> WordModel:
    # 유료가 끝난 사람도 자기 사진은 뺄 수 있어야 한다 — 여기는 막지 않는다.
    entity = _word(session, user_id, word_id)
    if entity.photo_key:
        schedule_delete(session, entity.photo_key)
        entity.photo_key = None
        session.commit()
    return entity

