"""카드 사진 — 유료 기능. R2 대신 가짜 저장소로 돈다.

여기서 지키는 것
- 유료 계정이 아니면 올리기 · 붙이기를 못 한다(403). 기능 표시도 false
- 저장소가 설정 안 된 서버면 유료 계정이어도 꺼져 있다
- 올린 사진을 붙이면 단어 응답에 photo_url이 나온다. 키는 내보내지 않는다
- 다른 사람 · 다른 단어 앞으로 만든 키, 안 올라온 키, 너무 큰 파일은 못 붙인다
- 사진을 바꾸거나 빼면 예전 파일은 커밋 뒤에 지워진다
- 단어를 고쳐 저장해도(웹은 image_path를 null로 보낸다) 사진은 남는다
- 단어 · 단어장을 지우면 사진도 지워진다. 탈퇴하면 그 사람 파일이 통째로 지워진다
"""

import uuid
from datetime import datetime, timezone

import pytest
from fastapi.testclient import TestClient
from firebase_admin import auth

from app.core.auth import get_current_user_id
from app.core.config import get_settings
from app.core.database import Base, engine
from app.core.photos import MAX_PHOTO_BYTES, reset_photo_store, set_photo_store
from app.main import app


class FakeStore:
    def __init__(self) -> None:
        self.files: dict[str, int] = {}
        self.deleted: list[str] = []

    def presign_put(self, key: str, content_type: str) -> str:
        return f"https://r2.test/put/{key}?type={content_type}"

    def presign_get(self, key: str) -> str:
        return f"https://r2.test/get/{key}"

    def size(self, key: str) -> int | None:
        return self.files.get(key)

    def delete(self, key: str) -> None:
        self.files.pop(key, None)
        self.deleted.append(key)

    def delete_prefix(self, prefix: str) -> None:
        for key in [k for k in self.files if k.startswith(prefix)]:
            self.delete(key)


@pytest.fixture
def store(monkeypatch: pytest.MonkeyPatch):
    fake = FakeStore()
    set_photo_store(fake)
    yield fake
    reset_photo_store()
    app.dependency_overrides.pop(get_current_user_id, None)


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _client(monkeypatch: pytest.MonkeyPatch, *, premium: bool) -> tuple[TestClient, str]:
    Base.metadata.create_all(bind=engine)
    user = f"photo-{uuid.uuid4().hex[:8]}"
    monkeypatch.setattr(get_settings(), "premium_uids", user if premium else "")
    app.dependency_overrides[get_current_user_id] = lambda: user
    client = TestClient(app)
    stamp = {"created_at": _now(), "updated_at": _now()}
    assert client.put("/v1/word-books/b1", json={"id": "b1", "title": "책", **stamp}).status_code == 200
    for word_id in ("w1", "w2"):
        assert client.put(
            f"/v1/word-books/b1/words/{word_id}",
            json={"id": word_id, "word_book_id": "b1", "term": "猫", "meaning": "고양이", **stamp},
        ).status_code == 200
    return client, user


def _upload(client: TestClient, store: FakeStore, word_id: str = "w1", size: int = 1000) -> str:
    res = client.post(
        f"/v1/words/{word_id}/photo/upload-url",
        json={"content_type": "image/webp", "size": size},
    )
    assert res.status_code == 200, res.text
    key = res.json()["key"]
    store.files[key] = size  # 브라우저가 R2에 올렸다
    return key


def _words(client: TestClient) -> dict[str, dict]:
    return {w["id"]: w for w in client.get("/v1/word-books/b1/words").json()}


def test_free_account_is_locked(store: FakeStore, monkeypatch: pytest.MonkeyPatch) -> None:
    client, _ = _client(monkeypatch, premium=False)
    assert client.get("/v1/me/features").json() == {"card_photos": False}
    res = client.post("/v1/words/w1/photo/upload-url", json={"content_type": "image/webp", "size": 10})
    assert res.status_code == 403
    assert res.json()["detail"] == "프리미엄에서 쓸 수 있는 기능이에요."
    assert client.put("/v1/words/w1/photo", json={"key": "u/x/w/y/z.webp"}).status_code == 403


def test_no_storage_means_off_even_for_premium(monkeypatch: pytest.MonkeyPatch) -> None:
    set_photo_store(None)
    try:
        client, _ = _client(monkeypatch, premium=True)
        assert client.get("/v1/me/features").json() == {"card_photos": False}
        res = client.post("/v1/words/w1/photo/upload-url", json={"content_type": "image/webp", "size": 10})
        assert res.status_code == 403
    finally:
        reset_photo_store()
        app.dependency_overrides.pop(get_current_user_id, None)


def test_attach_shows_url_and_hides_key(store: FakeStore, monkeypatch: pytest.MonkeyPatch) -> None:
    client, user = _client(monkeypatch, premium=True)
    assert client.get("/v1/me/features").json() == {"card_photos": True}
    key = _upload(client, store)
    assert key.startswith(f"u/{user}/w/") and key.endswith(".webp")

    res = client.put("/v1/words/w1/photo", json={"key": key})
    assert res.status_code == 200
    assert res.json()["photo_url"] == f"https://r2.test/get/{key}"
    assert "photo_key" not in res.json()
    words = _words(client)
    assert words["w1"]["photo_url"] == f"https://r2.test/get/{key}"
    assert words["w2"]["photo_url"] is None


def test_upload_rejects_bad_type_and_size(store: FakeStore, monkeypatch: pytest.MonkeyPatch) -> None:
    client, _ = _client(monkeypatch, premium=True)
    gif = client.post("/v1/words/w1/photo/upload-url", json={"content_type": "image/gif", "size": 10})
    assert gif.status_code == 422
    big = client.post(
        "/v1/words/w1/photo/upload-url",
        json={"content_type": "image/webp", "size": MAX_PHOTO_BYTES + 1},
    )
    assert big.status_code == 422
    missing = client.post("/v1/words/nope/photo/upload-url", json={"content_type": "image/webp", "size": 10})
    assert missing.status_code == 404


@pytest.mark.security
def test_cannot_attach_someone_elses_or_other_words_key(
    store: FakeStore, monkeypatch: pytest.MonkeyPatch
) -> None:
    client, user = _client(monkeypatch, premium=True)
    other_word_key = _upload(client, store, word_id="w2")
    assert client.put("/v1/words/w1/photo", json={"key": other_word_key}).status_code == 400

    stranger_key = other_word_key.replace(f"u/{user}/", "u/stranger/")
    store.files[stranger_key] = 10
    assert client.put("/v1/words/w1/photo", json={"key": stranger_key}).status_code == 400

    # 서명만 받고 안 올린 키
    res = client.post("/v1/words/w1/photo/upload-url", json={"content_type": "image/webp", "size": 10})
    assert client.put("/v1/words/w1/photo", json={"key": res.json()["key"]}).status_code == 400


def test_oversized_upload_is_rejected_and_removed(store: FakeStore, monkeypatch: pytest.MonkeyPatch) -> None:
    client, _ = _client(monkeypatch, premium=True)
    key = _upload(client, store)
    store.files[key] = MAX_PHOTO_BYTES + 1  # 알린 크기보다 크게 올렸다
    assert client.put("/v1/words/w1/photo", json={"key": key}).status_code == 413
    assert key not in store.files


def test_replace_and_remove_delete_old_file(store: FakeStore, monkeypatch: pytest.MonkeyPatch) -> None:
    client, _ = _client(monkeypatch, premium=True)
    first = _upload(client, store)
    client.put("/v1/words/w1/photo", json={"key": first})
    second = _upload(client, store)
    assert client.put("/v1/words/w1/photo", json={"key": second}).status_code == 200
    assert store.deleted == [first]

    res = client.delete("/v1/words/w1/photo")
    assert res.status_code == 200 and res.json()["photo_url"] is None
    assert store.deleted == [first, second]


def test_remove_works_after_premium_ends(store: FakeStore, monkeypatch: pytest.MonkeyPatch) -> None:
    client, _ = _client(monkeypatch, premium=True)
    key = _upload(client, store)
    client.put("/v1/words/w1/photo", json={"key": key})
    monkeypatch.setattr(get_settings(), "premium_uids", "")
    assert client.delete("/v1/words/w1/photo").status_code == 200
    assert key in store.deleted


def test_editing_word_keeps_photo(store: FakeStore, monkeypatch: pytest.MonkeyPatch) -> None:
    client, _ = _client(monkeypatch, premium=True)
    key = _upload(client, store)
    client.put("/v1/words/w1/photo", json={"key": key})
    res = client.put(
        "/v1/word-books/b1/words/w1",
        json={
            "id": "w1",
            "word_book_id": "b1",
            "term": "猫",
            "meaning": "고양이(수정)",
            "image_path": None,
            "created_at": _now(),
            "updated_at": _now(),
        },
    )
    assert res.status_code == 200
    assert res.json()["photo_url"] == f"https://r2.test/get/{key}"
    assert store.deleted == []


def test_deleting_word_or_book_deletes_photos(store: FakeStore, monkeypatch: pytest.MonkeyPatch) -> None:
    client, _ = _client(monkeypatch, premium=True)
    k1 = _upload(client, store, "w1")
    client.put("/v1/words/w1/photo", json={"key": k1})
    k2 = _upload(client, store, "w2")
    client.put("/v1/words/w2/photo", json={"key": k2})

    assert client.delete("/v1/word-books/b1/words/w1").status_code == 204
    assert store.deleted == [k1]
    assert client.delete("/v1/word-books/b1").status_code == 204
    assert store.deleted == [k1, k2]


def test_withdrawal_deletes_all_my_photos(store: FakeStore, monkeypatch: pytest.MonkeyPatch) -> None:
    client, user = _client(monkeypatch, premium=True)
    key = _upload(client, store)
    client.put("/v1/words/w1/photo", json={"key": key})
    store.files["u/someone-else/w/x/y.webp"] = 10
    monkeypatch.setattr(auth, "delete_user", lambda uid: None)

    assert client.delete("/v1/account").status_code == 204
    assert not any(k.startswith(f"u/{user}/") for k in store.files)
    assert "u/someone-else/w/x/y.webp" in store.files
