from datetime import date, datetime

from sqlalchemy import Date, DateTime, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column

from ..core.database import Base


# ==================== ✨ UserProgressModel ✨ ==================== #
# 유저별 현재 상태를 보여주는 모델 
# 유저 1명당 하나의 상태(row)를 가진다. 
#   - user_id (PK) : 유저 식별자 
#   - churu_balance : 츄르 잔액 
#   - capelin_balance : 열빙어 잔액 (복습 퀘스트 전용 재화)
#   - streak_count : 연속 학습일 수 
#   - last_active_date : 마지막 활동일 
#   - daily_review_goal : 하루 복습 목표 개수 
#   - morning_review_count : 아침 복습 횟수
#   - evening_review_count : 저녁 복습 횟수
# ================================================================= #

class UserProgressModel(Base):
    
    __tablename__ = "user_progress"

    user_id: Mapped[str] = mapped_column(String(128), primary_key=True)
    churu_balance: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    # 열빙어 — 츄르와 달리 "실제 학습 행동"에만 나오는 희소 재화(PLANS.md §1-4).
    # 잔액을 따로 들고 있어야 소비처를 재화별로 갈라 막을 수 있다.
    capelin_balance: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    streak_count: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    last_active_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    daily_review_goal: Mapped[int | None] = mapped_column(Integer, nullable=True)
    
    morning_review_count: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    evening_review_count: Mapped[int] = mapped_column(Integer, default=0, server_default="0")

    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )


# ==================== ✨ QuestStateModel ✨ ==================== #
# 퀘스트별 "현재 상태" — 유저 1명 × 퀘스트 1개당 딱 1 row만 존재(UPSERT).
# 이 유저가 퀘스트를 마지막으로 언제 완료했는지 기억하는 모델이다.
#   - user_id (PK) : 유저 식별자
#   - quest_id (PK) : 퀘스트 식별자 (예: pet_cat)
#   - last_completed_date : 마지막으로 완료한 날짜 — "오늘 이미 했나" 판정 기준
#   - updated_at : 마지막 갱신 시각
# (user_id, quest_id) 복합 PK 자체가 "이 조합은 하나만 존재" 규칙을 강제하므로
# 별도 unique 제약이 필요 없다 — 완료 시 INSERT가 아니라 UPSERT로 처리.
# ================================================================= #

class QuestStateModel(Base):
    __tablename__ = "quest_states"

    user_id: Mapped[str] = mapped_column(String(128), primary_key=True)
    quest_id: Mapped[str] = mapped_column(String(50), primary_key=True)
    last_completed_date: Mapped[date] = mapped_column(Date, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )
