from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy.orm import Session

from ..core.auth import (
    CurrentUser,
    get_current_user,
    get_current_user_id,
    get_optional_user_id,
    is_admin,
    require_admin_id,
)
from ..models import GuestbookEntryModel
from .schemas import (
    ArtistPayload,
    ArtistResponse,
    CaughtFishResponse,
    GuestbookEntryResponse,
    GuestbookPayload,
    FishPayload,
    FishResponse,
    PostPayload,
    PostResponse,
)
from .services import (
    GUESTBOOK_COOLDOWN_SECONDS,
    add_guestbook,
    delete_artist,
    delete_fish,
    delete_post,
    get_artist,
    get_fish,
    get_post,
    get_post_for_artist,
    last_guestbook_at,
    list_artists,
    list_caught_fish,
    list_fish,
    list_guestbook,
    list_posts,
    mark_caught,
    unmark_caught,
    upsert_artist,
    upsert_fish,
    upsert_post,
    utc_now,
)
from ..core.database import get_session

router = APIRouter(prefix="/v1/content", tags=["content"])


# ====================== 공개 조회 — 로그인 불필요 (블로그는 누구나 봄) ====================== #


@router.get("/artists", response_model=list[ArtistResponse])
def get_artists(session: Session = Depends(get_session)) -> list[ArtistResponse]:
    return list_artists(session)


@router.get("/artists/{artist_slug}", response_model=ArtistResponse)
def get_artist_detail(artist_slug: str, session: Session = Depends(get_session)) -> ArtistResponse:
    entity = get_artist(session, artist_slug)
    if entity is None:
        raise HTTPException(status_code=404, detail="아티스트를 찾을 수 없습니다.")
    return entity


@router.get("/posts", response_model=list[PostResponse])
def get_posts(
    artist_slug: str | None = None,
    kind: str | None = None,
    session: Session = Depends(get_session),
) -> list[PostResponse]:
    return list_posts(session, artist_slug, kind)


@router.get("/artists/{artist_slug}/posts/{post_slug}", response_model=PostResponse)
def get_artist_post_detail(
    artist_slug: str,
    post_slug: str,
    session: Session = Depends(get_session),
) -> PostResponse:
    entity = get_post_for_artist(session, artist_slug, post_slug)
    if entity is None:
        raise HTTPException(status_code=404, detail="글을 찾을 수 없습니다.")
    return entity


# 아티스트 없는 글(공지·메모) 전용 — slug만으로 조회
@router.get("/posts/{slug}", response_model=PostResponse)
def get_post_detail(slug: str, session: Session = Depends(get_session)) -> PostResponse:
    entity = get_post(session, slug)
    if entity is None:
        raise HTTPException(status_code=404, detail="글을 찾을 수 없습니다.")
    return entity


# ====================== 쓰기 — 관리자(본인)만 ====================== #


@router.put("/artists/{artist_slug}", response_model=ArtistResponse)
def put_artist(
    artist_slug: str,
    payload: ArtistPayload,
    session: Session = Depends(get_session),
    _admin_id: str = Depends(require_admin_id),
) -> ArtistResponse:
    if artist_slug != payload.slug:
        raise HTTPException(status_code=400, detail="URL과 payload slug가 일치하지 않습니다.")
    entity = upsert_artist(session, payload)
    session.commit()
    return entity


@router.delete("/artists/{artist_slug}", status_code=status.HTTP_204_NO_CONTENT)
def remove_artist(
    artist_slug: str,
    session: Session = Depends(get_session),
    _admin_id: str = Depends(require_admin_id),
) -> Response:
    entity = delete_artist(session, artist_slug)
    if entity is None:
        raise HTTPException(status_code=404, detail="아티스트를 찾을 수 없습니다.")
    session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.put("/artists/{artist_slug}/posts/{post_slug}", response_model=PostResponse)
def put_artist_post(
    artist_slug: str,
    post_slug: str,
    payload: PostPayload,
    session: Session = Depends(get_session),
    _admin_id: str = Depends(require_admin_id),
) -> PostResponse:
    if post_slug != payload.slug or artist_slug != payload.artist_slug:
        raise HTTPException(status_code=400, detail="URL과 payload가 일치하지 않습니다.")
    entity = upsert_post(session, payload)
    session.commit()
    return entity


@router.delete(
    "/artists/{artist_slug}/posts/{post_slug}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def remove_artist_post(
    artist_slug: str,
    post_slug: str,
    session: Session = Depends(get_session),
    _admin_id: str = Depends(require_admin_id),
) -> Response:
    entity = get_post_for_artist(session, artist_slug, post_slug)
    if entity is None:
        raise HTTPException(status_code=404, detail="글을 찾을 수 없습니다.")
    delete_post(session, post_slug)
    session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# 아티스트 없는 글(공지·메모) 전용 — slug만으로 쓰기/삭제
@router.put("/posts/{slug}", response_model=PostResponse)
def put_post(
    slug: str,
    payload: PostPayload,
    session: Session = Depends(get_session),
    _admin_id: str = Depends(require_admin_id),
) -> PostResponse:
    if slug != payload.slug:
        raise HTTPException(status_code=400, detail="URL과 payload slug가 일치하지 않습니다.")
    entity = upsert_post(session, payload)
    session.commit()
    return entity


@router.delete("/posts/{slug}", status_code=status.HTTP_204_NO_CONTENT)
def remove_post(
    slug: str,
    session: Session = Depends(get_session),
    _admin_id: str = Depends(require_admin_id),
) -> Response:
    entity = get_post(session, slug)
    if entity is None:
        raise HTTPException(status_code=404, detail="글을 찾을 수 없습니다.")
    delete_post(session, slug)
    session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# ====================== FF14 물고기(터주) — 조회는 공개, 쓰기는 관리자 ====================== #


@router.get("/fish", response_model=list[FishResponse])
def get_fish_list(
    zone_id: int | None = None,
    weather_id: int | None = None,
    q: str | None = None,
    session: Session = Depends(get_session),
) -> list[FishResponse]:
    return list_fish(session, zone_id, weather_id, q)


@router.get("/fish/{slug}", response_model=FishResponse)
def get_fish_detail(slug: str, session: Session = Depends(get_session)) -> FishResponse:
    entity = get_fish(session, slug)
    if entity is None:
        raise HTTPException(status_code=404, detail="물고기를 찾을 수 없습니다.")
    return entity


@router.put("/fish/{slug}", response_model=FishResponse)
def put_fish(
    slug: str,
    payload: FishPayload,
    session: Session = Depends(get_session),
    _admin_id: str = Depends(require_admin_id),
) -> FishResponse:
    if slug != payload.slug:
        raise HTTPException(status_code=400, detail="URL과 payload slug가 일치하지 않습니다.")
    entity = upsert_fish(session, payload)
    session.commit()
    return entity


@router.delete("/fish/{slug}", status_code=status.HTTP_204_NO_CONTENT)
def remove_fish(
    slug: str,
    session: Session = Depends(get_session),
    _admin_id: str = Depends(require_admin_id),
) -> Response:
    entity = delete_fish(session, slug)
    if entity is None:
        raise HTTPException(status_code=404, detail="물고기를 찾을 수 없습니다.")
    session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# ====================== 잡은 물고기 — 로그인한 본인 기록만 ====================== #


@router.get("/caught-fish", response_model=list[CaughtFishResponse])
def get_caught_fish(
    session: Session = Depends(get_session),
    user_id: str = Depends(get_current_user_id),
) -> list[CaughtFishResponse]:
    return list_caught_fish(session, user_id)


@router.put("/caught-fish/{slug}", response_model=CaughtFishResponse)
def put_caught_fish(
    slug: str,
    session: Session = Depends(get_session),
    user_id: str = Depends(get_current_user_id),
) -> CaughtFishResponse:
    if get_fish(session, slug) is None:
        raise HTTPException(status_code=404, detail="물고기를 찾을 수 없습니다.")
    entity = mark_caught(session, user_id, slug)
    session.commit()
    return entity


@router.delete("/caught-fish/{slug}", status_code=status.HTTP_204_NO_CONTENT)
def remove_caught_fish(
    slug: str,
    session: Session = Depends(get_session),
    user_id: str = Depends(get_current_user_id),
) -> Response:
    # 체크 안 된 걸 해제해도 204 — 화면에서 두 번 눌러도 오류가 나지 않게.
    unmark_caught(session, user_id, slug)
    session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# ====================== 방명록 — 읽기는 누구나, 쓰기는 로그인한 사용자 ====================== #


def _guestbook_response(entity: GuestbookEntryModel, viewer_id: str | None) -> GuestbookEntryResponse:
    return GuestbookEntryResponse(
        id=entity.id,
        author_name=entity.author_name,
        body=entity.body,
        created_at=entity.created_at,
        can_delete=viewer_id is not None and (entity.user_id == viewer_id or is_admin(viewer_id)),
    )


@router.get("/guestbook", response_model=list[GuestbookEntryResponse])
def get_guestbook(
    limit: int = Query(default=30, ge=1, le=100),
    before_id: int | None = Query(default=None, ge=1),
    session: Session = Depends(get_session),
    viewer_id: str | None = Depends(get_optional_user_id),
) -> list[GuestbookEntryResponse]:
    return [_guestbook_response(e, viewer_id) for e in list_guestbook(session, limit, before_id)]


@router.post("/guestbook", response_model=GuestbookEntryResponse, status_code=status.HTTP_201_CREATED)
def post_guestbook(
    payload: GuestbookPayload,
    session: Session = Depends(get_session),
    user: CurrentUser = Depends(get_current_user),
) -> GuestbookEntryResponse:
    last = last_guestbook_at(session, user.uid)
    if last is not None:
        if last.tzinfo is None:  # SQLite는 시간대를 떼고 돌려준다
            last = last.replace(tzinfo=utc_now().tzinfo)
        if (utc_now() - last).total_seconds() < GUESTBOOK_COOLDOWN_SECONDS:
            raise HTTPException(status_code=429, detail="잠시 뒤에 다시 남겨 주세요.")
    entity = add_guestbook(session, user.uid, (user.name or "익명")[:60], payload.body)
    session.commit()
    return _guestbook_response(entity, user.uid)


@router.delete("/guestbook/{entry_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_guestbook(
    entry_id: int,
    session: Session = Depends(get_session),
    user_id: str = Depends(get_current_user_id),
) -> Response:
    entity = session.get(GuestbookEntryModel, entry_id)
    if entity is None:
        raise HTTPException(status_code=404, detail="글을 찾을 수 없습니다.")
    if entity.user_id != user_id and not is_admin(user_id):
        raise HTTPException(status_code=403, detail="본인 글만 지울 수 있습니다.")
    session.delete(entity)
    session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
