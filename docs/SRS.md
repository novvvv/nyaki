# SRS (SM-2) 복습 — 설계 · 계산 로직 · 구현

> 상태: **구현 완료** (2026-08 기준)
> 관련: [DOMAIN.md](DOMAIN.md) (Word 도메인) · [API.md](API.md) · [hub_erd.md](hub_erd.md) · [../app_erd.md](../app_erd.md)
>
> 원래 SRS-PLAN / SRS / SRS-IMPLEMENTATION / SRS-PROGRESS 4개로 나뉘어 있던 것을 구현 완료 후 이 문서 하나로 합쳤다.

---

## 1. 제품 결정

| 항목 | 결정 |
|------|------|
| 알고리즘 | Anki식 **SM-2** |
| 학습자 입력 | **모름** / **외움**만 (Hard / Easy 없음) |
| 내부 매핑 | 모름 → `Again`, 외움 → `Good` |
| 클라이언트 | **앱만 (v1)** — 웹 복습 UI 보류, 사유는 §6 |
| 복습 UX | **좌우 스와이프 = 채점 + 다음** (← 모름 / → 외움) |
| 탭 | 뜻 공개 / 숨김 |
| 세로 스와이프 | 채점에 사용 안 함 (좌우와 충돌 방지) |
| 출제 대상 | `srs_due_at <= now`인 단어만 (전체/모름만/외움만 필터 폐지) |
| 세션 개수 | 시작 전 슬라이더로 선택 (오래 밀린 순으로 N개) |

**왜 스와이프인가**: 채점(버튼)과 넘기기(스와이프)를 동시에 두면 조작이 둘로 갈라져 UX가 나빠진다. 한 제스처 = 채점 + 다음으로 합쳤다.

**기각된 안**: (A) 버튼만, 스와이프 없음 (B로 확정) / (C) 위·아래 스와이프 채점 — 세로 피드와 충돌.

---

## 2. 계산 로직 (스펙)

`lib/data/srs/sm2.dart` 구현은 이 절을 그대로 따른다.

### 상태 필드 (`Word`)

| Field | Type | 초기값 |
|-------|------|--------|
| `srs_ease_factor` | float | `2.5` |
| `srs_interval_days` | int | `0` |
| `srs_repetitions` | int | `0` |
| `srs_lapses` | int | `0` |
| `srs_due_at` | datetime | `created_at` |
| `srs_last_reviewed_at` | datetime? | `null` |

### Again (모름)

```
ease      = max(1.3, round2(ease - 0.20))
reps      = 0
lapses    = lapses + 1
interval  = 0                      # 재학습 상태로 되돌림
due_at    = now + RELEARNING_STEP  # 기본 0 = 즉시 복습 대상
last_reviewed_at = now
memorization_status = "unmemorized"
```

`RELEARNING_STEP`은 상수 (`sm2.dart`의 `relearningStep`, 기본 `Duration.zero`).

### Good (외움)

```
if reps == 0:   interval = 1
elif reps == 1: interval = 3
else:           interval = round_half_up(interval * ease)

reps   = reps + 1
due_at = now + interval일
last_reviewed_at = now

if reps >= 2: memorization_status = "memorized"
```

ease는 Good에서 변하지 않는다 (Hard/Easy가 없으므로 올릴 방법이 없음 — 의도된 동작).

### 반올림: **round half up (올림 고정)**

```dart
int roundHalfUp(double x) => (x + 0.5).floor();
```

동점(.5)일 때 무조건 올림. Dart/Python 표준 `round()`는 언어·버전에 따라 반내림(banker's rounding)이라 쓰지 않는다. 드문 예외가 아니라 **매번 마주치는 케이스**다 — 신규 단어는 ease=2.5로 시작하므로 한 번도 틀리지 않은 모든 단어가 3번째 복습에서 `3 × 2.5 = 7.5`를 계산한다.

### 정밀도 / 타임존

- **ease**: 매 갱신 후 소수 둘째 자리로 반올림해서 저장 (부동소수점 누적 오차 방지)
- **타임존**: `due_at`은 UTC 절대시각 기준 `+N일`. 사용자 로컬 자정 기준이 아니다 — "내일"은 정확히 24시간 뒤
- **Again 시 `interval`을 `0`으로**: 아직 일 단위 간격에 들어가지 않은 재학습 상태라는 뜻. 다음 Good은 `reps == 0` 분기라 이 값을 안 읽어 스케줄엔 영향 없지만, 방치하면 DB에 "고쳐지지 않은 옛 interval"이 남아 헷갈린다

### Again = 즉시 재학습 (relearning step = 0)

v1 초안은 "Again도 최소 내일"이었으나, 모름을 눌러도 한참 뒤에나 다시 나와 체감이 나빠서 대기 시간을 없앴다.

**같은 세션에서 즉시 다시 튀어나오지는 않는다.** 출제 목록은 세션 시작 시 한 번 고정되므로, 모른 단어는 그 판을 끝내고 **다음 테스트에 들어갈 때** 다시 출제된다. 나중에 "10분 뒤" 같은 지연을 주려면 `relearningStep` 상수만 바꾸면 된다. Good은 여전히 일 단위 그대로 — relearning step은 Again에만 적용.

### 워크스루 (테스트 벡터)

새 단어가 계속 "외움"만 받는 경우 (ease 2.5 고정):

| # | 입력 | ease | reps (전→후) | interval | due |
|---|------|------|--------------|----------|-----|
| 1 | Good | 2.5 | 0→1 | 1 | +1일 |
| 2 | Good | 2.5 | 1→2 | 3 (→ `memorized`) | +3일 |
| 3 | Good | 2.5 | 2→3 | `round_half_up(3×2.5)` = 8 | +8일 |
| 4 | Good | 2.5 | 3→4 | `round_half_up(8×2.5)` = 20 | +20일 |

같은 단어가 4번째에 "모름"을 받는 경우:

| # | 입력 | ease | reps (전→후) | interval | due |
|---|------|------|--------------|----------|-----|
| 4 | Again | 2.5→2.3 | 3→0 | 0 | 즉시 (`unmemorized`, lapses=1) |
| 5 | Good | 2.3 | 0→1 | 1 | +1일 |
| 6 | Good | 2.3 | 1→2 | 3 (→ `memorized`) | +3일 |
| 7 | Good | 2.3 | 2→3 | `round_half_up(3×2.3)` = 7 | +7일 |

새 구현체(TS 등)는 이 표의 입출력과 정확히 일치해야 한다.

---

## 3. 구현 구조

```
UI (word_test_session_screen.dart)
  └ 좌우 스와이프 → VocabController.gradeWord(ReviewGrade)
       └ DriftVocabRepository.gradeWord
            ├ sm2.dart: gradeAgain / gradeGood  ← 순수 함수, 부작용 없음
            ├ Drift UPDATE (srs_* 6컬럼 + memorization_status + updated_at)
            └ SyncOutbox INSERT → 다음 sync에서 Hub push
```

### 계층별 파일

| 계층 | 파일 |
|------|------|
| 순수 로직 | `lib/data/srs/sm2.dart` (`Sm2State`, `gradeAgain`, `gradeGood`) |
| 로컬 DB | `lib/data/local/tables.dart`, `app_database.dart` (schemaVersion 4) |
| 도메인 | `lib/models/word.dart` (`isDue` getter), `word_book.dart` (`dueWords`/`dueCount`) |
| 저장소 | `vocab_repository.dart` (`ReviewGrade` enum, `gradeWord` 계약) → `drift_vocab_repository.dart` |
| 동기화 | `sync_coordinator.dart` (`_mergeWord`에 SRS 필드 pull) |
| UI | `screens/test/word_test_session_screen.dart`, `word_test_screen.dart` |

### Hub (`api/`)

- Alembic `0003_word_srs_fields.py`: `words`에 SRS 6컬럼 + index `(user_id, srs_due_at)`
- `GET /v1/review/due?limit=` — `is_deleted = false`, `srs_due_at <= now`, `ORDER BY srs_due_at ASC`
- 충돌: `updated_at` 최신 wins (채점 시 `updated_at` · `srs_last_reviewed_at` 갱신)
- v1은 채점 클라이언트가 앱 하나뿐이라 이중 채점 충돌 없음

### `memorization_status` (호환 유지)

- Again → 즉시 `unmemorized`
- Good이고 `srs_repetitions >= 2` → `memorized`

**SM-2 계산 자체와는 무관한 부수 효과 필드**다. 목록 암기율 표시용으로 당분간 유지하지만, 실질적으로 레거시 — 제거하려면 앱·Hub·웹 3곳 마이그레이션이 필요해 큰 작업이다.

---

## 4. 마이그레이션

1. **Hub 먼저** → 기존 row: ease=2.5, interval=0, reps=0, lapses=0, `due_at = created_at`, `last_reviewed_at = null`
2. 이미 `memorized`인 단어: `due_at = now + 3 days`, `reps = 2`, `interval = 3` (Good 2회 통과 상태로 간주 — 즉시 due 폭주 완화)
3. Drift 동일 기본값 (schemaVersion 3 → 4)
4. 클라이언트는 Hub 배포 후

**롤백**: 추가 컬럼은 전부 nullable/default가 있어 하위 호환. Hub는 이전 버전 재배포만 하면 되고 컬럼을 되돌릴 필요 없음.

---

## 5. 범위 밖 (v1에서 안 함)

- 웹 복습 UI (§6)
- Hard / Easy UI, 4버튼 SM-2 (학습자 인지 부담)
- FSRS / 분 단위 learning steps
- `review_logs` 히스토리 테이블
- 푸시 알림 "오늘 복습"
- `memorization_status` 완전 제거

---

## 6. 향후 개선 검토 (v2 후보)

확정되지 않은 추후 아이디어. 착수 확정 전까지는 이 섹션에만 남겨둔다.

### 웹 복습 UI 보류 사유

Hub의 `upsert_word`(`api/app/services.py`)는 필드 단위가 아니라 **row 전체**를 `updated_at`이 더 최신인 쪽으로 덮어쓴다. 단어 내용 수정은 저빈도 쓰기라 충돌이 거의 없었지만, 복습 채점은 하루에도 수십 번 일어나는 고빈도 쓰기다. 웹에도 채점을 넣으면: 앱에서 뜻 수정 → 동기화 전에 웹이 옛 뜻을 들고 채점 → 웹 payload에 옛 뜻이 통째로 실리고 `updated_at`은 방금 것이라 서버가 최신으로 받아들임 → 앱에서 고친 뜻이 사라짐. v1은 채점 클라이언트를 앱 하나로 좁혀 이 문제를 없앴다.

다시 넣는다면 먼저 정할 것: **A.** 리스크 감수하고 현재 방식 그대로 추가, **B.** `PATCH /v1/words/{id}/review` 같은 채점 전용 부분 업데이트 엔드포인트를 분리해 SRS 6필드만 갱신(권장). B 선택 시 SM-2를 TS로 이중 구현하게 되므로 §2의 round half up 규칙·워크스루 벡터를 그대로 포팅해 검증해야 한다.

### 로컬 전용 → 클라우드 전환 시 SM-2 이관

로컬 Drift `WordEntries`와 Hub `words`는 SRS 필드까지 1:1이고, `upsert_word`는 id가 서버에 없으면 새로 만든다. 즉 "로컬 전용 단어를 처음 올리는 것"과 "신규 단어 생성"이 코드 경로상 동일 — 별도 변환 로직 불필요.

빠진 조각: `sync_coordinator.dart`는 `SyncOutbox`에 쌓인 것만 업로드하는데, outbox는 "동기화가 켜진 이후" 변경분만 쌓이는 큐라서 로그인 없이 몇 달 써온 로컬 데이터는 애초에 없다. → **계정 최초 연결 시 로컬 DB 전체를 한 번에 밀어넣는 일회성 백필 경로**가 필요하다.

착수 시 확인: `POST /v1/sync/push`의 최대 100건 제한 → 배치 분할 / 재시도는 outbox 재사용이면 기존 `_is_newer` 규칙으로 자연히 idempotent / 이 시나리오는 항상 "로컬이 서버보다 최신"이라 충돌은 실질적으로 발생하지 않음.

### 무한 증식 로그 — Hub `sync_changes` vs 로컬 `SyncOutbox`

근본 원인은 같다: word row가 갱신될 때마다 로그 테이블에 row가 append되고 정리 로직이 없다. SRS 채점이 붙으면 채점 1회 = row 갱신 1회라 채점 빈도만큼 쌓인다. 다만 **소비자 구조가 달라 전략을 다르게** 가져가야 한다.

**Hub `sync_changes` — 배포 전 결정 필요**

`upsert_word` 호출마다 `_new_change()`가 row를 추가한다. 유저 1인이 하루 30회만 채점해도 1년에 유저당 만 건 이상 누적. 여러 디바이스가 서로 다른 cursor에서 pull하므로 "누가 어디까지 읽었는지"가 복잡도의 핵심.

방향(미정): **A. 주기적 정리 배치** — 모든 디바이스가 특정 cursor를 지났으면 이전 로그 삭제. **B. 압축(compaction)** — 같은 `entity_id`의 오래된 row를 지우고 최신만 유지 (`sync_pull`이 어차피 `entity_id`로 최신 상태를 재조회하므로 중간 row는 무가치). Linear류 WAL tailing은 CDC 인프라가 필요해 이 규모엔 과하다.

**로컬 `SyncOutbox` — write-time 압축으로 충분**

`_enqueueWord`가 수정할 때마다 기존 미전송 row 체크 없이 새 row를 insert한다 — SRS와 무관하게 **이미 존재하는 비효율**. 다만 로그인 시 100건씩 push 후 삭제되므로 "영구 미해결"이 아니라 "로그인 전까지 지연". 소비자가 이 기기 하나뿐이라 여러 cursor를 볼 필요가 없어, 새 row 삽입 전 같은 `(entity_type, entity_id)`의 미전송 row를 지우면 entity당 최대 1행으로 상한이 걸린다.

### Hub 쓰기 부하 / 동시 접속 — 분석 완료, 지금은 액션 불필요

로그를 정리해도 **채점 1회 = `words` UPDATE 1 + `sync_changes` INSERT 1**이라는 비용 자체는 안 줄어든다. 구조적으로 당연한 것이라 "해결" 대상이 아니라 "현재 설정이 감당 가능한지" 확인 대상.

현재 설정: `api/Dockerfile`은 `--workers` 없이 프로세스 1개 / Lightsail $5~10 (vCPU 1) / SQLAlchemy 기본 pool (`pool_size=5`, `max_overflow=10`) = 동시 커넥션 최대 15 / 라우트가 전부 동기 `def`(threadpool 실행).

→ 동시 요청 상한 15~25 수준. 쿼리가 수십ms라 분산 사용 기준 DAU 수백~1천 명대까지는 무리 없을 것으로 **추정**(실측 아님).

병목 신호 관측 시 확장 순서: **1. 설정값 조정** (`--workers N`, pool 확대, 플랜 업그레이드 — 거의 무비용, 자릿수 하나 여유) → **2. 표준 패턴** (pgbouncer, read replica/Redis) → **3. 본격 확장** (샤딩, 비동기 큐, 멀티 리전).

**3단계는 미리 도입하지 않는다.** 실트래픽 없이 샤딩·큐를 선제 도입하는 건 포트폴리오 관점에서도 권장하지 않는다 — "왜 지금은 필요 없고 필요해지면 뭘 어떤 순서로 할지"를 문서화해두는 쪽이 더 설득력 있다.

### `SyncCoordinator` 20초 폴링 — 백그라운드 낭비

`sync()`는 로그인 변화 시 + `Timer.periodic(20초)`로 호출된다. `_push()`는 outbox가 비면 요청을 안 보내지만, `_pull()`은 **바뀐 게 없어도 매번 요청**한다.

지금 방식이 괜찮은 이유: 개인 단어장이라 협업 툴 수준 실시간성이 불필요(20초 지연 체감 없음) / WebSocket은 모바일 백그라운드 제약 때문에 결국 이중 구현이 필요해 복잡도만 커짐 / 활성 기기 100대 기준 초당 5건 안팎이라 서버 여유 안에 있음.

**남는 낭비**: 백그라운드에서도 타이머가 돌아 UX 이득 0인 배터리·트래픽 소모.

**개선안(저비용)**: `WidgetsBindingObserver`로 lifecycle 감지 → 백그라운드 진입 시 타이머 정지 / 포그라운드 복귀 시 재개 + 즉시 1회 `sync()`. 앱 루트에 옵저버 하나만 추가하면 되고, "다른 기기에서 고치고 이 기기를 열면 바로 반영" 문제도 같이 해결된다.

**더 나아가면**: Firebase를 이미 쓰니 Hub가 변경 시 FCM으로 신호만 보내고 그때만 `sync()`를 트리거하는 이벤트 방식으로 폴링 제거 가능. 지금 규모엔 오버엔지니어링.

### 알고리즘 개인화 (FSRS Optimizer)

Anki는 2023년부터 FSRS로 전환했고 SM-2보다 예측 정확도가 검증돼 있어, 도입한다면 직접 설계보다 FSRS 오픈소스 Optimizer 재사용이 합리적이다.

전제조건(지금 없음): `WordModel`은 "현재 최신 상태"만 저장하고 개별 복습 이벤트 히스토리를 안 남긴다. 개인화하려면 `review_log(user_id, word_id, reviewed_at, elapsed_days, rating)` 같은 append-only 테이블이 먼저 필요하고, 유저당 수백 회 이상 쌓여야 통계적으로 의미가 있다 — 그 전엔 오버피팅 위험만 크다.

착수 판단: 알고리즘이 하나뿐이고 사용처가 앱 하나뿐인 지금은 오버엔지니어링. 다만 `review_log` 테이블 자체는 "언젠가 필요해질 관찰 데이터"라 미리 만들어두는 것도 고려할 만하다.

---

## 7. 남은 할 일

- [ ] `flutter analyze` / `flutter test` 전체 통과 확인
- [ ] 채점 → `srs_due_at` 갱신 → 화면 반영까지 앱 내 직접 확인
- [ ] Drift v3 → v4 마이그레이션 실기기 검증 ([../RELEASE-CHECKLIST.md](../RELEASE-CHECKLIST.md) P0)
- [ ] `sync_changes` 정리 전략 A/B 결정 (§6)
