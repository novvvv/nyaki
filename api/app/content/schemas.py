from datetime import datetime
from typing import Literal

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


class PostPayload(BaseModel):
    slug: str = Field(min_length=1, max_length=120)
    kind: Literal["song", "notice", "note"] = "song"
    # "song"만 artist_slug가 있음. notice/note는 None — ArtistModel과 무관.
    artist_slug: str | None = Field(default=None, min_length=1, max_length=120)
    title: str = Field(min_length=1, max_length=300)
    body: str = Field(min_length=1)
    posted_at: datetime
    created_at: datetime
    updated_at: datetime
    is_deleted: bool = False


class PostResponse(PostPayload):
    model_config = ConfigDict(from_attributes=True)
