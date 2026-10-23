from datetime import datetime

from sqlalchemy import DateTime, String
from sqlalchemy.orm import Mapped, mapped_column

from ..core.database import Base

# ==================== 📃 Note ======================= #
# nyaki-web 터주 페이지의 사용자별 기록. 물고기 자체(FishModel, content.py)는 사이트
# 공용 콘텐츠지만, "누가 무엇을 잡았나"는 로그인 사용자 데이터라 파일을 나눴다.
# 체크 해제는 행을 지운다 — 동기화할 기기가 없어서 tombstone(is_deleted)이 필요 없다.
# 회원 탈퇴 시 지워지도록 account/services.py USER_TABLES에 들어 있다.
# ==================================================== #


class CaughtFishModel(Base):
    __tablename__ = "caught_fish"

    user_id: Mapped[str] = mapped_column(String(128), primary_key=True)
    fish_slug: Mapped[str] = mapped_column(String(120), primary_key=True)
    caught_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
