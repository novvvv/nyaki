from pydantic import BaseModel, Field


# ProgressResponse DTO
#   churu_balance : 츄르 잔액
#   capelin_balance : 열빙어 잔액
#   completed_today : 오늘 완료한 퀘스트 목록
#
# 복습 진행도(오늘 몇 개 채점했는지)는 여기 없다. 서버가 그 숫자를 검증할
# 방법이 없어서 받아둘 가치가 없고, 앱이 로컬 Drift에서 세면 서버 왕복 없이
# 즉시 계산된다. 서버는 "오늘 완료했나"만 판정한다.
class ProgressResponse(BaseModel):
    churu_balance: int
    capelin_balance: int
    completed_today: list[str]
    # 하루 한도 — 안키의 "새 카드/일", "최대 복습량/일". 실제로 적용되는 값을
    # 내려준다(저장값이 null이면 기본값이 채워져 나간다).
    daily_new_limit: int
    daily_review_limit: int
    # 복습 흐름 — 분 단위 단계 목록. 빈 배열이면 단계를 쓰지 않는다(일 단위로 바로 간다).
    learning_steps: list[int]
    relearning_steps: list[int]
    graduating_interval_days: int


class ProgressSettingsRequest(BaseModel):
    """하루 한도 변경. 보낸 항목만 바꾼다."""

    daily_new_limit: int | None = Field(default=None, ge=0, le=9999)
    daily_review_limit: int | None = Field(default=None, ge=0, le=9999)
    # "1,10" 또는 "1 10". 빈 문자열이면 단계를 끈다.
    learning_steps: str | None = Field(default=None, max_length=120)
    relearning_steps: str | None = Field(default=None, max_length=120)
    graduating_interval_days: int | None = Field(default=None, ge=1, le=365)
