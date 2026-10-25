from datetime import datetime

from sqlalchemy import DateTime, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from ..core.database import Base

# ==================== 📃 Note ======================= #
# nyaki-web 방명록. 구글 로그인한 사용자만 쓰고, 본인 글(관리자는 전부)만 지운다.
# 작성자 이름은 쓸 때의 구글 표시 이름을 그대로 남긴다(나중에 이름을 바꿔도 글은 그대로).
# 지우면 행을 지운다 — 동기화할 기기가 없어서 tombstone(is_deleted)이 필요 없다.
# 회원 탈퇴 시 지워지도록 account/services.py USER_TABLES에 들어 있다.
# ==================================================== #


class GuestbookEntryModel(Base):
    __tablename__ = "guestbook_entries"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[str] = mapped_column(String(128), index=True)
    author_name: Mapped[str] = mapped_column(String(60))
    body: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
