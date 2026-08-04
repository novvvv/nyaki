from datetime import datetime
from sqlalchemy import Boolean, DateTime, Float, Index, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.types import JSON
from .database import Base


# ==================== 📃 Note ======================= #
# SQLAlchemy 2.0 Style ORM Entity 
# default vs server_default 
# default : Java의 초기값 느낌. 엔터티를 만드는 순간부터, INSERT에 실어서 보낸다. 
# server_default : @ColumnDefault - DB의 DDL에 새겨지는 값으로 native SQL 혹은 마이그레이션처럼 ORM을 안거치는 경우에 의미가 있다. 
# 따라서 server_default는 마이그레이션용도? 
# ==================================================== #


class WordBookModel(Base):
    __tablename__ = "word_books"
    __table_args__ = (
        Index("ix_word_books_user_updated", "user_id", "updated_at"),
    )

    id: Mapped[str] = mapped_column(String(80), primary_key=True)
    user_id: Mapped[str] = mapped_column(String(128), primary_key=True)
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
    # ===================================================================================== # 
    
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")


class SyncChangeModel(Base):
    __tablename__ = "sync_changes"
    __table_args__ = (
        Index("ix_sync_changes_user_cursor", "user_id", "cursor"),
    )

    cursor: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[str] = mapped_column(String(128), nullable=False)
    entity_type: Mapped[str] = mapped_column(String(20), nullable=False)
    entity_id: Mapped[str] = mapped_column(String(80), nullable=False)
    changed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
