# API

> 전체 엔드포인트 목록. 필드 형식은 서버의 `/docs`(OpenAPI)가 정확하다.
> 설명이 필요한 API만 [api/](api/)에 상세 문서를 둔다.

## 기본

| | |
|---|---|
| Base URL | `https://api.nyangki.com` (로컬 `http://localhost:8000`) |
| 경로 | `/v1/...` |
| 인증 | `Authorization: Bearer <Firebase ID token>` |
| 형식 | JSON · snake_case · ISO 8601 (UTC) |
| OpenAPI | `/docs` · `/openapi.json` |

## 에러

`{ "detail": "메시지" }`

| 코드 | 의미 |
|---|---|
| 400 | URL과 본문 ID 불일치 · 잘못된 요청 |
| 401 | 토큰 없음 · 무효 |
| 403 | 관리자 전용 |
| 404 | 없음 · 삭제됨 |
| 409 | 이미 있음 |
| 422 | 검증 실패 |

## 쓰기 규칙

- ID는 클라이언트가 만든다. 생성·수정 모두 `PUT`.
- `updated_at`이 서버 값보다 새로울 때만 반영된다.
- 보낸 필드만 바뀐다.
- 삭제는 `is_deleted = true`로 표시한다.
- 폴더 삭제 → 안의 단어장까지 삭제. 단어장 삭제 → 안의 단어·카드까지 삭제.

---

## 엔드포인트

### 상태

| Method | Path | 설명 | 상세 |
|---|---|---|---|
| GET | `/health` | 서버 확인 (인증 없음) | |

### 계정

| Method | Path | 설명 | 상세 |
|---|---|---|---|
| DELETE | `/v1/account` | 회원 탈퇴. 내 데이터 전부를 실제로 지우고 Firebase 계정까지 삭제. 되돌릴 수 없음 | |

### 폴더

| Method | Path | 설명 | 상세 |
|---|---|---|---|
| GET | `/v1/folders` | 목록 | |
| PUT | `/v1/folders/{folder_id}` | 생성 · 수정 | |
| DELETE | `/v1/folders/{folder_id}` | 삭제 | |

### 단어장

| Method | Path | 설명 | 상세 |
|---|---|---|---|
| GET | `/v1/word-books` | 목록 | |
| PUT | `/v1/word-books/{word_book_id}` | 생성 · 수정 | |
| DELETE | `/v1/word-books/{word_book_id}` | 삭제 | |
| GET | `/v1/word-books/summaries` | 단어장별 항목 수 · 카드 수 · 암기율(OK 비율) · 암기 단계별 카드 수(`stages`, 6칸) | |

### 단어

| Method | Path | 설명 | 상세 |
|---|---|---|---|
| GET | `/v1/word-books/{word_book_id}/words` | 목록 | |
| PUT | `/v1/word-books/{word_book_id}/words/{word_id}` | 생성 · 수정 | |
| DELETE | `/v1/word-books/{word_book_id}/words/{word_id}` | 삭제 | |

### 단어 묶음

| Method | Path | 설명 | 상세 |
|---|---|---|---|
| POST | `/v1/pack-imports` | 묶음을 단어장에 담기 | [→](api/pack-imports.md) |
| GET | `/v1/pack-imports` | 내가 담은 묶음 목록 | [→](api/pack-imports.md) |

### 빈칸 노트

| Method | Path | 설명 | 상세 |
|---|---|---|---|
| GET | `/v1/word-books/{word_book_id}/cloze-notes` | 목록 | |
| PUT | `/v1/word-books/{word_book_id}/cloze-notes/{note_id}` | 생성 · 수정 | |
| DELETE | `/v1/word-books/{word_book_id}/cloze-notes/{note_id}` | 삭제 | |

### 통계

| Method | Path | 설명 | 상세 |
|---|---|---|---|
| GET | `/v1/stats/daily-added?days=&tz_offset=` | 날짜별 추가 개수. `tz_offset`은 분 단위 (KST 540) | |
| GET | `/v1/stats/daily-reviewed?days=30&tz_offset=` | 날짜별 복습한 카드 수. 같은 카드를 하루에 여러 번 채점해도 1개. `days` 1~366 | |

### 복습

| Method | Path | 설명 | 상세 |
|---|---|---|---|
| GET | `/v1/review/due?limit=50` | 오늘 낼 카드 (하루 한도 적용) | |
| GET | `/v1/review/due/count` | 오늘 낼 카드 개수 (단어장별) | |
| POST | `/v1/review/grades` | 채점 결과 일괄 전송 (최대 100건, 재전송 안전) | |

### 진행도

| Method | Path | 설명 | 상세 |
|---|---|---|---|
| GET | `/v1/progress` | 잔액 · 오늘 완료한 퀘스트 · 설정 | |
| PUT | `/v1/progress/settings` | 하루 한도 · 복습 단계 변경 | |
| POST | `/v1/progress/quests/{quest_id}/complete` | 퀘스트 완료 (하루 1회, 재전송 안전) | |

| `quest_id` | 보상 | 시간 (KST) |
|---|---|---|
| `pet_cat` | 츄르 5 | 언제나 |
| `add_word` | 츄르 5 | 언제나 |
| `morning_review` | 열빙어 1 | 6~14시 |
| `evening_review` | 열빙어 1 | 18~24시 |

### 동기화

| Method | Path | 설명 | 상세 |
|---|---|---|---|
| POST | `/v1/sync/push` | 변경 일괄 업로드 (최대 100건, 한 트랜잭션) | |
| GET | `/v1/sync/pull?cursor=` | cursor 이후 변경 (최대 500건) | |

`entity_type`: `folder` · `word_book` · `word` · `card` · `cloze_note` / `action`: `upsert` · `delete`

### 콘텐츠

조회는 인증 없음, 쓰기·삭제는 관리자만.

| Method | Path | 설명 | 상세 |
|---|---|---|---|
| GET | `/v1/content/artists` | 아티스트 목록 | |
| GET · PUT · DELETE | `/v1/content/artists/{artist_slug}` | 아티스트 | |
| GET | `/v1/content/posts?artist_slug=&kind=` | 글 목록 | |
| GET · PUT · DELETE | `/v1/content/artists/{artist_slug}/posts/{post_slug}` | 아티스트 글 | |
| GET · PUT · DELETE | `/v1/content/posts/{slug}` | 공지 · 메모 | |

---

## 한도

| 항목 | 한도 |
|---|---|
| `sync/push` · `review/grades` | 100건 |
| `pack-imports` 단어 | 500개 |
| `sync/pull` | 500건 |
| `review/due` `limit` | 9999 |
| ID | 80자 (카드 120자) |
| 단어장 · 폴더 이름 | 200자 |
| 단어 `term` | 500자 |
