# Nyaki Vocab API 명세 (v0.1)

> 현재 앱 구현: `VocabRepository` 인터페이스 + `DriftVocabRepository` (SQLite)  
> 이 문서는 이후 Hub API(REST)로 옮길 때의 **목표 계약**이다.

## 공통

- Base URL (예정): `/api/v1`
- Content-Type: `application/json`
- 시간 필드: ISO 8601 (`2026-07-17T18:00:00Z`)
- ID: 문자열 UUID 또는 `{prefix}-{timestamp}` 형식
- 삭제: 단어는 **소프트 삭제** (`isDeleted: true`), 단어장은 **물리 삭제**

### 공통 에러

| HTTP | code | 설명 |
|------|------|------|
| 400 | `VALIDATION_ERROR` | 필수값 누락, 빈 문자열 |
| 404 | `NOT_FOUND` | 단어장/단어 없음 |
| 500 | `INTERNAL_ERROR` | 서버 오류 |

---

## WordBook API

### GET `/word-books`

단어장 목록 조회

**Response 200**

```json
{
  "items": [
    {
      "id": "default-nyaki",
      "title": "냥키",
      "description": "Nyaki 기본 단어장",
      "createdAt": "2026-07-17T09:00:00Z",
      "updatedAt": "2026-07-17T09:00:00Z",
      "wordCount": 0,
      "memorizedCount": 0,
      "learningRate": 0
    }
  ]
}
```

앱 매핑: `VocabRepository.listWordBooks()`

---

### GET `/word-books/{wordBookId}`

단어장 단건 조회 (단어 포함)

**Response 200**

```json
{
  "id": "default-nyaki",
  "title": "냥키",
  "description": "Nyaki 기본 단어장",
  "createdAt": "2026-07-17T09:00:00Z",
  "updatedAt": "2026-07-17T09:00:00Z",
  "words": []
}
```

앱 매핑: `VocabRepository.getWordBook(id)`

---

### POST `/word-books`

단어장 생성

**Request**

```json
{
  "title": "토익 필수",
  "description": "선택 설명"
}
```

| 필드 | 필수 | 설명 |
|------|:----:|------|
| `title` | ✅ | 단어장 이름 |
| `description` | | 설명 |

**Response 201**: 생성된 WordBook

앱 매핑: `VocabRepository.createWordBook(CreateWordBookInput)`

---

### PATCH `/word-books/{wordBookId}`

단어장 수정

**Request**

```json
{
  "title": "새 이름",
  "description": "새 설명"
}
```

모든 필드는 선택. 보낸 필드만 갱신.

**Response 200**: 수정된 WordBook

앱 매핑: `VocabRepository.updateWordBook(id, UpdateWordBookInput)`

---

### DELETE `/word-books/{wordBookId}`

단어장 삭제

**Response 204**: No Content

앱 매핑: `VocabRepository.deleteWordBook(id)`

---

## Word API

### GET `/word-books/{wordBookId}/words`

단어장의 활성 단어 목록 (`isDeleted == false`)

**Response 200**

```json
{
  "items": [
    {
      "id": "word-1",
      "wordBookId": "default-nyaki",
      "term": "cat",
      "meaning": "고양이",
      "pronunciation": null,
      "description": null,
      "example": null,
      "imagePath": null,
      "memorizationStatus": "unmemorized",
      "createdAt": "2026-07-17T09:00:00Z",
      "updatedAt": "2026-07-17T09:00:00Z",
      "isDeleted": false
    }
  ]
}
```

앱 매핑: `VocabRepository.listWords(wordBookId)`

---

### GET `/word-books/{wordBookId}/words/{wordId}`

단어 단건 조회

**Response 200**: Word 객체

앱 매핑: `VocabRepository.getWord(wordBookId, wordId)`

---

### POST `/word-books/{wordBookId}/words`

단어 추가

**Request**

```json
{
  "term": "cat",
  "meaning": "고양이",
  "pronunciation": "/kæt/",
  "description": "설명",
  "example": "I have a cat.",
  "imagePath": null
}
```

| 필드 | 필수 | 설명 |
|------|:----:|------|
| `term` | ✅ | 단어 |
| `meaning` | ✅ | 의미 |
| `pronunciation` | | 발음 |
| `description` | | 설명 |
| `example` | | 예문 |
| `imagePath` | | 이미지 경로/URL |

- `memorizationStatus` 기본값: `unmemorized`

**Response 201**: 생성된 Word

앱 매핑: `VocabRepository.createWord(CreateWordInput)`

---

### PATCH `/word-books/{wordBookId}/words/{wordId}`

단어 수정 (암기 상태 변경 포함)

**Request**

```json
{
  "term": "cat",
  "meaning": "고양이",
  "pronunciation": "/kæt/",
  "description": "설명",
  "example": "I have a cat.",
  "imagePath": null,
  "memorizationStatus": "memorized"
}
```

| `memorizationStatus` | 값 |
|----------------------|-----|
| 미암기 | `unmemorized` |
| 암기 | `memorized` |

**Response 200**: 수정된 Word

앱 매핑: `VocabRepository.updateWord(wordBookId, wordId, UpdateWordInput)`

---

### DELETE `/word-books/{wordBookId}/words/{wordId}`

단어 소프트 삭제

**Response 204**: No Content  
실제로는 `isDeleted: true`로 변경

앱 매핑: `VocabRepository.deleteWord(wordBookId, wordId)`

---

## 초기화 규칙

앱 최초 실행 시 단어장이 없으면 기본 단어장을 생성한다.

| 필드 | 값 |
|------|-----|
| `id` | `default-nyaki` |
| `title` | `냥키` |
| `description` | `Nyaki 기본 단어장` |

앱 매핑: `VocabRepository.ensureInitialized()`

---

## 앱 코드 매핑

| 레이어 | 파일 |
|--------|------|
| 계약 (Interface) | `lib/data/repositories/vocab_repository.dart` |
| 현재 구현 (Drift/SQLite) | `lib/data/repositories/drift_vocab_repository.dart` |
| DB 스키마 | `lib/data/local/tables.dart`, `app_database.dart` |
| UI 상태 | `lib/data/vocab_controller.dart` |
| DI / Scope | `lib/core/nyaki_scope.dart` |

이후 Hub API 구현 시 `ApiVocabRepository`를 추가하고 `main.dart`에서 교체한다.  
테스트용으로는 `InMemoryVocabRepository` 또는 `AppDatabase.forTesting()`을 사용한다.
