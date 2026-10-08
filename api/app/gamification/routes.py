from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..core.auth import get_current_user_id
from ..core.database import get_session
from .schemas import CheckInResponse, ProgressResponse, ProgressSettingsRequest
from .services import (
    attendance_status,
    check_in,
    complete_quest,
    get_progress,
    update_settings,
)

# router definition
# - 모든 라우터 경로 앞에 /v1/prgoresss 
router = APIRouter(prefix="/v1/progress", tags=["progress"])

# [API] 퀘스트 완료 API 
#   - method : POST /v1/progress/quests/{quest_id}/complete
#   - parameter
#       -- quest_id : url 경로 내부 퀘
#       -- session : DB Session .. Depends? 
#       -- user_id : 요청 헤더의 로그인 토큰을 검증하여, 유저 ID를 뽑아 넣어준다. (로그인 되어 있지 않으면 401)
@router.post("/quests/{quest_id}/complete", response_model=ProgressResponse)
def post_complete_quest(
    quest_id: str,
    session: Session = Depends(get_session),
    user_id: str = Depends(get_current_user_id),
) -> ProgressResponse:
    try:
        result = complete_quest(session, user_id, quest_id)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    session.commit()
    return result

# [API] 현재 상태 조회 API
#   - method : GET /v1/progress 
#   - parameter
#       1. session : DB Session 
#       2. user_id : login token user id 
@router.get("", response_model=ProgressResponse)
def get_progress_route(
    session: Session = Depends(get_session),
    user_id: str = Depends(get_current_user_id),
) -> ProgressResponse:
    return get_progress(session, user_id)


# [API] 하루 한도 변경 API
#   - method : PUT /v1/progress/settings
#   - 안키의 "새 카드/일", "최대 복습량/일"에 해당한다. 보낸 항목만 바꾼다.
@router.put("/settings", response_model=ProgressResponse)
def put_progress_settings(
    payload: ProgressSettingsRequest,
    session: Session = Depends(get_session),
    user_id: str = Depends(get_current_user_id),
) -> ProgressResponse:
    result = update_settings(session, user_id, payload)
    session.commit()
    return result


# [API] 출석
#   - method : POST /v1/attendance
#   - 하루 한 번 츄르를 준다. 다시 불러도 안전하다(같은 날이면 granted 0).
#   - 본문을 받지 않는다 — 날짜 · 보상을 클라이언트가 정할 여지를 없앤다.
attendance_router = APIRouter(prefix="/v1/attendance", tags=["progress"])


@attendance_router.post("", response_model=CheckInResponse)
def post_check_in(
    session: Session = Depends(get_session),
    user_id: str = Depends(get_current_user_id),
) -> CheckInResponse:
    granted, today, progress = check_in(session, user_id)
    session.commit()
    status = attendance_status(session, user_id)
    return CheckInResponse(
        checked_in=True,
        granted=granted,
        date=today,
        streak=status.streak,
        next_reset_at=status.next_reset_at,
        churu_balance=progress.churu_balance,
    )
