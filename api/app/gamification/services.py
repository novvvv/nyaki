from dataclasses import dataclass
from datetime import date, datetime, time, timedelta, timezone
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from ..models import AttendanceLogModel, QuestStateModel, UserProgressModel
from ..vocab.services import (
    DEFAULT_LEARNING_STEPS,
    DEFAULT_NEW_LIMIT,
    DEFAULT_RELEARNING_STEPS,
    DEFAULT_REVIEW_LIMIT,
    steps_or_default,
)
from .schemas import AttendanceInfo, ProgressResponse, ProgressSettingsRequest

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
    new_limit = progress.daily_new_limit if progress is not None else None
    review_limit = progress.daily_review_limit if progress is not None else None
    return ProgressResponse(
        churu_balance=progress.churu_balance if progress is not None else 0,
        capelin_balance=progress.capelin_balance if progress is not None else 0,
        completed_today=_completed_today(session, user_id),
        # 저장값이 없으면 기본값을 채워 내려준다. 화면이 "설정 안 함"을 따로
        # 해석하지 않아도 되고, 기본값 숫자가 서버 한 곳에만 있게 된다.
        daily_new_limit=new_limit if new_limit is not None else DEFAULT_NEW_LIMIT,
        daily_review_limit=review_limit
        if review_limit is not None
        else DEFAULT_REVIEW_LIMIT,
        # 저장은 "1,10" 문자열이지만 내려줄 때는 숫자 배열로 푼다 — 화면과 앱이
        # 문자열 파싱을 각자 다시 구현하지 않도록.
        learning_steps=list(
            steps_or_default(
                progress.learning_steps if progress else None, DEFAULT_LEARNING_STEPS
            )
        ),
        relearning_steps=list(
            steps_or_default(
                progress.relearning_steps if progress else None,
                DEFAULT_RELEARNING_STEPS,
            )
        ),
        graduating_interval_days=(
            progress.graduating_interval_days
            if progress is not None and progress.graduating_interval_days is not None
            else 1
        ),
        attendance=_attendance_info(session, user_id),
    )


def _attendance_info(session: Session, user_id: str) -> AttendanceInfo:
    status = attendance_status(session, user_id)
    return AttendanceInfo(
        checked_in_today=status.checked_in_today,
        streak=status.streak,
        next_reset_at=status.next_reset_at,
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


# ====================== [method] update_settings ====================== #
# 하루 한도를 바꾼다. 보낸 항목만 반영한다(exclude_unset) — 한쪽만 바꾸려고
# 다른 쪽 현재값을 클라이언트가 다시 실어 보낼 필요가 없다.
def update_settings(
    session: Session, user_id: str, payload: ProgressSettingsRequest
) -> ProgressResponse:
    progress = _get_or_create_progress(session, user_id)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(progress, field, value)
    session.flush()
    return _response(session, user_id, progress)


# ====================== 출석 ====================== #
#
# 하루 한 번 버튼을 누르면 츄르를 준다. 규칙은 루트 check_in_plan.md 참고.
#
# - "오늘"은 서버가 정한다(KST 자정 기준, 서버 수신 시각). 클라이언트는 날짜를
#   보낼 길이 없다 — 기기 시계를 바꿔도 통하지 않는다.
# - 같은 날 두 번 주지 않는 건 attendance_logs의 (user_id, date) 기본키가 한다.
#   "있나 먼저 읽고 없으면 쓰기"를 하지 않는다 — 동시 요청 두 개가 둘 다 "없음"을
#   읽고 둘 다 지급한다. INSERT를 먼저 하고, 기본키 충돌이면 이미 출석한 것이다.
# - 출석 기록과 츄르는 같은 트랜잭션에 들어간다. 커밋은 라우트가 한다.

CHECK_IN_REWARD = 5

# 연속 출석을 셀 때 거슬러 보는 최대 일수. 이보다 길게 연속이면 이 값에서 멈춘다.
STREAK_LOOKBACK_DAYS = 400


def next_reset_at() -> datetime:
    """다음 KST 자정(UTC). 화면이 "다음 출석까지"를 계산하는 기준이다.

    클라이언트 시계로 자정을 계산하면 기기 시계 · 시간대에 따라 어긋난다.
    """
    tomorrow = _today() + timedelta(days=1)
    return datetime.combine(tomorrow, time.min, tzinfo=_KST).astimezone(timezone.utc)


@dataclass(frozen=True)
class AttendanceStatus:
    checked_in_today: bool
    streak: int
    next_reset_at: datetime


def attendance_status(session: Session, user_id: str) -> AttendanceStatus:
    """오늘 출석했나, 연속 며칠인가.

    연속은 오늘부터 거꾸로 센다. 오늘 아직 출석 전이면 어제부터 센다 — 자정이
    지났다고 어제까지의 연속이 바로 0으로 보이면 안 된다(오늘 누르면 이어진다).
    """
    today = _today()
    dates = set(
        session.scalars(
            select(AttendanceLogModel.date)
            .where(
                AttendanceLogModel.user_id == user_id,
                AttendanceLogModel.date
                > today - timedelta(days=STREAK_LOOKBACK_DAYS),
            )
            .order_by(AttendanceLogModel.date.desc())
        )
    )
    checked_in_today = today in dates

    streak = 0
    cursor = today if checked_in_today else today - timedelta(days=1)
    while cursor in dates:
        streak += 1
        cursor -= timedelta(days=1)

    return AttendanceStatus(
        checked_in_today=checked_in_today,
        streak=streak,
        next_reset_at=next_reset_at(),
    )


def check_in(session: Session, user_id: str) -> tuple[int, date, UserProgressModel]:
    """오늘 출석한다. (이번에 준 츄르, 오늘 날짜, 잔액 행)

    다시 불러도 안전하다 — 이미 출석했으면 아무것도 주지 않고 0을 돌려준다.
    """
    today = _today()

    # INSERT로 판정한다. 같은 날 두 번째면 기본키 충돌이다. 세이브포인트 안에서
    # 해서 충돌이 나도 바깥 트랜잭션은 살아 있다.
    try:
        with session.begin_nested():
            session.add(
                AttendanceLogModel(
                    user_id=user_id,
                    date=today,
                    reward=CHECK_IN_REWARD,
                    created_at=datetime.now(timezone.utc),
                )
            )
    except IntegrityError:
        return 0, today, _get_or_create_progress(session, user_id)

    progress = _get_or_create_progress(session, user_id)
    # 잔액은 SQL 안에서 더한다(churu = churu + 5). 파이썬에서 읽고 더해 쓰면, 같은
    # 순간 다른 퀘스트 보상이 들어올 때 한쪽 증가가 사라진다.
    progress.churu_balance = UserProgressModel.churu_balance + CHECK_IN_REWARD
    session.flush()
    session.refresh(progress)
    return CHECK_IN_REWARD, today, progress
