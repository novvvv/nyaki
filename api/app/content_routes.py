from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

from .auth import require_admin_id
from .content_schemas import ArtistPayload, ArtistResponse, SongPayload, SongResponse
from .content_services import (
    delete_artist,
    delete_song,
    get_artist,
    get_song,
    list_artists,
    list_songs,
    upsert_artist,
    upsert_song,
)
from .database import get_session

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


@router.get("/songs", response_model=list[SongResponse])
def get_songs(
    artist_slug: str | None = None,
    session: Session = Depends(get_session),
) -> list[SongResponse]:
    return list_songs(session, artist_slug)


@router.get("/artists/{artist_slug}/songs/{song_slug}", response_model=SongResponse)
def get_song_detail(
    artist_slug: str,
    song_slug: str,
    session: Session = Depends(get_session),
) -> SongResponse:
    entity = get_song(session, artist_slug, song_slug)
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


@router.put("/artists/{artist_slug}/songs/{song_slug}", response_model=SongResponse)
def put_song(
    artist_slug: str,
    song_slug: str,
    payload: SongPayload,
    session: Session = Depends(get_session),
    _admin_id: str = Depends(require_admin_id),
) -> SongResponse:
    if song_slug != payload.slug or artist_slug != payload.artist_slug:
        raise HTTPException(status_code=400, detail="URL과 payload가 일치하지 않습니다.")
    entity = upsert_song(session, payload)
    session.commit()
    return entity


@router.delete(
    "/artists/{artist_slug}/songs/{song_slug}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def remove_song(
    artist_slug: str,
    song_slug: str,
    session: Session = Depends(get_session),
    _admin_id: str = Depends(require_admin_id),
) -> Response:
    entity = get_song(session, artist_slug, song_slug)
    if entity is None:
        raise HTTPException(status_code=404, detail="글을 찾을 수 없습니다.")
    delete_song(session, song_slug)
    session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
