from fastapi import APIRouter, Depends, Response, status
from sqlalchemy.orm import Session

from ..core.auth import get_current_user_id
from ..core.database import get_session
from .services import delete_account_data, delete_firebase_user

router = APIRouter(prefix="/v1/account", tags=["account"])


@router.delete("", status_code=status.HTTP_204_NO_CONTENT)
def delete_account(
    session: Session = Depends(get_session),
    user_id: str = Depends(get_current_user_id),
) -> Response:
    """회원 탈퇴. 내 데이터를 전부 지우고 Firebase 계정을 지운다.

    데이터를 커밋한 **다음에** 계정을 지운다(services.py 참고). 계정 삭제에서
    실패하면 500이 나가고, 다시 부르면 데이터는 이미 없으니 계정만 지운다.
    """
    delete_account_data(session, user_id)
    session.commit()
    delete_firebase_user(user_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
