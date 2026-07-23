from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class WordBookPayload(BaseModel):
    id: str = Field(min_length=1, max_length=80)
    title: str = Field(min_length=1, max_length=200)
    description: str | None = None
    created_at: datetime
    updated_at: datetime
    is_deleted: bool = False


class WordPayload(BaseModel):
    id: str = Field(min_length=1, max_length=80)
    word_book_id: str = Field(min_length=1, max_length=80)
    term: str = Field(min_length=1, max_length=500)
    meaning: str = Field(min_length=1)
    pronunciation: str | None = None
    description: str | None = None
    example: str | None = None
    image_path: str | None = None
    memorization_status: Literal["unmemorized", "memorized"] = "unmemorized"
    is_bookmarked: bool = False
    tags: list[str] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime
    is_deleted: bool = False


class WordBookResponse(WordBookPayload):
    model_config = ConfigDict(from_attributes=True)


class WordResponse(WordPayload):
    model_config = ConfigDict(from_attributes=True)


class SyncMutation(BaseModel):
    entity_type: Literal["word_book", "word"]
    action: Literal["upsert", "delete"]
    word_book: WordBookPayload | None = None
    word: WordPayload | None = None


class SyncPushRequest(BaseModel):
    changes: list[SyncMutation] = Field(max_length=100)


class SyncPushResponse(BaseModel):
    cursor: int
    accepted: int


class SyncChange(BaseModel):
    cursor: int
    entity_type: Literal["word_book", "word"]
    word_book: WordBookResponse | None = None
    word: WordResponse | None = None


class SyncPullResponse(BaseModel):
    cursor: int
    changes: list[SyncChange]
