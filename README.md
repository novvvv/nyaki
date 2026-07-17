# Nyaki

언어학습을 위한 미니멀 단어장 앱.  
Flutter로 모바일 클라이언트를 만들고, 이후 자체 Hub API로 웹·임베디드·챗봇까지 확장하는 것을 목표로 한다.

## 현재 상태

- UI 프로토타입 (홈 / 퀘스트 / 단어장 / 단어 추가)
- **단어장·단어 CRUD** (`VocabRepository` + **Drift/SQLite** 로컬 DB)
- 앱 시작 시 기본 단어장 **`냥키`** 자동 생성 (DB에 없을 때만)
- 데이터는 **기기 디스크**에 저장되어 앱 재실행 후에도 유지
- Hub API · 로그인 미구현

API 명세: [docs/API.md](docs/API.md)

## 단어장 도메인 (요약)

```
WordBook (1) ──< (N) Word
```

### WordBookEntity

단어장 자체를 나타낸다. 하나의 단어장은 여러 `WordEntity`를 가진다.

| 속성 | 타입 | 필수 | 기본값 | 설명 |
|------|------|:----:|--------|------|
| `id` | `String` | ✅ | 없음 | 단어장 고유 식별자. 로컬과 서버에서 동일하게 사용할 UUID 등을 권장 |
| `title` | `String` | ✅ | 없음 | 사용자에게 표시되는 단어장 이름 |
| `description` | `String?` | | `null` | 단어장에 대한 선택 설명 |
| `createdAt` | `DateTime` | ✅ | 없음 | 단어장이 처음 생성된 시각 |
| `updatedAt` | `DateTime` | ✅ | 없음 | 제목 변경이나 단어 추가 등 마지막 수정 시각 |
| `words` | `List<Word>` | | 빈 목록 | 단어장에 속한 단어 목록 |

다음 값은 DB에 별도로 저장하지 않고 `words`에서 계산한다.

| 계산 속성 | 타입 | 계산 방식 | 설명 |
|----------|------|-----------|------|
| `activeWords` | `List<Word>` | `isDeleted == false` | 삭제되지 않은 단어 목록 |
| `wordCount` | `int` | `activeWords.length` | 현재 단어 수 |
| `memorizedCount` | `int` | 암기 상태인 활성 단어 수 | 암기 완료 개수 |
| `learningRate` | `int` | `memorizedCount / wordCount × 100` | 0~100 범위의 암기율 |
| `metaLabel` | `String` | 단어 수와 암기율 조합 | 목록 화면용 문구 |

### WordEntity

실제 단어 또는 표현 하나를 나타내며, `wordBookId`로 소속 단어장과 연결된다.

| 속성 | 타입 | 필수 | 기본값 | 설명 |
|------|------|:----:|--------|------|
| `id` | `String` | ✅ | 없음 | 단어 고유 식별자 |
| `wordBookId` | `String` | ✅ | 없음 | 이 단어가 속한 단어장의 `id` |
| `term` | `String` | ✅ | 없음 | 학습할 단어 또는 표현 본문 |
| `meaning` | `String` | ✅ | 없음 | 단어의 뜻 |
| `pronunciation` | `String?` | | `null` | 발음 또는 발음기호 |
| `description` | `String?` | | `null` | 어원, 용법 등 추가 설명 |
| `example` | `String?` | | `null` | 단어가 사용된 예문 |
| `imagePath` | `String?` | | `null` | 프로토타입에서는 로컬 이미지 경로, 서버 이전 후에는 이미지 URL |
| `memorizationStatus` | `WordMemorizationStatus` | ✅ | `unmemorized` | `unmemorized`(미암기) 또는 `memorized`(암기) |
| `createdAt` | `DateTime` | ✅ | 없음 | 단어가 처음 생성된 시각 |
| `updatedAt` | `DateTime` | ✅ | 없음 | 내용이나 암기 상태가 마지막으로 변경된 시각 |
| `isDeleted` | `bool` | ✅ | `false` | 동기화를 고려한 소프트 삭제 여부 |

`isMemorized`는 `memorizationStatus == memorized`인지 알려주는 계산 속성이다.

### 관계와 기본 규칙

1. `WordBookEntity 1 : N WordEntity`
2. 새 단어는 `unmemorized` 상태로 시작한다.
3. 단어를 수정하거나 암기 상태를 바꾸면 `updatedAt`도 갱신한다.
4. 삭제 시 즉시 데이터를 제거하지 않고 `isDeleted = true`로 변경한다.
5. 목록과 암기율 계산에서는 삭제된 단어를 제외한다.
6. 복습 주기·사용자·동기화는 이후 별도 도메인으로 분리한다.

상세 설계: [docs/domain.md](docs/domain.md)

## 로드맵 (간단)

1. **도메인 + 로컬 CRUD (Drift)** ← 지금
2. Hub API (자체 백엔드)로 이전
3. 웹 / 임베디드 / 챗봇 연동

## 실행

```bash
flutter pub get
dart run build_runner build --delete-conflicting-outputs
flutter run
```

## 프로젝트 구조 (핵심)

```
lib/
  models/          # WordBook, Word
  data/
    local/         # Drift DB (SQLite)
    repositories/  # VocabRepository, Drift 구현
    vocab_controller.dart
  screens/         # 화면
  widgets/         # UI 조각
  core/theme/      # 색·테마
  core/nyaki_scope.dart
docs/
  domain.md        # 단어장 ERD · 규칙
  API.md           # CRUD API 명세
```
