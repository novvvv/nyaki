from collections.abc import Callable
from typing import NamedTuple

import firebase_admin
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from firebase_admin import auth

from .config import get_settings

bearer_scheme = HTTPBearer(auto_error=False)


def initialize_firebase() -> None:
    if firebase_admin._apps:
        return
    firebase_admin.initialize_app(options={"projectId": get_settings().firebase_project_id})


class CurrentUser(NamedTuple):
    uid: str
    # 구글 계정 표시 이름 — 방명록 작성자 이름처럼 화면에 보일 때 쓴다(토큰에 없으면 빈 문자열)
    name: str


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> CurrentUser:
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Firebase ID token이 필요합니다.",
        )

    try:
        decoded = auth.verify_id_token(credentials.credentials)
    except Exception as error:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="유효하지 않은 Firebase ID token입니다.",
        ) from error

    return CurrentUser(uid=str(decoded["uid"]), name=str(decoded.get("name") or ""))


def get_current_user_id(user: CurrentUser = Depends(get_current_user)) -> str:
    return user.uid


def get_optional_user_id(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> str | None:
    """로그인 안 해도 되는 공개 조회에서 "내 것인지"만 가릴 때. 토큰이 없거나 틀리면 None."""
    if credentials is None:
        return None
    try:
        return str(auth.verify_id_token(credentials.credentials)["uid"])
    except Exception:
        return None


def is_admin(user_id: str | None) -> bool:
    return user_id is not None and user_id in get_settings().admin_uid_list


def require_admin_id(user_id: str = Depends(get_current_user_id)) -> str:
    # nyaki-web 콘텐츠(글쓰기) 쓰기 작업 전용 가드. 별도 role 테이블 없이
    # 설정된 관리자 uid 목록에 있는지만 확인 — 발행자가 본인 1명뿐이라 충분함.
    if not is_admin(user_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="관리자만 사용할 수 있습니다.",
        )
    return user_id


AuthDependency = Callable[..., str]
