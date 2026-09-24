from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator


class WordBookPayload(BaseModel):
    id: str = Field(min_length=1, max_length=80)
    title: str = Field(min_length=1, max_length=200)
    # 이 단어장이 만드는 카드 종류. "recognition" 또는 "recognition,recall".
    # 없으면 recognition 하나(= 카드 도입 전과 같은 동작).
    card_kinds: str | None = Field(default=None, max_length=120)
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


class WordBookSummaryResponse(BaseModel):
    """단어장 한 개의 집계. 화면에 뜨는 숫자는 서버가 센다.

    항목(item)은 단어와 빈칸 노트를 합친 수다 — 사용자에게는 둘 다 "외울 거리
    하나"이고, 어디에 저장되는지는 알 바가 아니다.
    """

    word_book_id: str
    item_count: int
    card_count: int
    mastery_rate: int


class DailyAddedResponse(BaseModel):
    """하루치 추가 개수. 단어와 빈칸 노트를 합친 수다.

    개수가 0인 날은 아예 오지 않는다 — 빈 날짜를 메우는 일은 "오늘"이 며칠인지
    아는 클라이언트가 한다.
    """

    date: str  # YYYY-MM-DD, 요청한 시차 기준
    count: int


class ClozeNotePayload(BaseModel):
    """빈칸 노트. 텍스트 한 덩이에 `{{cN::답}}`으로 빈칸을 찍는다."""

    id: str = Field(min_length=1, max_length=80)
    word_book_id: str = Field(min_length=1, max_length=80)
    text: str = Field(min_length=1)
    created_at: datetime
    updated_at: datetime
    is_deleted: bool = False


class ClozeNoteResponse(ClozeNotePayload):
    model_config = ConfigDict(from_attributes=True)


class CardPayload(BaseModel):
    """앱이 동기화로 올리는 카드. SRS 상태가 여기에 있다."""

    id: str = Field(min_length=1, max_length=120)
    source_type: Literal["word", "cloze"] = "word"
    word_id: str | None = Field(default=None, max_length=80)
    note_id: str | None = Field(default=None, max_length=80)
    # 단어 카드는 recognition·recall, 빈칸 카드는 c1·c2 …
    kind: str = Field(min_length=1, max_length=32)
    srs_ease_factor: float = 2.5
    srs_interval_days: int = 0
    srs_repetitions: int = 0
    srs_lapses: int = 0
    srs_due_at: datetime
    srs_last_reviewed_at: datetime | None = None
    srs_learning_step: int | None = None
    created_at: datetime
    updated_at: datetime
    is_deleted: bool = False


class CardResponse(CardPayload):
    model_config = ConfigDict(from_attributes=True)


class SyncMutation(BaseModel):
    entity_type: Literal["word_book", "word", "card", "cloze_note"]
    action: Literal["upsert", "delete"]
    word_book: WordBookPayload | None = None
    word: WordPayload | None = None
    card: CardPayload | None = None
    cloze_note: ClozeNotePayload | None = None


class SyncPushRequest(BaseModel):
    changes: list[SyncMutation] = Field(max_length=100)


class SyncPushResponse(BaseModel):
    cursor: int
    accepted: int


class SyncChange(BaseModel):
    cursor: int
    entity_type: Literal["word_book", "word", "card", "cloze_note"]
    word_book: WordBookResponse | None = None
    word: WordResponse | None = None
    card: CardResponse | None = None
    cloze_note: ClozeNoteResponse | None = None


class SyncPullResponse(BaseModel):
    cursor: int
    changes: list[SyncChange]


class GradePreviewResponse(BaseModel):
    """이 카드를 지금 채점하면 다음 복습까지 몇 초 남는지."""

    again_seconds: int
    good_seconds: int


class DueCardResponse(BaseModel):
    """출제할 카드 한 장. 화면에 필요한 단어 내용을 함께 싣는다.

    카드만 주면 클라이언트가 단어를 따로 조회해야 한다 — 세션 시작에 요청이
    두 번 들어가고, 그 사이 단어가 바뀌면 화면이 어긋난다.
    """

    id: str
    kind: str
    source_type: str = "word"
    # 이 카드가 속한 단어장. 빈칸 카드는 단어가 없어 클라이언트가 알아낼 방법이
    # 없다 — 단어장으로 거르려면 서버가 알려줘야 한다.
    word_book_id: str = ""
    # 단어 카드면 word가, 빈칸 카드면 cloze가 채워진다.
    word: WordResponse | None = None
    cloze: "ClozeFaceResponse | None" = None
    preview: GradePreviewResponse


class ClozeSegmentResponse(BaseModel):
    """문장 조각 하나. blank면 그 자리가 지금 묻는 빈칸이다."""

    text: str
    blank: bool = False
    hint: str | None = None


class ClozeFaceResponse(BaseModel):
    """빈칸 카드의 문장. 서버가 조각으로 쪼개 내려준다 —
    파싱을 웹·앱이 각자 구현하면 렌더가 갈린다.

    화면은 빈칸 자리를 가렸다가 **그 자리에서** 답으로 바꾼다. 그래서 문장을
    두 벌(front/back)로 주는 것만으로는 부족하고 자리 정보가 필요하다.
    """

    note_id: str
    front: str
    back: str
    segments: list[ClozeSegmentResponse] = []


class ReviewDueResponse(BaseModel):
    cards: list[DueCardResponse] = []
    # 아래 둘은 카드 도입 전 클라이언트를 위한 호환 필드다. 앱이 카드로 넘어오면 뺀다.
    words: list[WordResponse]
    previews: dict[str, GradePreviewResponse] = {}


class ReviewDueCountResponse(BaseModel):
    """복습 대상 개수. 단어를 실어 나르지 않으므로 상한이 없다.

    by_book에는 due가 1개 이상인 단어장만 들어간다. 화면에서 "0개"로 보여줄
    단어장은 클라이언트가 가진 단어장 목록과 맞춰 채운다.
    """

    total: int
    by_book: dict[str, int]


class ReviewGradeItem(BaseModel):
    # card_id는 선택이다 — 앱은 아직 단어 단위로 채점한다(recognition으로 본다).
    # 클라이언트가 만든 고유 id. 재전송을 걸러내는 열쇠라 필수다.
    id: str = Field(min_length=1, max_length=80)
    word_id: str = Field(min_length=1, max_length=80)
    card_id: str | None = Field(default=None, max_length=120)
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
