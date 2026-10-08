"""학습 단계 — 안키의 Learning steps / Relearning steps / Graduating interval.

단계를 비워두면 기존 동작(일 단위)과 정확히 같아야 한다. test_srs.py가 그쪽을
지키고, 이 파일은 단계를 켰을 때를 지킨다.
"""

from datetime import datetime, timedelta, timezone

from app.vocab.srs import (
    DEFAULT_STEPS,
    Sm2State,
    StepConfig,
    grade_again,
    grade_good,
)

NOW = datetime(2026, 9, 23, 12, 0, tzinfo=timezone.utc)

# 안키 기본값과 같은 구성
ANKI_LIKE = StepConfig(
    learning_steps=(1, 10),
    relearning_steps=(10,),
    graduating_interval_days=1,
)


def _new_card() -> Sm2State:
    return Sm2State(
        ease_factor=2.5,
        interval_days=0,
        repetitions=0,
        lapses=0,
        due_at=NOW,
        last_reviewed_at=None,
    )


def test_new_card_good_moves_to_second_step() -> None:
    """새 카드에서 '외움'은 1분이 아니라 10분이다 — 안키의 Good <10m와 같다."""
    result = grade_good(_new_card(), NOW, ANKI_LIKE)

    assert result.state.learning_step == 1
    assert result.state.due_at == NOW + timedelta(minutes=10)
    assert result.state.interval_days == 0  # 아직 졸업 전
    assert result.state.repetitions == 0


def test_new_card_again_goes_to_first_step() -> None:
    result = grade_again(_new_card(), NOW, ANKI_LIKE)

    assert result.state.learning_step == 0
    assert result.state.due_at == NOW + timedelta(minutes=1)
    # 아직 졸업 전인 카드가 틀린 건 lapse로 세지 않는다 — 안키와 같다.
    assert result.state.lapses == 0


def test_last_step_graduates_to_days() -> None:
    """마지막 단계를 통과하면 일 단위 복습으로 올라간다."""
    at_last = Sm2State(
        ease_factor=2.5,
        interval_days=0,
        repetitions=0,
        lapses=0,
        due_at=NOW,
        last_reviewed_at=NOW,
        learning_step=1,  # (1, 10) 중 마지막
    )

    result = grade_good(at_last, NOW, ANKI_LIKE)

    assert result.state.learning_step is None
    assert result.state.interval_days == 1
    assert result.state.repetitions == 1
    assert result.state.due_at == NOW + timedelta(days=1)


def test_graduating_interval_is_configurable() -> None:
    at_last = Sm2State(
        ease_factor=2.5,
        interval_days=0,
        repetitions=0,
        lapses=0,
        due_at=NOW,
        last_reviewed_at=NOW,
        learning_step=1,
    )
    config = StepConfig(
        learning_steps=(1, 10), relearning_steps=(10,), graduating_interval_days=3
    )

    result = grade_good(at_last, NOW, config)

    assert result.state.interval_days == 3
    assert result.state.due_at == NOW + timedelta(days=3)


def test_review_card_failure_enters_relearning() -> None:
    """복습 카드가 틀리면 재학습 단계로 간다 — 즉시가 아니라 10분 뒤."""
    review = Sm2State(
        ease_factor=2.5,
        interval_days=20,
        repetitions=4,
        lapses=0,
        due_at=NOW,
        last_reviewed_at=NOW - timedelta(days=20),
    )

    result = grade_again(review, NOW, ANKI_LIKE)

    assert result.state.learning_step == 0
    assert result.state.due_at == NOW + timedelta(minutes=10)
    assert result.state.lapses == 1
    assert result.state.ease_factor == 2.3  # 실패 페널티는 그대로 적용


def test_relearning_graduates_back_to_review() -> None:
    relearning = Sm2State(
        ease_factor=2.3,
        interval_days=0,
        repetitions=0,
        lapses=1,
        due_at=NOW,
        last_reviewed_at=NOW,
        learning_step=0,  # relearning_steps=(10,) 중 마지막
    )

    result = grade_good(relearning, NOW, ANKI_LIKE)

    assert result.state.learning_step is None
    assert result.state.interval_days == 1
    assert result.state.repetitions == 1


def test_full_anki_like_walkthrough() -> None:
    """새 카드 → 1분 → 10분 → 1일 → 3일. 안키 기본 구성의 전형적인 흐름."""
    state = _new_card()

    # 틀림 → 1분
    state = grade_again(state, NOW, ANKI_LIKE).state
    assert state.due_at == NOW + timedelta(minutes=1)

    # 맞힘 → 10분 (단계 0 → 1)
    at_1m = NOW + timedelta(minutes=1)
    state = grade_good(state, at_1m, ANKI_LIKE).state
    assert state.due_at == at_1m + timedelta(minutes=10)

    # 맞힘 → 졸업, 1일
    at_11m = at_1m + timedelta(minutes=10)
    state = grade_good(state, at_11m, ANKI_LIKE).state
    assert state.learning_step is None
    assert state.interval_days == 1

    # 다음 날 맞힘 → 3일 (repetitions == 1 분기)
    tomorrow = at_11m + timedelta(days=1)
    state = grade_good(state, tomorrow, ANKI_LIKE).state
    assert state.interval_days == 3
    assert state.repetitions == 2


def test_empty_steps_keeps_old_behavior() -> None:
    """단계를 안 쓰면 예전 그대로 — 모름은 즉시, 외움은 1일."""
    again = grade_again(_new_card(), NOW, DEFAULT_STEPS)
    assert again.state.due_at == NOW
    assert again.state.learning_step is None

    good = grade_good(_new_card(), NOW, DEFAULT_STEPS)
    assert good.state.due_at == NOW + timedelta(days=1)
    assert good.state.interval_days == 1
