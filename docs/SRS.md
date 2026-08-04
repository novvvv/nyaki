# SM-2 복습 알고리즘 (v1)

> 상태: **확정**  
> 관련: [SRS-PLAN.md](SRS-PLAN.md) (제품/UX 결정) · [DOMAIN.md](DOMAIN.md) (Word 도메인)

`lib/data/srs/sm2.dart` 구현은 이 문서를 그대로 따른다. 제품/UX 맥락은 [SRS-PLAN.md](SRS-PLAN.md) 참고, 여기는 **계산 로직만** 다룬다.

---

## 입력

학습자는 두 가지 중 하나만 누른다. Hard / Easy 분기는 없다.

| UI | 내부 값 |
|----|---------|
| 모름 | `Again` |
| 외움 | `Good` |

---

## 상태 필드 (`Word`)

| Field | Type | 초기값 |
|-------|------|--------|
| `srs_ease_factor` | float | `2.5` |
| `srs_interval_days` | int | `0` |
| `srs_repetitions` | int | `0` |
| `srs_lapses` | int | `0` |
| `srs_due_at` | datetime | `created_at` |
| `srs_last_reviewed_at` | datetime? | `null` |

---

## 계산 규칙

### Again (모름)

```
ease      = max(1.3, round2(ease - 0.20))
reps      = 0
lapses    = lapses + 1
interval  = 0                      # 재학습 상태로 되돌림 (아래 "구현 메모" 참고)
due_at    = now + RELEARNING_STEP  # 기본 0 = 즉시 복습 대상
last_reviewed_at = now
memorization_status = "unmemorized"
```

`RELEARNING_STEP`은 상수로 둔다 (`lib/data/srs/sm2.dart`의 `relearningStep`, 기본 `0`).

### Good (외움)

```
if reps == 0:
    interval = 1
elif reps == 1:
    interval = 3
else:
    interval = round_half_up(interval * ease)

reps   = reps + 1
due_at = now + interval일
last_reviewed_at = now

if reps >= 2:
    memorization_status = "memorized"
```

ease는 Good에서 변하지 않는다 (Hard/Easy가 없으므로 올릴 방법이 없음 — 의도된 동작).

---

## 반올림 규칙: **round half up (올림 고정)**

```
round_half_up(x) = floor(x + 0.5)   # x >= 0
```

일반 반올림이 아니라 **동점(.5)일 때 무조건 올림**으로 고정한다. Dart/Python 표준 `round()`는 언어·버전에 따라 반내림(banker's rounding)으로 동작할 수 있어 그대로 쓰지 않는다.

이 규칙은 드문 예외가 아니라 **매번 마주치는 케이스**다: 신규 단어는 ease=2.5로 시작하므로, 한 번도 틀리지 않은 모든 단어가 3번째 복습에서 `3 × 2.5 = 7.5`를 계산한다. `round_half_up(7.5) = 8`.

### 함수 시그니처 (구현용)

```dart
int roundHalfUp(double x) => (x + 0.5).floor();
```

---

## 정밀도 / 타임존

- **ease 정밀도:** 매 갱신 후 소수 둘째 자리로 반올림해서 저장한다 (부동소수점 누적 오차 방지).
- **타임존:** `due_at`은 UTC 절대시각 기준 `+N일`. 사용자 로컬 자정 기준이 아니다 — "내일"은 정확히 24시간 뒤.
- **Again은 즉시 재학습 대상 (relearning step = 0):** Again은 `due_at`을 `now`로 잡아 곧바로 복습 대상이 된다.
  - v1 초안에서는 "Again도 최소 내일"이었으나, 모름을 눌러도 한참 뒤에나 다시 나와 체감이 나빴다. 그래서 대기 시간을 없앴다.
  - **같은 세션에서 즉시 다시 튀어나오지는 않는다.** 출제 목록은 세션을 시작할 때 한 번 고정되므로, 모른 단어는 그 판을 끝내고 **다음 테스트에 들어갈 때** 다시 출제된다.
  - 나중에 "10분 뒤에 다시" 같은 지연을 주고 싶으면 `relearningStep` 상수만 바꾸면 된다.
  - Good은 여전히 일(day) 단위 그대로다. relearning step은 Again에만 적용된다.

---

## 구현 메모

- **Again 시 `srs_interval_days`는 `0`으로 되돌린다.** 아직 "일 단위 간격"에 들어가지 않은 재학습 상태라는 뜻이고, 신규 단어의 초기값과 같다. 다음 Good 계산은 `reps == 0` 분기라 이 값을 참조하지 않아 스케줄에는 영향 없지만, 방치하면 DB에 "고쳐지지 않은 옛 interval"이 남아 데이터를 볼 때 헷갈린다.
- `memorization_status`는 이 로직의 부수 효과일 뿐, SM-2 계산 자체와는 무관하다 (호환용 필드, [SRS-PLAN.md](SRS-PLAN.md) 참고).

---

## 워크스루 (테스트 벡터)

새 단어가 계속 "외움"만 받는 경우 (ease는 계속 2.5로 고정):

| # | 입력 | ease | reps (전→후) | interval | due |
|---|------|------|--------------|----------|-----|
| 1 | Good | 2.5 | 0→1 | 1 | +1일 |
| 2 | Good | 2.5 | 1→2 | 3 (→ `memorized`) | +3일 |
| 3 | Good | 2.5 | 2→3 | `round_half_up(3×2.5)` = 8 | +8일 |
| 4 | Good | 2.5 | 3→4 | `round_half_up(8×2.5)` = 20 | +20일 |

같은 단어가 4번째에 "모름"을 받는 경우 (3번째까지는 위와 동일):

| # | 입력 | ease | reps (전→후) | interval | due |
|---|------|------|--------------|----------|-----|
| 4 | Again | 2.5→2.3 | 3→0 | 0 | 즉시 (`unmemorized`, lapses=1) |
| 5 | Good | 2.3 | 0→1 | 1 | +1일 |
| 6 | Good | 2.3 | 1→2 | 3 (→ `memorized`) | +3일 |
| 7 | Good | 2.3 | 2→3 | `round_half_up(3×2.3)` = 7 | +7일 |

새 구현체(Dart/TS 등)는 이 표의 입출력과 정확히 일치해야 한다.
