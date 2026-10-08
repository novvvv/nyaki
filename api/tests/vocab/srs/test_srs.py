"""SM-2 파이썬 포팅이 Dart 원본과 같은 답을 내는지 검증한다.

test/data/srs/sm2_test.dart를 1:1로 옮긴 것이다. 케이스를 추가하거나 고치면
**양쪽을 같이** 고쳐야 한다 — 두 구현이 갈라지면 같은 단어의 다음 복습일이
앱과 웹에서 달라진다.

DB도 앱도 안 띄운다. 순수 함수 호출뿐이다.
"""

from datetime import datetime, timedelta, timezone

from app.vocab.srs import (
    RELEARNING_STEP,
    Sm2State,
    grade_again,
    grade_good,
    round_half_up,
)

NOW = datetime(2026, 1, 1, 9, 0, tzinfo=timezone.utc)

# 계산에 due_at/last_reviewed_at 초기값은 쓰이지 않는다 (출력에서만 새로 채워진다).
INITIAL = Sm2State(
    ease_factor=2.5,
    interval_days=0,
    repetitions=0,
    lapses=0,
    due_at=NOW,
)


def _goods(count: int, state: Sm2State = INITIAL) -> Sm2State:
    for _ in range(count):
        state = grade_good(state, NOW).state
    return state


# ==================== grade_good 연속 4회 — 워크스루 표 1 ====================


def test_good_1_reps_0_to_1_interval_1day() -> None:
    result = grade_good(INITIAL, NOW)
    assert result.state.ease_factor == 2.5
    assert result.state.repetitions == 1
    assert result.state.interval_days == 1
    assert result.state.due_at == NOW + timedelta(days=1)
    assert result.memorization_status == "unmemorized"


def test_good_2_reps_1_to_2_interval_3days_memorized() -> None:
    result = grade_good(_goods(1), NOW)
    assert result.state.repetitions == 2
    assert result.state.interval_days == 3
    assert result.state.due_at == NOW + timedelta(days=3)
    assert result.memorization_status == "memorized"


def test_good_3_interval_round_half_up_3x2_5_is_8days() -> None:
    result = grade_good(_goods(2), NOW)
    assert result.state.repetitions == 3
    assert result.state.interval_days == 8
    assert result.state.due_at == NOW + timedelta(days=8)


def test_good_4_interval_round_half_up_8x2_5_is_20days() -> None:
    result = grade_good(_goods(3), NOW)
    assert result.state.repetitions == 4
    assert result.state.interval_days == 20
    assert result.state.due_at == NOW + timedelta(days=20)


# ==================== 4번째에 Again — 워크스루 표 2 ====================
# after_three_goods: ease 2.5, interval 8, reps 3, lapses 0


def test_again_resets_reps_and_drops_ease() -> None:
    result = grade_again(_goods(3), NOW)
    assert result.state.ease_factor == 2.3
    assert result.state.repetitions == 0
    assert result.state.interval_days == 0
    assert result.state.lapses == 1
    assert result.state.due_at == NOW + RELEARNING_STEP
    assert result.memorization_status == "unmemorized"


def test_again_word_becomes_due_immediately() -> None:
    # Word.isDue는 !dueAt.isAfter(now) — due가 now 이하이면 즉시 대상이다.
    result = grade_again(_goods(3), NOW)
    assert not result.state.due_at > NOW


def test_good_5_after_again_reps_0_to_1_interval_1day() -> None:
    after_again = grade_again(_goods(3), NOW).state
    result = grade_good(after_again, NOW)
    assert result.state.ease_factor == 2.3
    assert result.state.repetitions == 1
    assert result.state.interval_days == 1


def test_good_6_after_again_interval_3days_memorized() -> None:
    after_again = grade_again(_goods(3), NOW).state
    result = grade_good(_goods(1, after_again), NOW)
    assert result.state.repetitions == 2
    assert result.state.interval_days == 3
    assert result.memorization_status == "memorized"


def test_good_7_interval_round_half_up_3x2_3_is_7days() -> None:
    # ease가 2.3으로 깎였으므로 3 × 2.3 = 6.9 → 7. 깎이지 않았다면 8이었다.
    after_again = grade_again(_goods(3), NOW).state
    result = grade_good(_goods(2, after_again), NOW)
    assert result.state.repetitions == 3
    assert result.state.interval_days == 7


# ==================== round_half_up ====================


def test_round_half_up_always_rounds_half_upward() -> None:
    assert round_half_up(7.5) == 8
    assert round_half_up(2.5) == 3
    assert round_half_up(20.0) == 20


def test_round_half_up_is_not_bankers_rounding() -> None:
    # 파이썬 내장 round()를 쓰면 round(2.5) == 2라 Dart와 답이 갈린다.
    assert round(2.5) == 2
    assert round_half_up(2.5) == 3


def test_ease_never_drops_below_floor() -> None:
    low = Sm2State(
        ease_factor=1.35,  # 1.35 - 0.20 = 1.15 → 1.3으로 고정
        interval_days=1,
        repetitions=0,
        lapses=0,
        due_at=NOW,
    )
    assert grade_again(low, NOW).state.ease_factor == 1.3


# ==================== 포팅 과정에서 추가한 것 ====================


def test_naive_datetime_is_treated_as_utc() -> None:
    naive = datetime(2026, 1, 1, 9, 0)
    result = grade_good(INITIAL, naive)
    assert result.state.due_at == NOW + timedelta(days=1)
