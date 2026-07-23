# Domain — WordBook · Word

```
WordBook (1) ──────< (N) Word
```

한 단어는 하나의 단어장에만 속한다.

---

## WordBook

| Field | Type | Required | Notes |
|-------|------|:--------:|-------|
| `id` | string | ✅ | 클라이언트 생성 UUID 권장 |
| `title` | string | ✅ | |
| `description` | string? | | |
| `created_at` | datetime | ✅ | |
| `updated_at` | datetime | ✅ | |
| `is_deleted` | bool | ✅ | soft delete |

**Computed (클라이언트)**

| Name | 계산 |
|------|------|
| `wordCount` | 활성 단어 수 |
| `memorizedCount` | 암기 단어 수 |
| `learningRate` | 암기율 0–100 |
| `metaLabel` | 목록용 `N개 · N%` |

---

## Word

| Field | Type | Required | Notes |
|-------|------|:--------:|-------|
| `id` | string | ✅ | |
| `word_book_id` | string | ✅ | |
| `term` | string | ✅ | |
| `meaning` | string | ✅ | |
| `pronunciation` | string? | | |
| `description` | string? | | |
| `example` | string? | | |
| `image_path` | string? | | 로컬 경로 또는 URL |
| `memorization_status` | enum | ✅ | `unmemorized` \| `memorized` |
| `is_bookmarked` | bool | ✅ | 기본 `false` |
| `tags` | string[] | ✅ | 기본 `[]`. 태그로 필터·검색용 |
| `created_at` | datetime | ✅ | |
| `updated_at` | datetime | ✅ | |
| `is_deleted` | bool | ✅ | soft delete |

---

## Rules

1. 새 단어 기본 상태: `unmemorized`
2. 내용·암기 상태 변경 시 `updated_at` 갱신
3. 삭제는 soft delete — 목록/암기율에서 제외
4. Hub 저장 시 PK는 `(id, user_id)` — 사용자별 격리
5. 동기화 충돌: `updated_at` 최신 wins
