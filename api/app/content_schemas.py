from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class ArtistPayload(BaseModel):
    slug: str = Field(min_length=1, max_length=120)
    name: str = Field(min_length=1, max_length=200)
    description: str = ""
    created_at: datetime
    updated_at: datetime
    is_deleted: bool = False


class ArtistResponse(ArtistPayload):
    model_config = ConfigDict(from_attributes=True)


class SongPayload(BaseModel):
    slug: str = Field(min_length=1, max_length=120)
    artist_slug: str = Field(min_length=1, max_length=120)
    title: str = Field(min_length=1, max_length=300)
    body: str = Field(min_length=1)
    posted_at: datetime
    created_at: datetime
    updated_at: datetime
    is_deleted: bool = False


class SongResponse(SongPayload):
    model_config = ConfigDict(from_attributes=True)
