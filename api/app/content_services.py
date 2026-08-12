from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from .content_models import ArtistModel, SongModel
from .content_schemas import ArtistPayload, SongPayload


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def list_artists(session: Session) -> list[ArtistModel]:
    return list(
        session.scalars(
            select(ArtistModel)
            .where(ArtistModel.is_deleted.is_(False))
            .order_by(ArtistModel.name)
        )
    )


def get_artist(session: Session, slug: str) -> ArtistModel | None:
    entity = session.get(ArtistModel, slug)
    if entity is None or entity.is_deleted:
        return None
    return entity


def upsert_artist(session: Session, payload: ArtistPayload) -> ArtistModel:
    entity = session.get(ArtistModel, payload.slug)
    if entity is None:
        entity = ArtistModel(**payload.model_dump())
        session.add(entity)
    else:
        for field, value in payload.model_dump().items():
            setattr(entity, field, value)
    session.flush()
    return entity


def delete_artist(session: Session, slug: str) -> ArtistModel | None:
    entity = session.get(ArtistModel, slug)
    if entity is None or entity.is_deleted:
        return None
    entity.is_deleted = True
    entity.updated_at = utc_now()
    session.flush()
    return entity


def list_songs(session: Session, artist_slug: str | None = None) -> list[SongModel]:
    query = select(SongModel).where(SongModel.is_deleted.is_(False))
    if artist_slug is not None:
        query = query.where(SongModel.artist_slug == artist_slug)
    query = query.order_by(SongModel.posted_at.desc())
    return list(session.scalars(query))


def get_song(session: Session, artist_slug: str, slug: str) -> SongModel | None:
    entity = session.get(SongModel, slug)
    if entity is None or entity.is_deleted or entity.artist_slug != artist_slug:
        return None
    return entity


def upsert_song(session: Session, payload: SongPayload) -> SongModel:
    entity = session.get(SongModel, payload.slug)
    if entity is None:
        entity = SongModel(**payload.model_dump())
        session.add(entity)
    else:
        for field, value in payload.model_dump().items():
            setattr(entity, field, value)
    session.flush()
    return entity


def delete_song(session: Session, slug: str) -> SongModel | None:
    entity = session.get(SongModel, slug)
    if entity is None or entity.is_deleted:
        return None
    entity.is_deleted = True
    entity.updated_at = utc_now()
    session.flush()
    return entity
