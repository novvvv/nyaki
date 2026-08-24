"""SQLAlchemy 2.0 스타일 ORM Entity 모음 (JPA의 @Entity 클래스들에 대응).

default vs server_default
  default        : 파이썬(ORM)으로 INSERT할 때 채워짐. 엔터티를 만드는 순간 값이 실림.
  server_default : DB DDL 자체에 새겨지는 기본값. raw SQL·마이그레이션처럼 ORM을
                    안 거치는 경로로 row가 생겨도 적용됨.

도메인별로 파일을 나눴다 — 도메인 하나 볼 때 파일 하나만 보면 되게:
  vocab.py    — 단어장·단어 (WordBookModel, WordModel)
  sync.py     — Hub sync 변경 로그 (SyncChangeModel)
  gamification.py — 게이미피케이션 (UserProgressModel, QuestStateModel)
  content.py  — nyaki-web 블로그 콘텐츠 (ArtistModel, PostModel)

기존 코드는 `from .models import WordBookModel` 형태로 이 패키지를 그대로 쓴다 —
아래 재수출 덕분에 import 구문을 안 고쳐도 된다.
"""

from .content import ArtistModel, PostModel
from .gamification import QuestStateModel, UserProgressModel
from .sync import SyncChangeModel
from .vocab import WordBookModel, WordModel

__all__ = [
    "WordBookModel",
    "WordModel",
    "SyncChangeModel",
    "UserProgressModel",
    "QuestStateModel",
    "ArtistModel",
    "PostModel",
]
