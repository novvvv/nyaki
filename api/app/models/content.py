from datetime import datetime

from sqlalchemy import JSON, Boolean, DateTime, Float, Index, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from ..core.database import Base

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


class PostModel(Base):
    __tablename__ = "posts"
    __table_args__ = (
        Index("ix_posts_artist_slug", "artist_slug"),
        Index("ix_posts_posted_at", "posted_at"),
    )

    slug: Mapped[str] = mapped_column(String(120), primary_key=True)
    # "song"만 artist_slug를 가짐. "notice"/"note"는 artist_slug가 None — ArtistModel과 무관.
    kind: Mapped[str] = mapped_column(String(20), default="song", server_default="song")
    artist_slug: Mapped[str | None] = mapped_column(String(120), nullable=True)
    title: Mapped[str] = mapped_column(String(300))
    body: Mapped[str] = mapped_column(Text)
    posted_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")


# words.tags와 같은 방식 — 운영(Postgres)은 JSONB, 테스트(SQLite)는 JSON.
_JSON_LIST = JSON().with_variant(JSONB, "postgresql")


class FishModel(Base):
    """FF14 낚시 물고기(터주 등) 한 마리 = 한 행.

    날씨·시간 조건을 구조화해 두는 이유: 웹이 이 조건과 에오르제아 날씨 공식으로
    "다음 출현 시각"을 계산하고, 나중에 검색·알림 기능이 같은 필드를 그대로 쓴다.
    zone_id·날씨 id는 게임 데이터(TerritoryType·Weather 시트) id — nyaki-web의
    src/lib/ff14/weather-data.json과 같은 체계라 웹에서 바로 매칭된다.
    """

    __tablename__ = "fish"
    __table_args__ = (Index("ix_fish_zone_id", "zone_id"),)

    slug: Mapped[str] = mapped_column(String(120), primary_key=True)
    # 게임 아이템 id (메테오 투구게 = 7903). 외부 DB(tar.to 등) 링크·아이콘 조회 키.
    item_id: Mapped[int] = mapped_column(Integer, unique=True)
    icon_id: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    name: Mapped[str] = mapped_column(String(200))
    name_en: Mapped[str] = mapped_column(String(200), default="", server_default="")
    name_ja: Mapped[str] = mapped_column(String(200), default="", server_default="")

    # 대표 낚시터(조건 있는 물고기는 조건이 걸린 곳). 날씨 계산은 이 지역 기준.
    zone_id: Mapped[int] = mapped_column(Integer)
    spot_name: Mapped[str] = mapped_column(String(200))
    # 낚이는 곳 전부 [{"zone_id": 135, "spot_name": "소금기둥 해변"}, …] — 대표 낚시터가 맨 앞.
    spots: Mapped[list[dict]] = mapped_column(_JSON_LIST, default=list, server_default="[]")
    # 낚시 종류 표기 그대로 ("바닷가", "민물", "모래", "구름바다" …)
    water: Mapped[str] = mapped_column(String(40), default="", server_default="")
    level: Mapped[int] = mapped_column(Integer)
    stars: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    is_legendary: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
    is_big_fish: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")

    # 출현 시간(에오르제아 시, 0~24). 둘 다 None이면 상시. 22→2처럼 자정을 넘길 수 있다.
    start_hour: Mapped[float | None] = mapped_column(Float, nullable=True)
    end_hour: Mapped[float | None] = mapped_column(Float, nullable=True)
    # 날씨 id 목록. 빈 목록이면 조건 없음.
    weathers: Mapped[list[int]] = mapped_column(_JSON_LIST, default=list, server_default="[]")
    previous_weathers: Mapped[list[int]] = mapped_column(
        _JSON_LIST, default=list, server_default="[]"
    )

    # 처음 쓰는 미끼 하나. 생미끼로 이어 낚는 중간 물고기는 mooches에 순서대로.
    bait: Mapped[str] = mapped_column(String(200), default="", server_default="")
    # [{"name": "구리붕어", "tug": "!", "hookset": "섬세한 낚아채기"}, …] — 단계마다 입질·챔질.
    mooches: Mapped[list[dict]] = mapped_column(_JSON_LIST, default=list, server_default="[]")
    # 이 물고기 자체를 낚을 때의 입질·챔질(마지막 단계).
    tug: Mapped[str] = mapped_column(String(5), default="", server_default="")
    hookset: Mapped[str] = mapped_column(String(50), default="", server_default="")
    # 관련 버프 ("물고기의 눈" …). 필수 조건이 아니다 — 물고기의 눈은 쓰면 시간 조건을
    # 무시하고 낚을 수 있다는 뜻(효월 이전 물고기). 공략 사이트의 버프 아이콘 그대로 옮긴다.
    buffs: Mapped[list[str]] = mapped_column(_JSON_LIST, default=list, server_default="[]")
    description: Mapped[str] = mapped_column(Text, default="", server_default="")
    note: Mapped[str] = mapped_column(Text, default="", server_default="")

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
