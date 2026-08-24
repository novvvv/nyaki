from pydantic import BaseModel


class ProgressResponse(BaseModel):
    """POST .../complete 와 GET /v1/progress가 공통으로 반환하는 형태.

    GAMIFICATION-PLAN.md "퀘스트 완료 API" 참고 — 클라이언트는 잔액을 계산해서
    보내지 않고, 서버가 계산한 이 응답을 그대로 신뢰해서 로컬 캐시를 덮어쓴다.
    """

    churu_balance: int
    completed_today: list[str]
