"""회원 탈퇴.

평소 삭제처럼 is_deleted 표시만 하지 않고 **행을 실제로 지운다.** 탈퇴는
개인정보 삭제라 데이터가 남으면 안 된다. 다른 기기에 "지워졌다"를 알릴
필요도 없다 — 계정이 사라지면 그 기기는 다음 동기화에서 로그인이 풀린다.

순서가 중요하다: **데이터를 먼저, Firebase 계정을 나중에.** 계정을 먼저 지우고
데이터 삭제가 실패하면 다시 로그인할 길이 없어 데이터가 영영 남는다. 지금
순서면 계정 삭제가 실패해도 사용자가 다시 탈퇴를 눌러 이어서 처리할 수 있다.
"""

from firebase_admin import auth
from sqlalchemy import delete
from sqlalchemy.orm import Session

from ..models import (
    AttendanceLogModel,
    CardModel,
    ClozeNoteModel,
    FolderModel,
    PackImportModel,
    QuestStateModel,
    ReviewLogModel,
    SyncChangeModel,
    UserProgressModel,
    WordBookModel,
    WordModel,
)

# 사용자 데이터가 있는 테이블 전부. 블로그 콘텐츠(아티스트·글)는 사용자
# 데이터가 아니라 빠진다. **user_id가 있는 테이블을 새로 만들면 여기에 넣는다.**
USER_TABLES = (
    FolderModel,
    WordBookModel,
    WordModel,
    CardModel,
    ClozeNoteModel,
    ReviewLogModel,
    PackImportModel,
    SyncChangeModel,
    UserProgressModel,
    QuestStateModel,
    AttendanceLogModel,
)


def delete_account_data(session: Session, user_id: str) -> None:
    """이 사용자의 데이터를 전부 지운다. 커밋은 부르는 쪽이 한다."""
    for model in USER_TABLES:
        session.execute(delete(model).where(model.user_id == user_id))


def delete_firebase_user(user_id: str) -> None:
    """Firebase 계정을 지운다. **데이터를 커밋한 뒤에** 부른다.

    이미 없으면 넘어간다 — 지난번에 데이터만 지우고 여기서 실패한 사용자가
    다시 눌렀을 때 끝까지 가야 한다.
    """
    try:
        auth.delete_user(user_id)
    except auth.UserNotFoundError:
        pass
