# Nyaki — 단어장 도메인 모델 (v0.1)

> 범위: **단어장(WordBook) · 단어(Word)** 만.  
> 사용자·학습진도·기기·챗봇은 이후 단계에서 확장.

---

## 1. 개요

Nyaki의 핵심은 **단어장을 만들고, 그 안에 단어를 모아 두는 것**이다.  
현재 단계는 로컬 프로토타입을 위한 최소 도메인이며, 이후 Hub API로 옮겨도 같은 모델을 유지한다.

```
WordBook (1) ──────< (N) Word
```

- 한 단어장은 여러 단어를 가진다.
- 한 단어는 하나의 단어장에만 속한다. (v0.1)

---

## 2. ERD (논리)

```
┌─────────────────────────────┐
│         WordBook            │
├─────────────────────────────┤
│ PK  id           String     │
│     title        String     │
│     description  String?    │
│     createdAt    DateTime   │
│     updatedAt    DateTime   │
└──────────────┬──────────────┘
               │ 1
               │
               │ N
┌──────────────▼──────────────┐
│           Word              │
├─────────────────────────────┤
│ PK  id            String    │
│ FK  wordBookId    String    │
│     term          String    │  ← 단어 본문
│     meaning       String    │
│     pronunciation String?   │
│     description   String?   │
│     example       String?   │
│     imagePath     String?   │  ← 로컬 경로 (프로토타입)
│     memorizationStatus Enum  │  ← unmemorized / memorized
│     createdAt     DateTime  │
│     updatedAt     DateTime  │
│     isDeleted     bool      │  ← 소프트 삭제 (동기화 대비)
└─────────────────────────────┘
```

---

## 3. 엔티티 상세

### WordBook (단어장)

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `id` | String | ✅ | 고유 ID (UUID 등) |
| `title` | String | ✅ | 단어장 이름 |
| `description` | String? | | 설명 (선택) |
| `createdAt` | DateTime | ✅ | 생성 시각 |
| `updatedAt` | DateTime | ✅ | 마지막 수정 시각 |

**파생 값 (저장하지 않음)**

| 이름 | 계산 | 설명 |
|------|------|------|
| `wordCount` | `words` 중 `isDeleted == false` 개수 | 목록 메타에 표시 |
| `memorizedCount` | 활성 단어 중 `memorized` 개수 | 암기한 단어 수 |
| `learningRate` | `memorizedCount / wordCount * 100` | 암기율 |
| `metaLabel` | `'{wordCount}개'` 등 | UI용 라벨 |

> 현재 암기율은 단순한 2단계 상태에서 계산한다. 복습 주기·숙련도 등은 이후 학습 도메인으로 분리한다.

### Word (단어)

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `id` | String | ✅ | 고유 ID |
| `wordBookId` | String | ✅ | 소속 단어장 ID |
| `term` | String | ✅ | 단어/표현 |
| `meaning` | String | ✅ | 뜻 |
| `pronunciation` | String? | | 발음 |
| `description` | String? | | 부가 설명 |
| `example` | String? | | 예문 |
| `imagePath` | String? | | 이미지 (로컬 경로 → 이후 URL) |
| `memorizationStatus` | WordMemorizationStatus | ✅ | `unmemorized` 또는 `memorized` (기본 `unmemorized`) |
| `createdAt` | DateTime | ✅ | 생성 시각 |
| `updatedAt` | DateTime | ✅ | 마지막 수정 시각 |
| `isDeleted` | bool | ✅ | 소프트 삭제 여부 (기본 `false`) |

---

## 4. 관계 · 규칙

1. **WordBook 1 : N Word** — `Word.wordBookId`로 연결
2. 단어 추가 시 `wordBookId` 필수, `updatedAt` 갱신
3. 삭제는 물리 삭제 대신 `isDeleted = true` (로컬·서버 동기화 대비)
4. 목록/상세에는 `isDeleted == false` 만 노출
5. `id`는 클라이언트에서 생성해도 된다 (로컬 프로토타입 → 서버 이전 용이)
6. 새 단어의 암기 상태는 `unmemorized`로 시작하며 사용자가 `memorized`로 변경한다.

---

## 5. 저장 전략 (단계)

| 단계 | 저장소 | 비고 |
|------|--------|------|
| 지금 | Drift (SQLite) + `VocabRepository` | 기기 디스크 영속 저장 |
| 이후 | Hub API + 동일 계약 | 웹·기기·챗봇 공유 |

UI는 Repository만 보고, 구현체만 갈아끼운다.

---

## 6. 의도적으로 제외한 것 (이후)

- User / Auth
- LearningProgress / ReviewSchedule
- Device / SyncCursor
- ChatSession / Persona

단어장 코어가 안정된 뒤 붙인다.

---

## 7. 코드 매핑

| 도메인 | Dart |
|--------|------|
| WordBook | `lib/models/word_book.dart` |
| Word | `lib/models/word.dart` |
| 목업 데이터 | `lib/data/mock_vocab_data.dart` |
| 설계 문서 | `docs/domain.md` (본 파일) |
