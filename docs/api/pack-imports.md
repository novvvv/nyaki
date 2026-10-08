# 단어 묶음 담기

> 단어 다운로드의 "내 단어장에 담기".
> 서버: `api/app/vocab/routes.py` · `services.py` · 테스트 `api/tests/vocab/library/test_pack_imports.py`
> 기본 정보(주소·인증·에러 형식)는 [API.md](../API.md).

## 엔드포인트

| Method | Path | 설명 |
|---|---|---|
| POST | `/v1/pack-imports` | 묶음을 단어장에 담는다 |
| GET | `/v1/pack-imports` | 내가 담은 묶음 목록 |

---

## POST /v1/pack-imports

단어장 생성(새 단어장일 때) · 단어 추가 · 담은 기록을 **한 트랜잭션**으로 처리한다. 전부 되거나 하나도 안 된다.

### 요청

```json
{
  "id": "import_8f3a…",
  "pack_id": "conan-highway-last-dance",
  "word_book_id": "book_2c1e…",
  "word_book": {
    "id": "book_2c1e…",
    "title": "라스트 댄스 그대와 함께",
    "folder_id": null,
    "created_at": "2026-10-06T09:00:00Z",
    "updated_at": "2026-10-06T09:00:00Z"
  },
  "words": [
    {
      "id": "word_91ab…",
      "word_book_id": "book_2c1e…",
      "term": "揺れる",
      "pronunciation": "ゆれる",
      "meaning": "흔들리다",
      "created_at": "2026-10-06T09:00:00Z",
      "updated_at": "2026-10-06T09:00:00Z"
    }
  ]
}
```

| 필드 | 필수 | 설명 |
|---|---|---|
| `id` | ✓ | 담기 기록 ID. 클라이언트가 만든다 |
| `pack_id` | ✓ | 묶음 ID (`web/src/lib/packs.ts`) |
| `word_book_id` | ✓ | 담을 단어장 ID |
| `word_book` | | **새 단어장일 때만** 보낸다. `id`는 `word_book_id`와 같아야 한다 |
| `words` | ✓ | 담을 단어. 1~500개. 각 `word_book_id`는 위 `word_book_id`와 같아야 한다 |

- 기존 단어장에 담을 때는 `word_book`을 빼고 `word_book_id`만 보낸다.
- 단어 필드는 단어 `PUT`과 같다. 묶음의 레벨(N1~N5)은 보내지 않는다.
- 이미 같은 단어가 단어장에 있어도 **그대로 추가한다.** 중복 경고는 화면이 `GET`으로 판단한다.

### 응답

`201 Created`

```json
{
  "id": "import_8f3a…",
  "pack_id": "conan-highway-last-dance",
  "word_book_id": "book_2c1e…",
  "word_count": 52,
  "imported_at": "2026-10-06T09:00:01Z"
}
```

**재전송:** 같은 `id`로 다시 보내면 아무것도 추가하지 않고 처음 기록을 `200 OK`로 돌려준다. 응답이 끊겨 다시 보내도 단어가 두 번 들어가지 않는다.

### 에러

| 코드 | 언제 |
|---|---|
| 400 | `word_book.id` ≠ `word_book_id` · 단어의 `word_book_id`가 다름 |
| 404 | `word_book` 없이 보냈는데 그 단어장이 없음 · 삭제됨 · 남의 것 |
| 409 | `word_book`을 보냈는데 같은 ID의 단어장이 이미 있음 |
| 422 | 필수 필드 누락 · 단어 0개 또는 500개 초과 |

---

## GET /v1/pack-imports

내가 담은 묶음 목록. 최근 순.

### 응답

`200 OK`

```json
[
  {
    "id": "import_8f3a…",
    "pack_id": "conan-highway-last-dance",
    "word_book_id": "book_2c1e…",
    "word_count": 52,
    "imported_at": "2026-10-06T09:00:01Z"
  }
]
```

- **담은 단어장이 지워졌으면 빠진다.** 단어장을 지우면 경고도 사라진다.
- 같은 묶음을 여러 단어장에 담았으면 각각 한 줄씩 온다.

---

## 화면에서 쓰는 법

| 화면 | 표시 |
|---|---|
| 목록 (`/downloads`) | 목록에 `pack_id`가 있으면 카드에 "담음" |
| 상세 (`/downloads/[id]`) | "이미 「단어장 이름」에 담았어요" |
| 담기 (`/downloads/[id]/save`) | 담기 버튼 위 경고. 담기는 막지 않는다 |

단어장 이름은 `word_book_id`로 내 단어장 목록에서 찾는다.

## 동기화

담은 단어장·단어는 동기화 기록에 남아 앱이 `GET /v1/sync/pull`로 받는다. 담기 기록(`pack_imports`)은 동기화하지 않는다.
