"""카드 사진 저장소 — Cloudflare R2(S3 호환).

- 버킷은 비공개다. 올리기 · 보기 모두 서버가 서명한 짧은 주소로만 한다.
  사진 파일이 서버를 거치지 않는다(올리기는 브라우저 → R2 직접).
- 키는 `u/{uid}/w/{단어 id 해시}/{무작위 32자}.{확장자}` — 계정을 지울 때 `u/{uid}/`
  아래를 통째로 지우고, 붙일 때는 이 모양 그대로인지 정규식으로 검사한다.
- 브라우저는 먼저 `tmp/` 아래에 올린다. 붙일 때 서버가 크기를 보고 정식 자리로
  복사한다. 올리고 안 붙인 파일(고아) · 너무 큰 파일은 `tmp/`에 남았다가 R2 수명
  규칙(하루 뒤 삭제)으로 사라진다 — 서명 주소는 크기를 막지 못해서다.
- 지우기는 DB 커밋이 끝난 뒤에 한다(schedule_delete). 롤백되면 안 지운다.
"""

from __future__ import annotations

import hashlib
import logging
import re
import uuid
from functools import lru_cache
from typing import Protocol

from sqlalchemy import event
from sqlalchemy.orm import Session

from .config import get_settings

log = logging.getLogger(__name__)

# 브라우저가 줄여서 올리므로 보통 수백 KB다. 원본을 그대로 올리는 걸 막는 선.
MAX_PHOTO_BYTES = 2 * 1024 * 1024
PHOTO_TYPES = {"image/jpeg": "jpg", "image/png": "png", "image/webp": "webp"}
UPLOAD_URL_SECONDS = 5 * 60
VIEW_URL_SECONDS = 24 * 60 * 60
# 올리기는 여기 아래로만. R2 버킷에 "tmp/ 하루 뒤 삭제" 수명 규칙을 걸어 둔다.
TMP_PREFIX = "tmp/"


class PhotoStore(Protocol):
    def presign_put(self, key: str, content_type: str) -> str: ...
    def presign_get(self, key: str) -> str: ...
    def size(self, key: str) -> int | None: ...
    def delete(self, key: str) -> None: ...
    def delete_prefix(self, prefix: str) -> None: ...
    def copy(self, source: str, target: str) -> None: ...


class R2PhotoStore:
    def __init__(self, account_id: str, access_key_id: str, secret: str, bucket: str) -> None:
        import boto3
        from botocore.config import Config

        self.bucket = bucket
        self.client = boto3.client(
            "s3",
            endpoint_url=f"https://{account_id}.r2.cloudflarestorage.com",
            aws_access_key_id=access_key_id,
            aws_secret_access_key=secret,
            region_name="auto",
            config=Config(signature_version="s3v4"),
        )

    def presign_put(self, key: str, content_type: str) -> str:
        return self.client.generate_presigned_url(
            "put_object",
            Params={"Bucket": self.bucket, "Key": key, "ContentType": content_type},
            ExpiresIn=UPLOAD_URL_SECONDS,
        )

    def presign_get(self, key: str) -> str:
        return self.client.generate_presigned_url(
            "get_object",
            Params={"Bucket": self.bucket, "Key": key},
            ExpiresIn=VIEW_URL_SECONDS,
        )

    def size(self, key: str) -> int | None:
        from botocore.exceptions import ClientError

        try:
            head = self.client.head_object(Bucket=self.bucket, Key=key)
        except ClientError:
            return None
        return int(head["ContentLength"])

    def delete(self, key: str) -> None:
        self.client.delete_object(Bucket=self.bucket, Key=key)

    def copy(self, source: str, target: str) -> None:
        self.client.copy_object(
            Bucket=self.bucket,
            Key=target,
            CopySource={"Bucket": self.bucket, "Key": source},
        )

    def delete_prefix(self, prefix: str) -> None:
        paginator = self.client.get_paginator("list_objects_v2")
        for page in paginator.paginate(Bucket=self.bucket, Prefix=prefix):
            keys = [{"Key": item["Key"]} for item in page.get("Contents", [])]
            if keys:
                self.client.delete_objects(Bucket=self.bucket, Delete={"Objects": keys})


_override: PhotoStore | None = None
_use_override = False


def set_photo_store(store: PhotoStore | None) -> None:
    """테스트용 — 가짜 저장소를 끼운다. None을 주면 '저장소 없음'으로 둔다."""
    global _override, _use_override
    _override, _use_override = store, True


def reset_photo_store() -> None:
    global _override, _use_override
    _override, _use_override = None, False


@lru_cache
def _r2_store() -> R2PhotoStore:
    settings = get_settings()
    return R2PhotoStore(
        settings.r2_account_id,
        settings.r2_access_key_id,
        settings.r2_secret_access_key,
        settings.r2_bucket,
    )


def get_photo_store() -> PhotoStore | None:
    """설정이 비어 있으면 None — 사진 기능이 꺼진 서버다."""
    if _use_override:
        return _override
    return _r2_store() if get_settings().r2_configured else None


def has_card_photos(user_id: str) -> bool:
    """카드 사진을 쓸 수 있는가 — 유료 계정이고 저장소가 설정돼 있어야 한다.

    결제를 붙이면 여기만 바꾼다(PREMIUM_UIDS 대신 결제 상태).
    """
    return user_id in get_settings().premium_uid_list and get_photo_store() is not None


def word_prefix(user_id: str, word_id: str) -> str:
    # 단어 id는 클라이언트가 정한다 — 키에 그대로 넣지 않고 해시한다.
    digest = hashlib.sha256(word_id.encode()).hexdigest()[:16]
    return f"u/{user_id}/w/{digest}/"


def new_upload_key(user_id: str, word_id: str, content_type: str) -> str:
    """브라우저가 올릴 임시 자리. 붙이면 TMP_PREFIX를 뗀 정식 자리로 옮긴다."""
    name = f"{uuid.uuid4().hex}.{PHOTO_TYPES[content_type]}"
    return f"{TMP_PREFIX}{word_prefix(user_id, word_id)}{name}"


def final_key_for_upload(user_id: str, word_id: str, key: str) -> str | None:
    """이 사람 · 이 단어 앞으로 만든 업로드 키면 정식 키를, 아니면 None.

    앞부분만 보면 `…/../남의키` 같은 키가 통과한다 — 모양 전체를 맞춘다.
    """
    extensions = "|".join(PHOTO_TYPES.values())
    pattern = re.escape(TMP_PREFIX + word_prefix(user_id, word_id))
    pattern += rf"[0-9a-f]{{32}}\.(?:{extensions})"
    if not re.fullmatch(pattern, key):
        return None
    return key[len(TMP_PREFIX):]


def photo_url(key: str | None) -> str | None:
    if not key:
        return None
    store = get_photo_store()
    return store.presign_get(key) if store else None


# ------------------------- 커밋 뒤에 지우기 ------------------------- #

_PENDING = "nyaki_photo_deletes"


def schedule_delete(session: Session, key: str | None) -> None:
    if key:
        session.info.setdefault(_PENDING, set()).add(key)


@event.listens_for(Session, "after_commit")
def _delete_after_commit(session: Session) -> None:
    keys = session.info.pop(_PENDING, None)
    if not keys:
        return
    store = get_photo_store()
    if store is None:
        return
    for key in keys:
        try:
            store.delete(key)
        except Exception:  # 사진 하나 못 지웠다고 요청을 실패시키지 않는다.
            log.exception("photo delete failed: %s", key)


@event.listens_for(Session, "after_rollback")
def _forget_after_rollback(session: Session) -> None:
    session.info.pop(_PENDING, None)
