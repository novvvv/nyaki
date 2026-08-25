from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..core.auth import get_current_user_id
from ..core.database import get_session
from .schemas import ProgressResponse
from .services import complete_quest, get_progress

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
