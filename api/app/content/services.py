from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..models import ArtistModel, FishModel, PostModel
from .schemas import ArtistPayload, FishPayload, PostPayload


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


def list_fish(
    session: Session,
    zone_id: int | None = None,
    weather_id: int | None = None,
    q: str | None = None,
) -> list[FishModel]:
    query = select(FishModel).where(FishModel.is_deleted.is_(False))
    if zone_id is not None:
        query = query.where(FishModel.zone_id == zone_id)
    if q:
        pattern = f"%{q}%"
        query = query.where(
            FishModel.name.ilike(pattern)
            | FishModel.name_en.ilike(pattern)
            | FishModel.name_ja.ilike(pattern)
            | FishModel.spot_name.ilike(pattern)
        )
    fish = list(session.scalars(query.order_by(FishModel.level.desc(), FishModel.name)))
    # weathers는 JSON 목록이라 DB(Postgres json/SQLite)마다 포함 검사 문법이 달라 여기서 거른다.
    # 날씨 조건이 없는(빈 목록) 물고기는 어떤 날씨에서든 나오므로 포함.
    if weather_id is not None:
        fish = [f for f in fish if not f.weathers or weather_id in f.weathers]
    return fish


def get_fish(session: Session, slug: str) -> FishModel | None:
    entity = session.get(FishModel, slug)
    if entity is None or entity.is_deleted:
        return None
    return entity


def upsert_fish(session: Session, payload: FishPayload) -> FishModel:
    entity = session.get(FishModel, payload.slug)
    if entity is None:
        entity = FishModel(**payload.model_dump())
        session.add(entity)
    else:
        for field, value in payload.model_dump().items():
            setattr(entity, field, value)
    session.flush()
    return entity


def delete_fish(session: Session, slug: str) -> FishModel | None:
    entity = get_fish(session, slug)
    if entity is None:
        return None
    entity.is_deleted = True
    entity.updated_at = utc_now()
    session.flush()
    return entity
