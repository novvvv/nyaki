# SRS(SM-2) 구현 상세 — 코드 변경 내역과 로직 흐름

> 이 문서는 "무엇을 왜 바꿨는지"가 아니라 **"실제로 어떤 코드가 어떻게 바뀌었고, 실행 시점에 로직이 어떤 순서로 흐르는지"**를 기록한다.
> 제품/UX 결정과 향후 개선 검토는 [SRS-PLAN.md](SRS-PLAN.md), 계산 규칙 자체는 [SRS.md](SRS.md) 참고.
> 진행 체크리스트는 [SRS-PROGRESS.md](../SRS-PROGRESS.md).

---

## 1. 전체 지도 — 계층 4개

**신규 파일은 `sm2.dart` 하나뿐이고, 화면은 새로 만들지 않았다.** 기존 테스트 세션 화면의 채점 경로만 갈아끼웠다.

```
계층                파일                                              역할
──────────────────────────────────────────────────────────────────────────────
순수 로직    lib/data/srs/sm2.dart                    SM-2 계산 (부작용 없음) ★신규
로컬 DB      lib/data/local/tables.dart                Drift 테이블 정의 (SRS 6컬럼)
             lib/data/local/app_database.dart          스키마 버전 + 마이그레이션
도메인 모델  lib/models/word.dart                       Word.srs* 필드, isDue
             lib/models/word_book.dart                  dueWords/dueCount
저장소       lib/data/repositories/vocab_repository.dart        ReviewGrade, gradeWord 계약
             lib/data/repositories/drift_vocab_repository.dart  실제 구현 (앱 런타임)
             lib/data/repositories/in_memory_vocab_repository.dart 테스트용 구현
             lib/data/sync/sync_coordinator.dart        Hub push/pull에 SRS 필드 반영
컨트롤러     lib/data/vocab_controller.dart              UI가 부르는 gradeWord 래퍼
UI           lib/screens/test/word_test_session_screen.dart
                                                        기존 화면 유지, 채점만 SM-2로 교체
```

의존 방향은 위→아래 한 방향이다. `sm2.dart`는 아무것도 모른다 (Word도, DB도 모름 — `Sm2State`라는 자체 값 타입만 다룸). `drift_vocab_repository.dart`가 `sm2.dart`를 호출해서 계산하고, 그 결과를 DB에 쓴다. UI는 `VocabController.gradeWord`만 호출하면 된다.

---

## 2. 순수 로직 — `lib/data/srs/sm2.dart`

이번 작업에서 새로 만든 건 아니고(모듈 3에서 이미 구현·테스트 완료), 여기서는 이 위 계층들이 이 함수를 어떻게 쓰는지가 핵심이다.

```dart
Sm2GradeResult gradeAgain(Sm2State state, DateTime now)
Sm2GradeResult gradeGood(Sm2State state, DateTime now)
```

- 입력: 현재 SRS 상태(`Sm2State`) + 채점 시각
- 출력: 다음 SRS 상태 + `WordMemorizationStatus` (repetitions ≥ 2면 memorized)
- DB도 모르고 Word도 모른다 — 순수 함수라서 `sm2_test.dart`에서 DB 없이 바로 테스트 가능했던 이유가 이거다.

---

## 3. 로컬 DB 스키마 — `tables.dart` / `app_database.dart`

(모듈 4-1, 이전에 이미 적용·검증 완료. 요약만)

`WordEntries` 테이블에 컬럼 6개 추가: `srsEaseFactor`(real, 기본 2.5), `srsIntervalDays`/`srsRepetitions`/`srsLapses`(int, 기본 0), `srsDueAt`(datetime, 기본 현재시각), `srsLastReviewedAt`(datetime, nullable).

`schemaVersion` 3→4, `onUpgrade`에서 `from < 4`일 때 6개 컬럼을 `addColumn`으로 추가하고, 기존 row는 `srs_due_at = created_at`으로 백필(마이그레이션 실행 시각이 아니라 각자 생성일 기준으로 맞춰서, 오래된 단어가 전부 "오늘 복습 대상"으로 몰리지 않게 함).

---

## 4. 도메인 모델 — `word.dart` / `word_book.dart`

### Word (`lib/models/word.dart`)

생성자에 6개 필드 추가 (`srsDueAt`만 `required`, 나머지는 기본값 有). 이번에 추가한 것:

```dart
/// 지금 시각 기준으로 복습 대상인지 (srsDueAt이 지났는지).
bool get isDue => !srsDueAt.isAfter(DateTime.now());
```

`srsDueAt`이 "지금"보다 과거이거나 같으면 복습 대상. 별도 쿼리/리포지토리 메서드를 만들지 않고 이미 메모리에 올라온 `Word` 리스트에서 getter로 필터링하는 방식을 택했다 — `wordCount`/`memorizedCount`가 이미 이런 패턴이라 거기 맞춘 것.

### WordBook (`lib/models/word_book.dart`)

```dart
List<Word> get dueWords => activeWords.where((word) => word.isDue).toList(growable: false);
int get dueCount => dueWords.length;
```

`WordBook`이 이미 `words` 리스트를 들고 있어서, "이 단어장에서 오늘 복습할 것들"을 getter 하나로 뽑을 수 있다. 홈 화면에서 `wordBooks.expand((book) => book.dueWords)`로 여러 단어장을 합친다.

---

## 5. 저장소 계약 — `vocab_repository.dart`

```dart
enum ReviewGrade { again, good }  // 모름 / 외움

abstract class VocabRepository {
  ...
  Future<Word> gradeWord(String wordBookId, String wordId, ReviewGrade grade);
}
```

인터페이스에 메서드 하나만 추가. 구현체는 두 개(`DriftVocabRepository`=앱 런타임, `InMemoryVocabRepository`=테스트) 모두 이 계약을 지켜야 컴파일된다.

---

## 6. 실제 구현 — `drift_vocab_repository.dart`의 `gradeWord`

이번 세션에서 두 가지를 고쳤다:

1. **버그 수정**: 이전에 사용자가 직접 편집하면서 `#`로 주석을 달았는데, Dart는 `#` 한 줄 주석을 지원하지 않는다(`//`, `///`, `/* */`만 유효). 그대로 뒀으면 이 파일이 컴파일 자체가 안 됐을 것 — `//`로 전부 바꿨다.
2. **`_enqueueWord`의 outbox payload에 SRS 6필드 추가** (아래 8절에서 설명).

`gradeWord` 자체 로직(이건 이전 세션에 이미 구현·설명됨, 여기서는 흐름만 재정리):

```dart
Future<Word> gradeWord(String wordBookId, String wordId, ReviewGrade grade) async {
  final row = await getWord(wordBookId, wordId);        // ① 채점 전 현재 상태 전체를 읽는다

  final state = Sm2State(                                 // ② Word -> Sm2State 변환
    easeFactor: row.srsEaseFactor,
    intervalDays: row.srsIntervalDays,
    repetitions: row.srsRepetitions,
    lapses: row.srsLapses,
    dueAt: row.srsDueAt,
    lastReviewedAt: row.srsLastReviewedAt,
  );

  final now = DateTime.now();
  final result = grade == ReviewGrade.again              // ③ 순수 함수 호출 — 여기서만 계산
      ? gradeAgain(state, now)
      : gradeGood(state, now);

  await _db.transaction(() async {                        // ④ DB 쓰기 + outbox 기록을 한 트랜잭션으로
    await (_db.update(_db.wordEntries)..where((w) => w.id.equals(wordId))).write(
      WordEntriesCompanion(
        srsEaseFactor: Value(result.state.easeFactor),
        srsIntervalDays: Value(result.state.intervalDays),
        srsRepetitions: Value(result.state.repetitions),
        srsLapses: Value(result.state.lapses),
        srsDueAt: Value(result.state.dueAt),
        srsLastReviewedAt: Value(result.state.lastReviewedAt),
        memorizationStatus: Value(result.memorizationStatus.name),
        updatedAt: Value(now),
      ),
    );
    await _enqueueWord(wordId, 'upsert');                 // ⑤ Hub sync용 outbox에도 최신 상태 기록
  });

  return getWord(wordBookId, wordId);                     // ⑥ 갱신된 Word를 다시 읽어서 반환
}
```

① 에서 굳이 현재 상태 "전체"가 필요한 이유: SM-2는 이전 ease factor·interval·repetitions에 의존하는 누적 계산이라서, 이번 채점 하나만으로는 다음 상태를 못 정한다 (예: `gradeGood`은 `repetitions`가 0/1/2+ 인지에 따라 interval 계산식이 통째로 다르다).

`InMemoryVocabRepository.gradeWord`도 로직은 동일하되, DB 트랜잭션 대신 메모리 리스트를 직접 갈아끼운다 (테스트 전용).

---

## 7. `VocabController.gradeWord` — UI가 실제로 부르는 지점

```dart
Future<Word> gradeWord({required String wordBookId, required String wordId, required ReviewGrade grade}) async {
  final updated = await _repository.gradeWord(wordBookId, wordId, grade);
  await reload();   // wordBooks 전체를 다시 읽어서 ChangeNotifier로 UI에 알림
  return updated;
}
```

`createWord`/`updateWord`/`deleteWord`와 똑같은 패턴 — 저장소 호출 후 `reload()`로 `ChangeNotifier.notifyListeners()`를 트리거해서, `NyakiScope`를 구독하는 모든 화면(홈의 "오늘 N개" 배지 포함)이 자동으로 다시 그려진다.

---

## 8. Hub 동기화 — `_enqueueWord` payload / `sync_coordinator.dart`

### Push (로컬 → Hub): `_enqueueWord`

`gradeWord`가 끝나면 `_enqueueWord(wordId, 'upsert')`가 호출되고, 이게 `SyncOutbox` 테이블에 현재 Word 전체를 JSON으로 직렬화해서 쌓는다. 이번에 SRS 6필드를 여기 추가했다:

```dart
'srs_ease_factor': row.srsEaseFactor,
'srs_interval_days': row.srsIntervalDays,
'srs_repetitions': row.srsRepetitions,
'srs_lapses': row.srsLapses,
'srs_due_at': row.srsDueAt.toUtc().toIso8601String(),
'srs_last_reviewed_at': row.srsLastReviewedAt?.toUtc().toIso8601String(),
```

이게 빠져 있으면 로컬 DB에는 SM-2 결과가 정상 저장돼도, Hub로는 절대 안 올라간다 — 로그인 안 한 로컬 전용 사용자는 이 outbox 자체가 안 쌓이거나 쌓여도 안 읽히니 상관없지만, 로그인 사용자는 이게 없으면 다른 기기에서 SRS 진행 상황이 안 보이는 버그가 났을 것.

### Pull (Hub → 로컬): `_mergeWord`

Hub에서 내려온 JSON을 로컬 `WordEntriesCompanion`으로 바꿀 때도 SRS 필드를 읽도록 추가:

```dart
srsEaseFactor: Value((json['srs_ease_factor'] as num?)?.toDouble() ?? 2.5),
srsIntervalDays: Value(json['srs_interval_days'] as int? ?? 0),
srsRepetitions: Value(json['srs_repetitions'] as int? ?? 0),
srsLapses: Value(json['srs_lapses'] as int? ?? 0),
srsDueAt: Value(json['srs_due_at'] != null
    ? DateTime.parse(json['srs_due_at'] as String)
    : DateTime.parse(json['created_at'] as String)),
srsLastReviewedAt: Value(json['srs_last_reviewed_at'] != null
    ? DateTime.parse(json['srs_last_reviewed_at'] as String)
    : null),
```

`??`/`null` 처리를 넉넉하게 둔 이유: Hub가 아직 옛날 버전이거나 응답에 SRS 필드가 없는 경우에도 죽지 않게 하기 위함 (`srs_due_at`이 없으면 `created_at`으로 대체).

`sync()`의 push→pull 순서, 20초 폴링 주기 자체는 이번에 안 건드렸다 — 그 설계(트래픽 비용, foreground 복귀 시 1회 동기화 개선안)는 [SRS-PLAN.md](SRS-PLAN.md)에 별도로 정리돼 있고 지금 스코프는 아니다.

---

## 9. 채점 UI — 기존 테스트 세션 화면에 SM-2 연결

**중요: 복습 전용 화면을 새로 만들지 않는다.** 기존 `lib/screens/test/word_test_session_screen.dart`(세로 스와이프 릴스형 카드, 좋아요/북마크, 메모 시트, 단어 이미지)를 그대로 쓰고, **모름/외움 버튼이 부르는 함수만** 교체했다.

바뀐 건 이 한 곳뿐이다:

```dart
// before — memorizationStatus만 뒤집음. SM-2와 무관.
Future<void> _setMemorization(int index, WordMemorizationStatus status) async {
  final word = _words[index];
  if (word.memorizationStatus == status) return;   // 같은 상태면 아무것도 안 함
  final updated = await NyakiScope.of(context).updateWord(
    wordBookId: word.wordBookId, wordId: word.id,
    input: UpdateWordInput(memorizationStatus: status),
  );
  setState(() => _words[index] = updated);
}

// after — SM-2 채점. ease/interval/반복횟수/다음 복습일까지 함께 계산·저장.
Future<void> _grade(int index, ReviewGrade grade) async {
  final word = _words[index];
  final updated = await NyakiScope.of(context).gradeWord(
    wordBookId: word.wordBookId, wordId: word.id, grade: grade,
  );
  setState(() => _words[index] = updated);
}
```

호출부:

```dart
onMarkUnmemorized: () => _grade(index, ReviewGrade.again),
onMarkMemorized:  () => _grade(index, ReviewGrade.good),
```

**`if (word.memorizationStatus == status) return;` 가드를 없앤 이유**: 예전엔 "이미 외움인 단어에 또 외움을 누르면 할 일이 없다"가 맞았다. 하지만 SM-2에서는 이미 memorized인 단어에 외움을 또 눌러도 **interval이 한 단계 더 늘어나야** 한다(3일 → 8일 → 20일). 이 가드를 두면 두 번째 외움부터 채점이 통째로 무시되므로 반드시 제거해야 한다.

화면 구성·색·간격·좋아요·메모 시트·이미지·우측 릴스 액션레일은 **하나도 건드리지 않았다.**

### 9-1. 출제 기준도 SM-2로 — 전체/모름만/외움만 필터 제거

채점만 바꿨을 때 문제가 하나 남아 있었다. **쓰기는 SM-2인데 읽기는 아니었다** — `srs_due_at`을 계산해서 저장은 하는데, 정작 "어떤 단어를 보여줄지"는 여전히 `memorization_status`가 정하고 있어서 SM-2가 계산한 복습 주기를 아무도 안 읽었다.

```dart
// before — memorizationStatus만 보고, 복습 주기(srs_due_at)는 완전히 무시
switch (filter) {
  case WordTestFilter.all:            return true;
  case WordTestFilter.unmemorizedOnly: return !word.isMemorized;
  case WordTestFilter.memorizedOnly:   return word.isMemorized;
}

// after — SM-2가 정한 복습 대상만
.where((word) => word.isDue)
```

이에 따라 제거한 것:

- `WordTestFilter` enum, `WordTestOptions.filter` 필드
- 옵션 시트의 전체/모름만/외움만 칩과 `_FilterChip` 위젯 → "복습 주기가 돌아온 N단어" 안내 문구로 대체
- 남긴 옵션: **뜻 가리기, 순서 섞기** (표시 방식이라 SM-2와 무관)

단어장 **선택** 기능은 그대로 유지된다. 선택한 단어장들 안에서 due인 단어만 뽑는 구조다. 목록 타일과 시작 버튼의 숫자도 "가진 단어 수"가 아니라 `dueCount`(오늘 복습할 개수)를 쓰도록 바꿨다.

---

## 10. Again(모름) — 즉시 재학습 대상

초기 스펙은 "Again도 due_at은 최소 내일"이었다. 그런데 모름을 눌러도 한참 뒤에나 다시 나와서, 모르는 단어를 바로 다시 볼 방법이 없었다. 그래서 대기 시간을 아예 없앴다.

```dart
// lib/data/srs/sm2.dart
const Duration relearningStep = Duration.zero;   // 0 = 즉시 복습 대상

Sm2GradeResult gradeAgain(Sm2State state, DateTime now) {
  final nowUtc = now.toUtc();
  final ease = math.max(1.3, _roundHalfUp2(state.easeFactor - 0.20));
  final nextState = Sm2State(
    easeFactor: ease,
    intervalDays: 0,                        // 재학습 상태로 되돌림 (신규 단어 초기값과 동일)
    repetitions: 0,
    lapses: state.lapses + 1,
    dueAt: nowUtc.add(relearningStep),      // ← 즉시 due
    lastReviewedAt: nowUtc,
  );
  return Sm2GradeResult(state: nextState,
      memorizationStatus: WordMemorizationStatus.unmemorized);
}
```

**"즉시 due"인데 왜 그 세션에서 바로 안 나오나?** 출제 목록이 세션 시작 시점에 한 번만 계산되고 고정되기 때문이다:

```dart
// word_test_session_screen.dart
late final List<Word> _words = widget.options.selectWords(widget.wordBooks);
//   ^^^^^^^^^^ late final — 최초 1회 계산 후 다시 계산되지 않음
```

그래서 동작이 이렇게 나뉜다:

| 시점 | 모름 누른 단어가 나오나 |
|------|------------------------|
| 진행 중인 그 세션 안 | ❌ 안 나옴 (목록이 이미 고정됨) |
| 세션 끝내고 다시 테스트 진입 | ✅ 바로 나옴 (due이므로) |

이건 의도한 동작이다 — 한 판을 끝까지 돌고 나서 모른 것만 다시 만나는 흐름.

기타:

- `intervalDays`를 1이 아니라 **0**으로 되돌린다. 아직 "일 단위 간격"에 진입하지 않은 재학습 상태라는 뜻이고, 신규 단어 초기값과 같다. 다음 Good은 `reps == 0` 분기라 이 값을 읽지 않으므로 스케줄에는 영향이 없다.
- **Good은 그대로 일(day) 단위**다. relearning step은 Again에만 적용된다.
- 나중에 "10분 뒤에 다시" 같은 지연을 주고 싶으면 `relearningStep` 상수 하나만 고치면 된다.
- `docs/SRS.md`의 스펙 본문·워크스루 표, `test/data/srs/sm2_test.dart`의 테스트 벡터도 같이 갱신했다.

---

## 11. 끝에서 끝까지 — 사용자가 버튼을 누르는 순간

```
[테스트 세션 화면] "외움" 버튼 탭
   -> _grade(index, ReviewGrade.good)
       -> VocabController.gradeWord(wordBookId, wordId, ReviewGrade.good)
           -> DriftVocabRepository.gradeWord(...)
               -> getWord()로 현재 srs_* 컬럼 읽기 (채점 전 상태)
               -> gradeGood(state, now)  [sm2.dart, 순수 계산]
               -> DB 트랜잭션:
                    - word_entries.srs_* 컬럼 UPDATE
                    - word_entries.memorization_status UPDATE (repetitions>=2 -> memorized)
                    - sync_outbox에 upsert 레코드 추가 (srs_* 포함 JSON)
               -> 갱신된 Word 다시 조회해서 반환
           -> controller.reload() -> wordBooks 다시 로드 -> notifyListeners()
       -> setState로 화면의 해당 카드 갱신
       (로그인 상태라면) SyncCoordinator.sync()가 다음 주기에
           outbox를 Hub로 push -> 다른 기기 pull 시 srs_* 필드까지 반영
```

"모름"을 누르면 위 흐름에서 `gradeGood` 대신 `gradeAgain`이 돌고, `srs_due_at`이 10분 뒤로 잡힌다.

---

## 12. 이번에 다루지 않은 것 (의도적으로 스코프 밖)

- `SyncOutbox`/Hub `sync_changes` 로그 무한 증식 — [SRS-PLAN.md](SRS-PLAN.md) "향후 개선 검토" 참고, 아직 미구현.
- `SyncCoordinator`의 20초 고정 폴링 — 개선안(foreground 복귀 시 1회 동기화 등)은 문서화만 되어 있고 미적용.
- 복습 실패 시 재시도/큐잉 — 현재는 실패해도 카드가 이미 넘어가고 스낵바만 뜸.
- `review_logs` 같은 채점 히스토리 테이블, Hard/Easy 4버튼, FSRS — 범위 밖(v1에서 안 함).

---

## 13. 남은 할 일

- `flutter analyze` / `flutter test` 로컬 실행 확인 (이 세션에서는 Flutter SDK가 없는 환경이라 직접 실행 못 함 — 아래 명령어로 확인 필요).
- 앱에서 직접: 단어 하나 "외움" 여러 번 눌러서 `srs_due_at`이 SRS.md 워크스루(1일→3일→8일→20일)대로 늘어나는지, 홈/테스트 화면 "오늘 N개" 숫자가 채점 직후 바로 줄어드는지 확인.

```bash
flutter analyze
flutter test
```
