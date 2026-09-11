from pydantic import BaseModel


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
