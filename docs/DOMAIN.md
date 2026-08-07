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
| `memorization_status` | enum | ✅ | `unmemorized` \| `memorized` — SRS 채점의 부수 효과로 갱신됨 (아래 SRS 참고) |
| `is_bookmarked` | bool | ✅ | 기본 `false` |
| `tags` | string[] | ✅ | 기본 `[]`. 태그로 필터·검색용 |
| `srs_ease_factor` | float | ✅ | SM-2 ease, 기본 `2.5` |
| `srs_interval_days` | int | ✅ | 다음 복습까지 간격(일), 기본 `0` |
| `srs_repetitions` | int | ✅ | 연속 성공 횟수, 기본 `0` |
| `srs_lapses` | int | ✅ | 실패(모름) 누적 횟수, 기본 `0` |
| `srs_due_at` | datetime | ✅ | 다음 복습 예정 시각, 기본 `created_at` (즉시 due) |
| `srs_last_reviewed_at` | datetime? | | 마지막 채점 시각 |
| `created_at` | datetime | ✅ | |
| `updated_at` | datetime | ✅ | |
| `is_deleted` | bool | ✅ | soft delete |

---

## SRS (복습 스케줄)

계산 규칙·제품 결정은 [SRS.md](SRS.md) 참고. 요약:

- 학습자 입력은 **모름 / 외움** 두 가지뿐 (내부적으로 SM-2의 `Again` / `Good`)
- `memorization_status`는 SRS 채점의 부수 효과: 모름 → 즉시 `unmemorized`, 외움이고 `srs_repetitions >= 2` → `memorized`
- 복습 큐는 `srs_due_at <= now`인 단어 (`is_deleted = false`) — 새 sync entity 없이 `Word` 컬럼에만 저장

---

## Rules

1. 새 단어 기본 상태: `unmemorized`, SRS는 즉시 due
2. 내용·암기 상태·SRS 채점 변경 시 `updated_at` 갱신
3. 삭제는 soft delete — 목록/암기율/복습 큐에서 제외
4. Hub 저장 시 PK는 `(id, user_id)` — 사용자별 격리
5. 동기화 충돌: `updated_at` 최신 wins (row 전체 단위 — SRS 필드도 예외 아님)
