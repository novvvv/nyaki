"""카드 사진 — 유료 기능. R2 대신 가짜 저장소로 돈다.

여기서 지키는 것
- 유료 계정이 아니면 올리기 · 붙이기를 못 한다(403). 기능 표시도 false
- 저장소가 설정 안 된 서버면 유료 계정이어도 꺼져 있다
- 브라우저는 tmp/에 올리고, 붙이면 서버가 정식 자리(u/…)로 옮긴다. 응답엔 photo_url만
- 다른 사람 · 다른 단어 앞으로 만든 키, 모양이 다른 키(`../`, 대문자 확장자, tmp/ 아닌 키),
  안 올라온 키, 너무 큰 파일은 못 붙인다
- 같은 키로 다시 붙여도(응답이 끊겨 재시도) 그대로 성공한다
- 사진을 바꾸거나 빼면 예전 파일은 커밋 뒤에 지워진다
- 단어를 고쳐 저장해도(웹은 image_path를 null로 보낸다) 사진은 남는다
- 단어 · 단어장을 지우면 사진도 지워진다. 탈퇴하면 그 사람 파일이 tmp/까지 통째로 지워진다
"""

import uuid
from datetime import datetime, timezone

import pytest
from fastapi.testclient import TestClient
from firebase_admin import auth

from app.core.auth import get_current_user_id
from app.core.config import get_settings
from app.core.database import Base, engine
from app.core.photos import MAX_PHOTO_BYTES, reset_photo_store, set_photo_store, word_prefix
from app.main import app


class FakeStore:
    def __init__(self) -> None:
        self.files: dict[str, int] = {}

    def presign_put(self, key: str, content_type: str) -> str:
        return f"https://r2.test/put/{key}?type={content_type}"

    def presign_get(self, key: str) -> str:
        return f"https://r2.test/get/{key}"

    def size(self, key: str) -> int | None:
        return self.files.get(key)

    def delete(self, key: str) -> None:
        self.files.pop(key, None)

    def delete_prefix(self, prefix: str) -> None:
        for key in [k for k in self.files if k.startswith(prefix)]:
            self.delete(key)

    def copy(self, source: str, target: str) -> None:
        self.files[target] = self.files[source]


@pytest.fixture
def store():
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
    """올리기 주소를 받고 브라우저가 tmp/에 올린 상태까지. 업로드 키를 돌려준다."""
    res = client.post(
        f"/v1/words/{word_id}/photo/upload-url",
        json={"content_type": "image/webp", "size": size},
    )
    assert res.status_code == 200, res.text
    key = res.json()["key"]
    store.files[key] = size
    return key


def _attach(client: TestClient, store: FakeStore, word_id: str = "w1") -> str:
    """올리고 붙이기까지. 정식 키를 돌려준다."""
    key = _upload(client, store, word_id)
    res = client.put(f"/v1/words/{word_id}/photo", json={"key": key})
    assert res.status_code == 200, res.text
    return key.removeprefix("tmp/")


def _words(client: TestClient) -> dict[str, dict]:
    return {w["id"]: w for w in client.get("/v1/word-books/b1/words").json()}


def test_free_account_is_locked(store: FakeStore, monkeypatch: pytest.MonkeyPatch) -> None:
    client, _ = _client(monkeypatch, premium=False)
    assert client.get("/v1/me/features").json() == {"card_photos": False}
    res = client.post("/v1/words/w1/photo/upload-url", json={"content_type": "image/webp", "size": 10})
    assert res.status_code == 403
    assert res.json()["detail"] == "프리미엄에서 쓸 수 있는 기능이에요."
    assert client.put("/v1/words/w1/photo", json={"key": "tmp/u/x/w/y/z.webp"}).status_code == 403


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


def test_upload_goes_to_tmp_and_attach_moves_it(store: FakeStore, monkeypatch: pytest.MonkeyPatch) -> None:
    client, user = _client(monkeypatch, premium=True)
    assert client.get("/v1/me/features").json() == {"card_photos": True}
    upload_key = _upload(client, store)
    assert upload_key.startswith(f"tmp/u/{user}/w/") and upload_key.endswith(".webp")

    res = client.put("/v1/words/w1/photo", json={"key": upload_key})
    final = upload_key.removeprefix("tmp/")
    assert res.status_code == 200
    assert res.json()["photo_url"] == f"https://r2.test/get/{final}"
    assert "photo_key" not in res.json()
    assert final in store.files and upload_key not in store.files
    words = _words(client)
    assert words["w1"]["photo_url"] == f"https://r2.test/get/{final}"
    assert words["w2"]["photo_url"] is None


def test_attaching_again_after_dropped_response_succeeds(
    store: FakeStore, monkeypatch: pytest.MonkeyPatch
) -> None:
    client, _ = _client(monkeypatch, premium=True)
    upload_key = _upload(client, store)
    first = client.put("/v1/words/w1/photo", json={"key": upload_key})
    again = client.put("/v1/words/w1/photo", json={"key": upload_key})
    assert again.status_code == 200
    assert again.json()["photo_url"] == first.json()["photo_url"]
    assert upload_key.removeprefix("tmp/") in store.files


def test_upload_rejects_bad_type_and_size(store: FakeStore, monkeypatch: pytest.MonkeyPatch) -> None:
    client, _ = _client(monkeypatch, premium=True)
    for content_type in ("image/gif", "text/html", "image/svg+xml"):
        res = client.post("/v1/words/w1/photo/upload-url", json={"content_type": content_type, "size": 10})
        assert res.status_code == 422, content_type
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


@pytest.mark.security
def test_only_exact_upload_key_shape_is_accepted(store: FakeStore, monkeypatch: pytest.MonkeyPatch) -> None:
    client, user = _client(monkeypatch, premium=True)
    good = _upload(client, store)
    prefix = "tmp/" + word_prefix(user, "w1")
    bad_keys = [
        good.removeprefix("tmp/"),  # 정식 자리를 직접
        good + "x",
        good[:-5] + ".WEBP",
        prefix + "../../../u/stranger/w/x/" + good[-37:],
        prefix + "%2e%2e/" + good[-37:],
        prefix + "a" * 31 + ".webp",
    ]
    for key in bad_keys:
        store.files[key] = 10  # 있어도 모양이 틀리면 안 된다
        assert client.put("/v1/words/w1/photo", json={"key": key}).status_code == 400, key


def test_oversized_upload_is_rejected_and_removed(store: FakeStore, monkeypatch: pytest.MonkeyPatch) -> None:
    client, _ = _client(monkeypatch, premium=True)
    key = _upload(client, store)
    store.files[key] = MAX_PHOTO_BYTES + 1  # 알린 크기보다 크게 올렸다
    assert client.put("/v1/words/w1/photo", json={"key": key}).status_code == 413
    assert key not in store.files
    assert key.removeprefix("tmp/") not in store.files


def test_replace_and_remove_delete_old_file(store: FakeStore, monkeypatch: pytest.MonkeyPatch) -> None:
    client, _ = _client(monkeypatch, premium=True)
    first = _attach(client, store)
    second = _attach(client, store)
    assert first not in store.files and second in store.files

    res = client.delete("/v1/words/w1/photo")
    assert res.status_code == 200 and res.json()["photo_url"] is None
    assert second not in store.files


def test_remove_works_after_premium_ends(store: FakeStore, monkeypatch: pytest.MonkeyPatch) -> None:
    client, _ = _client(monkeypatch, premium=True)
    key = _attach(client, store)
    monkeypatch.setattr(get_settings(), "premium_uids", "")
    assert client.delete("/v1/words/w1/photo").status_code == 200
    assert key not in store.files


def test_editing_word_keeps_photo(store: FakeStore, monkeypatch: pytest.MonkeyPatch) -> None:
    client, _ = _client(monkeypatch, premium=True)
    key = _attach(client, store)
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
    assert key in store.files


def test_deleting_word_or_book_deletes_photos(store: FakeStore, monkeypatch: pytest.MonkeyPatch) -> None:
    client, _ = _client(monkeypatch, premium=True)
    k1 = _attach(client, store, "w1")
    k2 = _attach(client, store, "w2")

    assert client.delete("/v1/word-books/b1/words/w1").status_code == 204
    assert k1 not in store.files and k2 in store.files
    assert client.delete("/v1/word-books/b1").status_code == 204
    assert k2 not in store.files


def test_withdrawal_deletes_all_my_photos(store: FakeStore, monkeypatch: pytest.MonkeyPatch) -> None:
    client, user = _client(monkeypatch, premium=True)
    _attach(client, store)
    _upload(client, store)  # 올리고 안 붙인 것
    store.files["u/someone-else/w/x/y.webp"] = 10
    store.files["tmp/u/someone-else/w/x/y.webp"] = 10
    monkeypatch.setattr(auth, "delete_user", lambda uid: None)

    assert client.delete("/v1/account").status_code == 204
    assert not any(user in k for k in store.files)
    assert "u/someone-else/w/x/y.webp" in store.files
    assert "tmp/u/someone-else/w/x/y.webp" in store.files
