# Nyaki Hub API

> Base URL: `/v1` · Auth: `Authorization: Bearer <Firebase ID token>`  
> Content-Type: `application/json` · 시각: ISO 8601

모든 `/v1/*` 데이터는 **토큰의 Firebase UID (`user_id`)** 로 격리된다.

OpenAPI(Swagger): `{base}/docs` · Health: `GET /health`

---

## Auth

```http
Authorization: Bearer <Firebase ID token>
```

| HTTP | 의미 |
|------|------|
| 401 | 토큰 없음 / 유효하지 않음 |
| 404 | 리소스 없음(또는 삭제됨) |
| 400 | URL·payload ID 불일치 등 |

---

## Resources

### WordBook

| Method | Path | 설명 |
|--------|------|------|
| GET | `/v1/word-books` | 목록 (`is_deleted = false`) |
| PUT | `/v1/word-books/{id}` | upsert |
| DELETE | `/v1/word-books/{id}` | soft delete (+ 하위 단어 tombstone) |

**Body (PUT)**

```json
{
  "id": "uuid",
  "title": "토익",
  "description": null,
  "created_at": "2026-07-22T01:00:00Z",
  "updated_at": "2026-07-22T01:00:00Z",
  "is_deleted": false
}
```

### Word

| Method | Path | 설명 |
|--------|------|------|
| GET | `/v1/word-books/{bookId}/words` | 목록 |
| PUT | `/v1/word-books/{bookId}/words/{wordId}` | upsert |
| DELETE | `/v1/word-books/{bookId}/words/{wordId}` | soft delete |

**Body (PUT)**

```json
{
  "id": "uuid",
  "word_book_id": "book-uuid",
  "term": "apple",
  "meaning": "사과",
  "pronunciation": null,
  "description": null,
  "example": null,
  "image_path": null,
  "memorization_status": "unmemorized",
  "created_at": "2026-07-22T01:00:00Z",
  "updated_at": "2026-07-22T01:00:00Z",
  "is_deleted": false
}
```

`memorization_status`: `unmemorized` | `memorized`

---

## Sync (모바일)

앱은 로컬(Drift) 변경을 outbox에 쌓은 뒤 Hub와 맞춘다.

### `POST /v1/sync/push`

최대 100건 mutation 업로드.

```json
{
  "changes": [
    {
      "entity_type": "word",
      "action": "upsert",
      "word": { "...Word payload..." }
    },
    {
      "entity_type": "word_book",
      "action": "delete",
      "word_book": { "...WordBook payload..." }
    }
  ]
}
```

**Response**

```json
{ "cursor": 42, "accepted": 2 }
```

### `GET /v1/sync/pull?cursor=0`

해당 cursor **이후** 변경분 (최대 500).

**Response**

```json
{
  "cursor": 42,
  "changes": [
    {
      "cursor": 41,
      "entity_type": "word_book",
      "word_book": { "...현재 스냅샷..." }
    }
  ]
}
```

클라이언트가 받은 `cursor`를 저장해 다음 pull에 사용한다.

---

## Rules

1. **Soft delete** — `is_deleted = true`
2. **Conflict** — 같은 id면 `updated_at`이 더 최신인 쪽만 반영
3. **Change log** — 반영된 변경마다 `sync_changes.cursor` 증가
4. **Web** — REST CRUD 직접 호출
5. **App** — 로컬 우선 + push/pull

---

## Clients

| Client | 방식 |
|--------|------|
| Next.js 웹 | REST CRUD |
| Flutter 앱 | `POST /sync/push` + `GET /sync/pull` |
