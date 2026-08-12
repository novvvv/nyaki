from datetime import datetime

from sqlalchemy import Boolean, DateTime, Index, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from .database import Base

# ==================== 📃 Note ======================= #
# nyaki-web(블로그) 콘텐츠 전용 테이블. Word/WordBook과는 완전히 별도.
# 로그인 사용자별 데이터가 아니라 사이트 전체가 공유하는 콘텐츠라 user_id 없음.
# ==================================================== #


class ArtistModel(Base):
    __tablename__ = "artists"

    slug: Mapped[str] = mapped_column(String(120), primary_key=True)
    name: Mapped[str] = mapped_column(String(200))
    description: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")


class SongModel(Base):
    __tablename__ = "songs"
    __table_args__ = (
        Index("ix_songs_artist_slug", "artist_slug"),
        Index("ix_songs_posted_at", "posted_at"),
    )

    slug: Mapped[str] = mapped_column(String(120), primary_key=True)
    artist_slug: Mapped[str] = mapped_column(String(120))
    title: Mapped[str] = mapped_column(String(300))
    body: Mapped[str] = mapped_column(Text)
    posted_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
