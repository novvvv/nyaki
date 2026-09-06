from pydantic import BaseModel

# ProgressResponse DTO 
#   churu_balance : 츄르 잔액 
#   capelin_balance : 열빙어 잔액 
#   completed_today : 오늘 완료한 퀘스트 목록 
class ProgressResponse(BaseModel):
    churu_balance: int
    # 기본값 0은 임시다 — services.py의 모든 생성 지점이 값을 채우게 되면
    # 기본값을 떼어 필수로 굳힌다(빠뜨렸을 때 조용히 0이 나가는 걸 막기 위해).
    capelin_balance: int = 0
    completed_today: list[str]
