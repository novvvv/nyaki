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
    example_meaning: str | None = None
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
    srs_learning_step: int | None = None
    created_at: datetime
    updated_at: datetime
    is_deleted: bool = False

    @model_validator(mode="after")
    def _default_srs_due_at(self) -> "WordPayload":
        # 구버전 클라이언트가 srs_due_at 없이 보내면 즉시 due로 취급 (SRS-PLAN.md 마이그레이션 규칙과 동일)
        if self.srs_due_at is None:
            self.srs_due_at = self.created_at
            # 여기서 채운 값은 "클라이언트가 보낸 값"이 아니다. 대입만으로 set 취급되면
            # upsert의 exclude_unset이 이 값을 덮어써서, 단어를 수정할 때마다
            # 다음 복습일이 오늘로 당겨진다. 새로 만들 때는 model_dump() 전체를 쓰므로
            # 이 기본값이 그대로 들어간다.
            self.__pydantic_fields_set__.discard("srs_due_at")
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


class ReviewDueCountResponse(BaseModel):
    """복습 대상 개수. 단어를 실어 나르지 않으므로 상한이 없다.

    by_book에는 due가 1개 이상인 단어장만 들어간다. 화면에서 "0개"로 보여줄
    단어장은 클라이언트가 가진 단어장 목록과 맞춰 채운다.
    """

    total: int
    by_book: dict[str, int]


class ReviewGradeItem(BaseModel):
    # 클라이언트가 만든 고유 id. 재전송을 걸러내는 열쇠라 필수다.
    id: str = Field(min_length=1, max_length=80)
    word_id: str = Field(min_length=1, max_length=80)
    grade: Literal["again", "good"]
    # 채점했다고 클라이언트가 주장하는 시각. 기록만 하고 계산에는 쓰지 않는다 —
    # 기기 시계를 미래로 돌려 복습 간격을 늘리는 걸 막기 위해 서버 수신 시각을 쓴다.
    reviewed_at: datetime


class ReviewGradesRequest(BaseModel):
    # sync/push와 같은 상한. 한 세션이 이보다 길 일은 없다.
    grades: list[ReviewGradeItem] = Field(max_length=100)


class ReviewGradesResponse(BaseModel):
    applied: int
    # 이미 처리한 id라서 건너뛴 개수. 재전송이 정상 동작했다는 신호다.
    skipped: int
    # 단어를 못 찾아 버린 개수 (삭제됐거나 남의 단어).
    missing: int
