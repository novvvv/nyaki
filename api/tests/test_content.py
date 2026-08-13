"""공지/메모 콘텐츠 타입 추가(2026-08-13) 검증용 테스트.

무엇을 확인하는가:
- 기존 "곡" 글은 그대로 아티스트 URL(/artists/{artist}/posts/{post})로 잘 등록되는가
- 새로 추가한 "아티스트 없는 글"(공지/메모)이 flat URL(/posts/{slug})로
  아티스트 없이도 저장·조회·삭제되는가 — 이번 작업의 핵심 기능
- kind 필터(?kind=notice)로 공지만 걸러서 조회할 수 있는가
- 삭제 후 정말로 404가 뜨는가 (soft delete가 조회 결과에서 잘 빠지는가)

어떻게 확인하는가:
- Firebase 로그인 없이 로컬에서 돌리려고, 관리자 인증(require_admin_id)을
  가짜 함수로 바꿔치기해서 토큰 검증을 건너뜀 (tests/test_sync.py와 같은 방식)
- 실제 HTTP 요청처럼 FastAPI TestClient로 PUT/GET/DELETE를 순서대로 호출
"""

from datetime import datetime, timezone

from fastapi.testclient import TestClient

from app.auth import require_admin_id
from app.database import Base, engine
from app.main import app


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def test_song_and_artistless_notice_flow() -> None:
    Base.metadata.create_all(bind=engine)
    app.dependency_overrides[require_admin_id] = lambda: "admin-uid"
    client = TestClient(app)

    # 1. 아티스트 등록 — 곡 글이 참조할 대상
    artist = {
        "slug": "humpback",
        "name": "Humpback",
        "description": "",
        "created_at": _now(),
        "updated_at": _now(),
        "is_deleted": False,
    }
    r = client.put("/v1/content/artists/humpback", json=artist)
    assert r.status_code == 200

    # 2. 곡 글 — 기존 방식대로 아티스트 URL 아래에 등록 (kind는 기본값 "song")
    song = {
        "slug": "dear-boy",
        "artist_slug": "humpback",
        "title": "친애하는 소년이여",
        "body": "가사...",
        "posted_at": _now(),
        "created_at": _now(),
        "updated_at": _now(),
        "is_deleted": False,
    }
    r = client.put("/v1/content/artists/humpback/posts/dear-boy", json=song)
    assert r.status_code == 200
    assert r.json()["kind"] == "song"

    # 3. 공지 — 아티스트 URL 없이 flat 경로로 등록. artist_slug를 None으로 보냄.
    #    이게 이번에 새로 생긴 기능의 핵심 — 예전엔 이 요청을 보낼 방법 자체가 없었음.
    notice = {
        "slug": "site-open",
        "kind": "notice",
        "artist_slug": None,
        "title": "사이트 오픈했습니다",
        "body": "안녕하세요",
        "posted_at": _now(),
        "created_at": _now(),
        "updated_at": _now(),
        "is_deleted": False,
    }
    r = client.put("/v1/content/posts/site-open", json=notice)
    assert r.status_code == 200
    assert r.json()["artist_slug"] is None

    # 4. kind 필터로 공지만 조회 — 방금 등록한 곡(song)은 안 섞여 나와야 함
    r = client.get("/v1/content/posts?kind=notice")
    assert r.status_code == 200
    slugs = [p["slug"] for p in r.json()]
    assert slugs == ["site-open"]

    # 5. slug 하나만으로 단건 조회 (아티스트 정보 없이)
    r = client.get("/v1/content/posts/site-open")
    assert r.status_code == 200
    assert r.json()["title"] == "사이트 오픈했습니다"

    # 6. 삭제 후 조회하면 404 — soft delete(is_deleted=True)가 조회 결과에서 제외되는지 확인
    r = client.delete("/v1/content/posts/site-open")
    assert r.status_code == 204
    r = client.get("/v1/content/posts/site-open")
    assert r.status_code == 404

    app.dependency_overrides.clear()
