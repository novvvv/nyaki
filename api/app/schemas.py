from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator


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
    srs_ease_factor: float = 2.5
    srs_interval_days: int = 0
    srs_repetitions: int = 0
    srs_lapses: int = 0
    srs_due_at: datetime | None = None
    srs_last_reviewed_at: datetime | None = None
    created_at: datetime
    updated_at: datetime
    is_deleted: bool = False

    @model_validator(mode="after")
    def _default_srs_due_at(self) -> "WordPayload":
        # 구버전 클라이언트가 srs_due_at 없이 보내면 즉시 due로 취급 (SRS-PLAN.md 마이그레이션 규칙과 동일)
        if self.srs_due_at is None:
            self.srs_due_at = self.created_at
        return self


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


class ReviewDueResponse(BaseModel):
    words: list[WordResponse]
