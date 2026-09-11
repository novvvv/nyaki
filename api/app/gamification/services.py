from datetime import date, datetime, timedelta, timezone
from sqlalchemy import select
from sqlalchemy.orm import Session
from ..models import QuestStateModel, UserProgressModel
from .schemas import ProgressResponse

# 재화 식별자 — 앱 quest_screen.dart의 currency 값과 같은 문자열을 쓴다.
CHURU = "churu"
CAPELIN = "capelin"

# 퀘스트별 리워드 테이블 
QUEST_REWARDS: dict[str, tuple[str, int]] = {
    "pet_cat": (CHURU, 5),
    "add_word": (CHURU, 5),
    "morning_review": (CAPELIN, 1),
    "evening_review": (CAPELIN, 1),
}

# 시간대 퀘스트가 열려 있는 창 — (시작 시, 끝 시) KST, 끝은 미포함.
#
# 몇 개를 복습했는지는 앱이 로컬에서 세고 판정한다(서버는 검증할 방법이 없다).
# 대신 서버는 "지금이 그 시간대인가"를 본다 — 이게 없으면 새벽 3시에
# 아침 퀘스트를 받아갈 수 있다. 기기 시계가 아니라 서버 수신 시각으로 판정하므로
# 앱에서 시간을 조작해도 통하지 않는다.
TIME_QUEST_WINDOWS: dict[str, tuple[int, int]] = {
    "morning_review": (6, 14),
    "evening_review": (18, 24),
}

# 한국 표준시(KST, UTC+9) 고정 오프셋 — DST 없는 시간대라 zoneinfo/tzdata
# 의존성 없이 고정 오프셋으로 충분함(python:3.13-slim 이미지엔 tzdata가 없음).
_KST = timezone(timedelta(hours=9))

# ====================== [util] KST 시각 ====================== #
# - _now_kst() : 지금 시각(KST). 시간대 퀘스트 창 판정에 쓴다
# - _today()   : 오늘 날짜(KST). 퀘스트 "오늘 했나" 판정에 쓴다
#
# UTC가 아니라 KST인 이유 — 클라이언트(로컬시간)와 기준을 맞춰 자정(00:00 KST)에
# 딱 맞게 리셋되게 한다. 2026-08-28 변경, 기존엔 UTC라 한국 오전 9시에야
# 날짜가 바뀌었다.
def _now_kst() -> datetime:
    return datetime.now(_KST)


# 시각은 제외하고 날짜만 반환 
# 퀘스트를 오늘 이미 완료했는지 판정하기 위해서 사용 
def _today() -> date:
    return _now_kst().date()
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


# ====================== [method] _grant ====================== #
# - feat : 퀘스트 보상 지급 메서드 

# - logic -> 열빙어 1개 -> _grant(progress, CAPELIN, 1)

# - parameter
#     progress : 이 유저의 잔액 행. 잔액 칸이 츄르/열빙어 두 개라 골라야 한다
#     currency : 어느 재화인지 — CHURU("churu") / CAPELIN("capelin")
#     amount   : 지급 수량

# - return : 없음. 여기서 DB에 쓰지 않고 progress 객체의 숫자만 올린다.
#            SQLAlchemy가 그 변경을 기억했다가 호출한 쪽의 flush/commit 때
#            UPDATE로 내보낸다.
# - 모르는 재화는 조용히 넘기지 않고 ValueError로 즉시 터뜨린다 —
#   오타가 "보상이 안 들어왔는데 에러도 없음"으로 묻히면 원인을 못 찾는다.
def _grant(progress: UserProgressModel, currency: str, amount: int) -> None:
    if currency == CHURU:
        progress.churu_balance += amount
    elif currency == CAPELIN:
        progress.capelin_balance += amount
    else:
        raise ValueError(f"알 수 없는 재화: {currency}")


# ====================== [method] _response ====================== #
# - feat : API 응답(ProgressResponse) 조립 메서드
# - logic -> 잔액 두 개(츄르·열빙어) + 오늘 완료한 퀘스트 목록을 담아 반환
# - parameter
#     session  : DB Session — 오늘 완료 목록을 조회하는 데 쓴다
#     user_id  : 유저 ID
#     progress : 이 유저의 잔액 행. 퀘스트를 한 번도 안 한 신규 유저면 None이고,
#                이 경우 잔액을 0으로 채운다
# - 조회(get_progress)와 완료(complete_quest)가 같은 응답을 쓰므로 한 곳에서만
#   조립한다 — 필드가 늘어날 때 한쪽만 고치는 실수를 막는다.
def _response(
    session: Session, user_id: str, progress: UserProgressModel | None
) -> ProgressResponse:
    return ProgressResponse(
        churu_balance=progress.churu_balance if progress is not None else 0,
        capelin_balance=progress.capelin_balance if progress is not None else 0,
        completed_today=_completed_today(session, user_id),
    )


# ====================== [method] _assert_in_time_window ====================== #
# - feat : 시간대 퀘스트가 지금 열려 있는지 확인한다. 시간대 퀘스트가 아니면 통과.
# - 서버 수신 시각(KST) 기준이라 기기 시계 조작이 통하지 않는다.
def _assert_in_time_window(quest_id: str) -> None:
    window = TIME_QUEST_WINDOWS.get(quest_id)
    if window is None:
        return

    start_hour, end_hour = window
    hour = _now_kst().hour
    if not (start_hour <= hour < end_hour):
        raise ValueError(
            f"지금은 {quest_id} 시간이 아니다 ({start_hour}시~{end_hour}시)"
        )


def complete_quest(session: Session, user_id: str, quest_id: str) -> ProgressResponse:
    """퀘스트 완료 처리. idempotent — 오늘 이미 완료했으면 보상 없이 현재 상태만 반환."""
    if quest_id not in QUEST_REWARDS:
        raise ValueError(f"알 수 없는 퀘스트: {quest_id}")
    _assert_in_time_window(quest_id)

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
        currency, amount = QUEST_REWARDS[quest_id]
        _grant(progress, currency, amount)
    else:
        progress = _get_or_create_progress(session, user_id)

    session.flush()
    return _response(session, user_id, progress)

# [service method] get_progress
#   feat : 현재 유저의 잔액과 오늘 완료한 퀘스트 목록을 읽기 전용으로 조회한다. 
#   parameter
#       session : db session
#       user_id : user token id  
def get_progress(session: Session, user_id: str) -> ProgressResponse:
    progress = session.get(UserProgressModel, user_id)
    return _response(session, user_id, progress)
