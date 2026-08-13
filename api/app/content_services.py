from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from .content_models import ArtistModel, PostModel
from .content_schemas import ArtistPayload, PostPayload


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


def list_posts(
    session: Session,
    artist_slug: str | None = None,
    kind: str | None = None,
) -> list[PostModel]:
    query = select(PostModel).where(PostModel.is_deleted.is_(False))
    if artist_slug is not None:
        query = query.where(PostModel.artist_slug == artist_slug)
    if kind is not None:
        query = query.where(PostModel.kind == kind)
    query = query.order_by(PostModel.posted_at.desc())
    return list(session.scalars(query))


def get_post(session: Session, slug: str) -> PostModel | None:
    entity = session.get(PostModel, slug)
    if entity is None or entity.is_deleted:
        return None
    return entity


def get_post_for_artist(session: Session, artist_slug: str, slug: str) -> PostModel | None:
    entity = get_post(session, slug)
    if entity is None or entity.artist_slug != artist_slug:
        return None
    return entity


def upsert_post(session: Session, payload: PostPayload) -> PostModel:
    entity = session.get(PostModel, payload.slug)
    if entity is None:
        entity = PostModel(**payload.model_dump())
        session.add(entity)
    else:
        for field, value in payload.model_dump().items():
            setattr(entity, field, value)
    session.flush()
    return entity


def delete_post(session: Session, slug: str) -> PostModel | None:
    entity = session.get(PostModel, slug)
    if entity is None or entity.is_deleted:
        return None
    entity.is_deleted = True
    entity.updated_at = utc_now()
    session.flush()
    return entity
