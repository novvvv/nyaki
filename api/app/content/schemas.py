from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator


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


Tug = Literal["", "!", "!!", "!!!"]


class MoochStep(BaseModel):
    """생미끼로 이어 낚는 중간 물고기 한 단계."""

    name: str = Field(min_length=1, max_length=200)
    tug: Tug = ""
    hookset: str = Field(default="", max_length=50)


class FishSpot(BaseModel):
    zone_id: int = Field(ge=1)
    spot_name: str = Field(min_length=1, max_length=200)


class Predator(BaseModel):
    """밑작 — 어부의 직감을 띄우려고 먼저 낚는 물고기."""

    slug: str = Field(default="", max_length=120)
    name: str = Field(min_length=1, max_length=200)
    count: int = Field(ge=1)


class FishPayload(BaseModel):
    slug: str = Field(min_length=1, max_length=120)
    item_id: int = Field(ge=1)
    icon_id: int = Field(default=0, ge=0)
    name: str = Field(min_length=1, max_length=200)
    name_en: str = Field(default="", max_length=200)
    name_ja: str = Field(default="", max_length=200)
    # zone_id·날씨 id는 게임 데이터 id (models/content.py FishModel 참고)
    zone_id: int = Field(ge=1)
    spot_name: str = Field(min_length=1, max_length=200)
    spots: list[FishSpot] = Field(default_factory=list)
    water: str = Field(default="", max_length=40)
    level: int = Field(ge=1, le=100)
    stars: int = Field(default=0, ge=0, le=5)
    is_legendary: bool = False
    is_big_fish: bool = False
    # 에오르제아 시(0~24). 둘 다 None이면 상시, 한쪽만 있는 건 허용하지 않음.
    start_hour: float | None = Field(default=None, ge=0, le=24)
    end_hour: float | None = Field(default=None, ge=0, le=24)
    weathers: list[int] = Field(default_factory=list)
    previous_weathers: list[int] = Field(default_factory=list)
    bait: str = Field(default="", max_length=200)
    mooches: list[MoochStep] = Field(default_factory=list)
    tug: Tug = ""
    hookset: str = Field(default="", max_length=50)
    predators: list[Predator] = Field(default_factory=list)
    intuition_seconds: int | None = Field(default=None, ge=0)
    buffs: list[str] = Field(default_factory=list)
    description: str = ""
    note: str = ""
    created_at: datetime
    updated_at: datetime
    is_deleted: bool = False

    @model_validator(mode="after")
    def _hours_together(self) -> "FishPayload":
        if (self.start_hour is None) != (self.end_hour is None):
            raise ValueError("start_hour와 end_hour는 함께 지정하거나 함께 비워야 합니다.")
        return self


class FishResponse(FishPayload):
    model_config = ConfigDict(from_attributes=True)


class CaughtFishResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    fish_slug: str
    caught_at: datetime
