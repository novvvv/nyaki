"""FF14 물고기(터주) 엔터티(2026-10-23) 검증용 테스트.

무엇을 확인하는가:
- 관리자 PUT으로 등록한 물고기가 공개 GET(목록·상세)에서 조건 칸(날씨 id 목록·ET 시간)
  그대로 돌아오는가 — 웹이 이 값으로 다음 출현 시각을 계산한다
- 목록 필터: 지역(zone_id), 날씨(weather_id — 날씨 조건 없는 물고기는 항상 포함), 이름 검색(q)
- 시간은 시작·끝을 함께 줘야 하고, 입질 표기는 정해진 값만 받는가
- 삭제 후 목록·상세에서 빠지는가

어떻게 확인하는가: tests/content/test_content.py와 같이 관리자 인증을 가짜로 바꿔치기하고
TestClient로 실제 요청 순서대로 호출.
"""

from datetime import datetime, timezone

from fastapi.testclient import TestClient

from app.core.auth import get_current_user_id, require_admin_id
from app.core.database import Base, engine
from app.main import app


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _fish(**overrides: object) -> dict:
    data = {
        "slug": "meteor-survivor",
        "item_id": 7903,
        "icon_id": 29086,
        "name": "메테오 투구게",
        "name_en": "Meteor Survivor",
        "name_ja": "メテオサバイバー",
        "zone_id": 135,
        "spot_name": "소금기둥 해변",
        "spots": [{"zone_id": 135, "spot_name": "소금기둥 해변"}],
        "water": "바닷가",
        "level": 50,
        "stars": 3,
        "is_legendary": True,
        "is_big_fish": True,
        "start_hour": 3,
        "end_hour": 5,
        "weathers": [3, 4, 5],
        "previous_weathers": [],
        "bait": "쥐꼬리",
        "mooches": [{"name": "구리붕어", "tug": "!", "hookset": "섬세한 낚아채기"}],
        "tug": "!!!",
        "hookset": "강력한 낚아채기",
        "buffs": ["물고기의 눈"],
        "description": "비정상적으로 단단한 외골격을 가진 투구게.",
        "created_at": _now(),
        "updated_at": _now(),
    }
    data.update(overrides)
    return data


def test_fish_crud_and_filters() -> None:
    Base.metadata.create_all(bind=engine)
    app.dependency_overrides[require_admin_id] = lambda: "admin-uid"
    client = TestClient(app)

    # 1. 등록 — 조건 칸이 그대로 저장·반환되는가
    r = client.put("/v1/content/fish/meteor-survivor", json=_fish())
    assert r.status_code == 200
    body = r.json()
    assert body["weathers"] == [3, 4, 5]
    assert body["start_hour"] == 3 and body["end_hour"] == 5
    assert body["buffs"] == ["물고기의 눈"]
    assert body["mooches"] == [{"name": "구리붕어", "tug": "!", "hookset": "섬세한 낚아채기"}]

    # 날씨 조건이 없는 상시 물고기 하나 더 — 날씨 필터에서 항상 포함돼야 함
    r = client.put(
        "/v1/content/fish/plain-fish",
        json=_fish(
            slug="plain-fish",
            item_id=4869,
            name="평범한 물고기",
            name_en="Plain Fish",
            zone_id=134,
            spots=[
                {"zone_id": 134, "spot_name": "중부 낚시터"},
                {"zone_id": 137, "spot_name": "동부 낚시터"},
            ],
            level=10,
            start_hour=None,
            end_hour=None,
            weathers=[],
            is_big_fish=False,
            is_legendary=False,
        ),
    )
    assert r.status_code == 200

    # 2. 상세
    r = client.get("/v1/content/fish/meteor-survivor")
    assert r.status_code == 200
    assert r.json()["spot_name"] == "소금기둥 해변"

    # 3. 목록 필터
    # 테스트들이 DB를 같이 쓰므로 다른 테스트가 만든 물고기는 빼고 본다.
    own = {"meteor-survivor", "plain-fish"}
    slugs = lambda resp: sorted(f["slug"] for f in resp.json() if f["slug"] in own)  # noqa: E731
    assert slugs(client.get("/v1/content/fish")) == ["meteor-survivor", "plain-fish"]
    assert slugs(client.get("/v1/content/fish?zone_id=135")) == ["meteor-survivor"]
    # 대표 지역이 아니어도 낚시터 목록(spots)에 있으면 걸린다
    assert slugs(client.get("/v1/content/fish?zone_id=137")) == ["plain-fish"]
    assert slugs(client.get("/v1/content/fish?q=동부 낚시터")) == ["plain-fish"]
    assert slugs(client.get("/v1/content/fish?weather_id=4")) == ["meteor-survivor", "plain-fish"]
    assert slugs(client.get("/v1/content/fish?weather_id=7")) == ["plain-fish"]
    assert slugs(client.get("/v1/content/fish?q=투구게")) == ["meteor-survivor"]
    assert slugs(client.get("/v1/content/fish?q=meteor")) == ["meteor-survivor"]
    assert slugs(client.get("/v1/content/fish?q=소금기둥")) == ["meteor-survivor", "plain-fish"]

    # 4. 검증 — 시간 한쪽만 / 정해지지 않은 입질 표기는 거절
    r = client.put("/v1/content/fish/bad", json=_fish(slug="bad", item_id=1, end_hour=None))
    assert r.status_code == 422
    r = client.put("/v1/content/fish/bad", json=_fish(slug="bad", item_id=1, tug="!!!!"))
    assert r.status_code == 422
    r = client.put(
        "/v1/content/fish/bad",
        json=_fish(slug="bad", item_id=1, mooches=[{"name": "구리붕어", "tug": "?"}]),
    )
    assert r.status_code == 422
    r = client.put("/v1/content/fish/other-slug", json=_fish())
    assert r.status_code == 400

    # 5. 삭제 — 목록·상세에서 빠짐
    assert client.delete("/v1/content/fish/plain-fish").status_code == 204
    assert client.get("/v1/content/fish/plain-fish").status_code == 404
    assert slugs(client.get("/v1/content/fish")) == ["meteor-survivor"]
    assert client.delete("/v1/content/fish/plain-fish").status_code == 404

    app.dependency_overrides.clear()


def test_caught_fish_is_per_user() -> None:
    """잡은 물고기 체크는 로그인한 본인 것만 보이고, 없는 물고기는 체크할 수 없다."""
    Base.metadata.create_all(bind=engine)
    app.dependency_overrides[require_admin_id] = lambda: "admin-uid"
    client = TestClient(app)
    client.put(
        "/v1/content/fish/caught-test",
        json=_fish(slug="caught-test", item_id=99001, name="체크용 물고기"),
    )

    # 로그인 안 하면 401
    assert client.get("/v1/content/caught-fish").status_code == 401

    app.dependency_overrides[get_current_user_id] = lambda: "user-a"
    r = client.put("/v1/content/caught-fish/caught-test")
    assert r.status_code == 200
    # 두 번 체크해도 처음 시각 그대로. SQLite는 읽을 때 시간대 표시를 떼므로 시각 값으로 비교.
    def caught_at(resp) -> datetime:  # noqa: ANN001
        return datetime.fromisoformat(resp.json()["caught_at"].removesuffix("Z")).replace(tzinfo=None)

    first_caught_at = caught_at(r)
    assert caught_at(client.put("/v1/content/caught-fish/caught-test")) == first_caught_at
    assert [c["fish_slug"] for c in client.get("/v1/content/caught-fish").json()] == ["caught-test"]
    assert client.put("/v1/content/caught-fish/no-such-fish").status_code == 404

    # 다른 사용자에게는 안 보임
    app.dependency_overrides[get_current_user_id] = lambda: "user-b"
    assert client.get("/v1/content/caught-fish").json() == []

    # 해제 — 두 번 해제해도 204
    app.dependency_overrides[get_current_user_id] = lambda: "user-a"
    assert client.delete("/v1/content/caught-fish/caught-test").status_code == 204
    assert client.delete("/v1/content/caught-fish/caught-test").status_code == 204
    assert client.get("/v1/content/caught-fish").json() == []

    app.dependency_overrides.clear()
