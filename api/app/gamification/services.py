from datetime import date, datetime, timezone
from sqlalchemy import select
from sqlalchemy.orm import Session
from ..models import QuestStateModel, UserProgressModel
from .schemas import ProgressResponse

QUEST_REWARDS: dict[str, int] = {
    "pet_cat": 5,
}

# ====================== ✨ today util method ✨ ====================== #
# - 오늘 날짜 (UTC) 기준으로 오늘이 며칠인지 계산 
def _today() -> date:
    return datetime.now(timezone.utc).date()
# ===================================================================== #

# ====================== ✨ [method] get_or_create_progress ✨ ====================== #
# - input parameter 
#   -- Session : DB Session, user_id : 유저 ID 
# - return parametrer 
#   -- UserProgressModel 
# - role 
#   -- 유저 잔액 조회용 Helper 
#   -- 유저의 잔액 row가 있으면 가져오고, 없으면 (처음 퀘스트를 하는 유저) 새로 반환한다. 

def _get_or_create_progress(session: Session, user_id: str) -> UserProgressModel:
    # 유저의 잔액 데이터를 가져온다. 
    progress = session.get(UserProgressModel, user_id)
    if progress is None:
        progress = UserProgressModel(user_id=user_id)
        session.add(progress)
        session.flush()
    return progress
# ================================================================================== # 

# ====================== ✨ [method] get_or_create_progress ✨ ====================== #
def _completed_today(session: Session, user_id: str) -> list[str]:
    today = _today()
    rows = session.scalars(
        select(QuestStateModel.quest_id).where(
            QuestStateModel.user_id == user_id,
            QuestStateModel.last_completed_date == today,
        )
    )
    return list(rows)


def complete_quest(session: Session, user_id: str, quest_id: str) -> ProgressResponse:
    """퀘스트 완료 처리. idempotent — 오늘 이미 완료했으면 보상 없이 현재 상태만 반환."""
    if quest_id not in QUEST_REWARDS:
        raise ValueError(f"알 수 없는 퀘스트: {quest_id}")

    today = _today()
    state = session.get(QuestStateModel, {"user_id": user_id, "quest_id": quest_id})
    already_done_today = state is not None and state.last_completed_date == today

    if not already_done_today:
        if state is None:
            state = QuestStateModel(user_id=user_id, quest_id=quest_id, last_completed_date=today)
            session.add(state)
        else:
            state.last_completed_date = today

        progress = _get_or_create_progress(session, user_id)
        progress.churu_balance += QUEST_REWARDS[quest_id]
    else:
        progress = _get_or_create_progress(session, user_id)

    session.flush()
    return ProgressResponse(
        churu_balance=progress.churu_balance,
        completed_today=_completed_today(session, user_id),
    )

# [service method] get_progress
#   feat : 현재 유저의 잔액과 오늘 완료한 퀘스트 목록을 읽기 전용으로 조회한다. 
#   parameter
#       session : db session
#       user_id : user token id  
def get_progress(session: Session, user_id: str) -> ProgressResponse:
    progress = session.get(UserProgressModel, user_id)
    balance = progress.churu_balance if progress is not None else 0
    return ProgressResponse(
        churu_balance=balance,
        completed_today=_completed_today(session, user_id),
    )
