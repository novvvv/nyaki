from pydantic import BaseModel

# ProgressResponse DTO 
#   churu_balance : 츄르 잔액 
#   completed_today : 오늘 완료한 퀘스트 목록 
class ProgressResponse(BaseModel):
    churu_balance: int
    completed_today: list[str]
