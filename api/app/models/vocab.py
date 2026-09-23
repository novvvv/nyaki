from datetime import datetime

from sqlalchemy import Boolean, DateTime, Float, Index, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.types import JSON

from ..core.database import Base


class WordBookModel(Base):
    __tablename__ = "word_books"
    __table_args__ = (
        Index("ix_word_books_user_updated", "user_id", "updated_at"),
    )

    id: Mapped[str] = mapped_column(String(80), primary_key=True)
    user_id: Mapped[str] = mapped_column(String(128), primary_key=True)
    # 이 단어장이 만드는 카드 종류. "recognition" 또는 "recognition,recall".
    # null이면 recognition 하나(= 지금까지의 동작).
    #
    # 안키는 노트 타입에 카드 템플릿을 매달지만, 개인 단어장에서 템플릿 편집기까지
    # 두는 건 과하다. 종류를 고정 enum으로 두고 단어장이 고른다.
    card_kinds: Mapped[str | None] = mapped_column(String(120), nullable=True)
    title: Mapped[str] = mapped_column(String(200))
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")


# ==================== ✨ Word Model Entity ✨ ==================== #

class WordModel(Base):
    __tablename__ = "words"
    __table_args__ = (
        Index("ix_words_user_updated", "user_id", "updated_at"),
        Index("ix_words_book", "user_id", "word_book_id"),
        Index("ix_words_user_bookmarked", "user_id", "is_bookmarked"),
        Index("ix_words_user_due", "user_id", "srs_due_at"),
    )

    # =============================== 필수 필드 =============================== #
    id: Mapped[str] = mapped_column(String(80), primary_key=True)
    user_id: Mapped[str] = mapped_column(String(128), primary_key=True)
    word_book_id: Mapped[str] = mapped_column(String(80))
    term: Mapped[str] = mapped_column(String(500))
    meaning: Mapped[str] = mapped_column(Text)


    pronunciation: Mapped[str | None] = mapped_column(String(500), nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    example: Mapped[str | None] = mapped_column(Text, nullable=True)
    example_meaning: Mapped[str | None] = mapped_column(Text, nullable=True)
    image_path: Mapped[str | None] = mapped_column(Text, nullable=True)
    memorization_status: Mapped[str] = mapped_column(String(20), default="unmemorized")
    is_bookmarked: Mapped[bool] = mapped_column(
        Boolean, default=False, server_default="false"
    )
    tags: Mapped[list] = mapped_column(
        JSON().with_variant(JSONB, "postgresql"),
        default=list,
        server_default="[]",
    )

    # =============================== ✨ SM2 Logic Field ✨ =============================== #
    # srs_ease_factor : 단어의 쉬움 계수로 높을수록 다음 복습의 간격이 크게 들어난다. Again(모름) 눌면 -0.2?(최소 1.3) 외움은 변화 x? 외지
    # srs_interval_days : 마지막 복습 후 다음 복습까지의 일수
    # srs_repetitions : 연속으로 정답을 맞춘 횟수. Again을 한 번이라도 누르면 0으로 리셋된다.
    # srs_lapses : (모름)을 누른 누적 총 횟수로 srs_repetitions와 달리 리셋되지 않고 계속 쌓인다. "단어를 몇 번 까먹었는가"
    #   - 현재는 사용되지 않는 지표이며ㅕ, 추후에 알고리즘 튜닝 용도로 작성
    # srs_due_at : 다음 복습이 에정된 시간 (UTC), 해당 값을 기준으로 "오늘 복습할 단어 목록"을 조회한다.
    # srs_last_reviewd_at : 마지막으로 복습한 시각. (한 번도 복습하지 않은 신규 단어는 null)
    # ===================================================================================== #
    # ===================================================================================== #
    srs_ease_factor: Mapped[float] = mapped_column(
        Float, default=2.5, server_default="2.5"
    )
    srs_interval_days: Mapped[int] = mapped_column(
        Integer, default=0, server_default="0"
    )
    srs_repetitions: Mapped[int] = mapped_column(
        Integer, default=0, server_default="0"
    )
    srs_lapses: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    srs_due_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    srs_last_reviewed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    # 지금 몇 번째 학습 단계인지. None이면 학습 단계가 아니다(새 카드이거나 복습 카드).
    # 안키의 learning/relearning에 해당한다 — 단계를 안 쓰면 계속 None이다.
    srs_learning_step: Mapped[int | None] = mapped_column(Integer, nullable=True)
    # ===================================================================================== #

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")


# ==================== ✨ Review Log Model Entity ✨ ==================== #

# ==================== ✨ Card Model Entity ✨ ==================== #

class CardModel(Base):
    """단어 하나에서 나오는 출제 카드. 안키의 Card에 해당한다.

    **SRS 상태가 단어가 아니라 여기에 붙는다.** 같은 단어라도 "単語 → 뜻"은
    20일 간격인데 "뜻 → 単語"는 3일 간격일 수 있다. 방향마다 익는 속도가 다르다.

    id는 `{word_id}:{kind}`로 만든다 — 클라이언트도 서버도 같은 값을 계산할 수
    있어야 카드를 새로 만들 때 조율이 필요 없다. 마이그레이션도 이 규칙으로
    기존 단어의 카드를 채운다.
    """

    __tablename__ = "cards"
    __table_args__ = (
        Index("ix_cards_user_due", "user_id", "srs_due_at"),
        Index("ix_cards_user_word", "user_id", "word_id"),
        Index("ix_cards_user_updated", "user_id", "updated_at"),
    )

    id: Mapped[str] = mapped_column(String(120), primary_key=True)
    user_id: Mapped[str] = mapped_column(String(128), primary_key=True)

    # 카드는 단어에서 나오기도 하고 빈칸 노트에서 나오기도 한다.
    # source_type이 둘 중 무엇인지 말하고, 그에 맞는 컬럼만 채워진다.
    source_type: Mapped[str] = mapped_column(
        String(16), default="word", server_default="word"
    )
    word_id: Mapped[str | None] = mapped_column(String(80), nullable=True)
    note_id: Mapped[str | None] = mapped_column(String(80), nullable=True)

    # 단어 카드는 recognition(단어→뜻) · recall(뜻→단어),
    # 빈칸 노트 카드는 c1 · c2 … (빈칸 번호)
    kind: Mapped[str] = mapped_column(String(32))

    srs_ease_factor: Mapped[float] = mapped_column(
        Float, default=2.5, server_default="2.5"
    )
    srs_interval_days: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    srs_repetitions: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    srs_lapses: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    srs_due_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    srs_last_reviewed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    srs_learning_step: Mapped[int | None] = mapped_column(Integer, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")


# ==================== ✨ ClozeNote Model Entity ✨ ==================== #

class ClozeNoteModel(Base):
    """빈칸 노트 — 안키의 Cloze 노트 타입.

    단어의 파생물이 **아니다.** 문장 한 덩이에 빈칸을 여럿 찍어 카드를 여러 장
    만든다. 단어 암기뿐 아니라 정의·조문·개념을 외우는 데 쓴다.

        「TCP는 {{c1::연결 지향}}, UDP는 {{c2::비연결}} 프로토콜이다」
          → c1 카드, c2 카드

    문법은 안키와 같은 `{{cN::답}}`이다. 안키를 쓰던 사람이 그대로 붙여넣을 수 있고
    파서도 정규식 하나면 된다.
    """

    __tablename__ = "cloze_notes"
    __table_args__ = (
        Index("ix_cloze_notes_user_updated", "user_id", "updated_at"),
        Index("ix_cloze_notes_book", "user_id", "word_book_id"),
    )

    id: Mapped[str] = mapped_column(String(80), primary_key=True)
    user_id: Mapped[str] = mapped_column(String(128), primary_key=True)
    word_book_id: Mapped[str] = mapped_column(String(80))
    text: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")


class ReviewLogModel(Base):
    """채점 한 번의 기록. Anki의 revlog에 해당한다.

    두 가지 일을 한다.

    1. **중복 방지.** id를 클라이언트가 만들어 보내고 그걸 PK로 쓴다. 네트워크가
       끊겨 같은 채점을 다시 보내도 INSERT가 여기서 막힌다. 애플리케이션 로직이
       아니라 DB가 막는다는 게 중요하다 — good이 두 번 반영되면 repetitions가
       2 올라가고 복습 간격이 실제보다 훨씬 길어진다.
    2. **통계 원본.** 오늘 복습한 개수, 학습 단계별 분포 같은 건 단어의 현재 상태만
       봐서는 못 만든다. 언제 무엇을 어떻게 채점했는지가 남아야 한다.
    """

    __tablename__ = "review_logs"
    __table_args__ = (
        Index("ix_review_logs_user_created", "user_id", "created_at"),
        Index("ix_review_logs_user_word", "user_id", "word_id"),
    )

    # 클라이언트가 만든 id. 중복 전송이 PK 충돌로 막히는 지점이다.
    id: Mapped[str] = mapped_column(String(80), primary_key=True)
    user_id: Mapped[str] = mapped_column(String(128), primary_key=True)
    word_id: Mapped[str] = mapped_column(String(80))
    # 어느 카드를 채점했는지. 카드 도입 전 기록은 recognition으로 채웠다.
    card_id: Mapped[str | None] = mapped_column(String(120), nullable=True)

    grade: Mapped[str] = mapped_column(String(16))

    # reviewed_at : 클라이언트가 채점했다고 주장하는 시각. 기록용이다.
    # created_at  : 서버가 받은 시각. **SM-2 계산은 이쪽을 쓴다** — 기기 시계를
    #               미래로 돌려 복습 간격을 늘리는 걸 막기 위해서다.
    reviewed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
