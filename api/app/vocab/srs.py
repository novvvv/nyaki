"""SM-2 복습 스케줄 계산.

lib/data/srs/sm2.dart를 그대로 옮긴 것이다. 앱은 오프라인이 필요해서 계속 Dart로
계산하고, 웹은 로컬 DB가 없어서 여기를 쓴다. **두 구현이 같은 답을 내야 한다** —
같은 단어를 앱과 웹에서 채점했을 때 다음 복습일이 달라지면 사용자가 바로 알아챈다.

정답지는 test/data/srs/sm2_test.dart다. 이 파일을 고치면 그쪽 테스트도 같이 봐야 한다.
(sm2.dart 주석이 참조하는 docs/SRS.md는 현재 저장소에 없다.)
"""

from __future__ import annotations

import math
from dataclasses import dataclass, replace
from datetime import datetime, timedelta, timezone
from typing import Literal

MemorizationStatus = Literal["unmemorized", "memorized"]
ReviewGrade = Literal["again", "good"]


MIN_EASE_FACTOR = 1.3
EASE_PENALTY = 0.20
RELEARNING_STEP = timedelta(0)


@dataclass(frozen=True)
class Sm2State:
    ease_factor: float
    interval_days: int
    repetitions: int
    lapses: int
    due_at: datetime
    last_reviewed_at: datetime | None = None
    # 지금 몇 번째 학습 단계에 있는지. None이면 학습 단계가 아니다(복습 카드).
    # 안키의 learning/relearning 개념에 해당한다.
    learning_step: int | None = None


@dataclass(frozen=True)
class StepConfig:
    """복습 흐름 설정 — 안키의 Learning steps / Relearning steps / Graduating interval.

    learning_steps가 비어 있으면 학습 단계 없이 바로 일 단위로 간다.
    그게 기본값이고, 이 파일의 기존 동작과 정확히 같다.
    """

    learning_steps: tuple[int, ...] = ()
    relearning_steps: tuple[int, ...] = ()
    graduating_interval_days: int = 1


DEFAULT_STEPS = StepConfig()


@dataclass(frozen=True)
class Sm2GradeResult:
    state: Sm2State
    memorization_status: MemorizationStatus


# Util method 
def round_half_up(x: float) -> int:
    return math.floor(x + 0.5)

def _round_half_up_2(x: float) -> float:
    return round_half_up(x * 100) / 100


def _as_utc(value: datetime) -> datetime:
    # 서버는 UTC로만 저장하지만, 테스트나 SQLite 경로에서 naive가 들어올 수 있다.
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def _is_review_card(state: Sm2State) -> bool:
    """졸업해서 일 단위 복습에 올라간 카드인가.

    학습 단계 중이면(learning_step != None) 아직 아니고, 간격이 잡혀 있으면 맞다.
    """
    return state.learning_step is None and (
        state.interval_days > 0 or state.repetitions > 0
    )


def _steps_for(state: Sm2State, config: StepConfig) -> tuple[int, ...]:
    """이 카드가 탈 단계 목록.

    졸업했다가 틀린 카드는 재학습 단계를, 아직 졸업 전인 카드는 학습 단계를 쓴다.
    안키가 learning과 relearning을 나누는 것과 같은 구분이다.

    판별에 lapses를 쓴다 — 아래 grade_again이 **복습 카드가 틀렸을 때만**
    lapses를 올리므로(안키와 동일), lapses > 0은 "졸업한 적이 있다"와 같은 뜻이다.
    """
    return config.relearning_steps if state.lapses > 0 else config.learning_steps


def grade_again(
    state: Sm2State, now: datetime, config: StepConfig = DEFAULT_STEPS
) -> Sm2GradeResult:
    """모름.

    ease를 깎고(하한 1.3), 연속 성공을 리셋하고, lapses를 누적한다.
    interval_days를 0으로 되돌리는 건 신규 단어와 같은 상태로 보낸다는 뜻이다 —
    다음 Good은 repetitions == 0 분기를 타서 이 값을 읽지 않는다.

    단계가 설정돼 있으면 첫 단계로 돌아간다. 안키와 같다.
    """
    now_utc = _as_utc(now)
    ease = max(MIN_EASE_FACTOR, _round_half_up_2(state.ease_factor - EASE_PENALTY))

    # lapses는 **복습 카드가 틀렸을 때만** 올린다. 안키와 같은 정의다 —
    # 아직 졸업 전인 카드가 학습 중에 틀리는 건 실패로 세지 않는다.
    # 이 정의가 _steps_for의 판별 근거이기도 하다.
    lapses = state.lapses + 1 if _is_review_card(state) else state.lapses

    failed = Sm2State(
        ease_factor=ease,
        interval_days=0,
        repetitions=0,
        lapses=lapses,
        due_at=now_utc,
        last_reviewed_at=now_utc,
    )
    steps = _steps_for(failed, config)

    if steps:
        return Sm2GradeResult(
            state=replace(
                failed,
                due_at=now_utc + timedelta(minutes=steps[0]),
                learning_step=0,
            ),
            memorization_status="unmemorized",
        )

    return Sm2GradeResult(
        state=replace(failed, due_at=now_utc + RELEARNING_STEP, learning_step=None),
        memorization_status="unmemorized",
    )


def _graduate(state: Sm2State, now_utc: datetime, config: StepConfig) -> Sm2GradeResult:
    """학습 단계를 다 통과했다 — 복습 카드로 올린다.

    간격은 Graduating interval을 쓴다. repetitions는 1이 되고, 이후부터는
    기존 SM-2 경로(1 → 3 → interval × ease)를 탄다.
    """
    interval = max(1, config.graduating_interval_days)
    return Sm2GradeResult(
        state=Sm2State(
            ease_factor=state.ease_factor,
            interval_days=interval,
            repetitions=1,
            lapses=state.lapses,
            due_at=now_utc + timedelta(days=interval),
            last_reviewed_at=now_utc,
            learning_step=None,
        ),
        memorization_status="unmemorized",
    )


def grade_good(
    state: Sm2State, now: datetime, config: StepConfig = DEFAULT_STEPS
) -> Sm2GradeResult:
    """외움.

    ease는 변하지 않는다 — Hard/Easy 분기가 없어서 올릴 방법 자체가 없다(의도된 동작).
    연속 성공 횟수에 따라 간격 계산이 달라진다.

    단계가 설정돼 있고 아직 졸업 전이면 다음 단계로 넘어간다(분 단위).
    마지막 단계를 통과하면 졸업해서 일 단위 복습으로 올라간다.
    """
    now_utc = _as_utc(now)

    steps = _steps_for(state, config)
    in_learning = state.learning_step is not None
    # 아직 한 번도 채점 안 한 카드도 단계가 있으면 학습 카드로 시작한다.
    starting_learning = (
        not in_learning and state.last_reviewed_at is None and bool(steps)
    )

    if steps and (in_learning or starting_learning):
        # 지금 앉아 있는 단계 → 다음 단계. 새 카드는 0번 단계에 있는 것으로 본다.
        current = state.learning_step if in_learning else 0
        next_step = current + 1
        if next_step >= len(steps):
            return _graduate(state, now_utc, config)

        return Sm2GradeResult(
            state=replace(
                state,
                due_at=now_utc + timedelta(minutes=steps[next_step]),
                last_reviewed_at=now_utc,
                learning_step=next_step,
            ),
            memorization_status="unmemorized",
        )

    if state.repetitions == 0:
        interval = 1
    elif state.repetitions == 1:
        interval = 3
    else:
        interval = round_half_up(state.interval_days * state.ease_factor)

    repetitions = state.repetitions + 1

    return Sm2GradeResult(
        state=Sm2State(
            ease_factor=state.ease_factor,
            interval_days=interval,
            repetitions=repetitions,
            lapses=state.lapses,
            due_at=now_utc + timedelta(days=interval),
            last_reviewed_at=now_utc,
            learning_step=None,
        ),
        # 두 번 연속 맞히면 외운 것으로 본다.
        memorization_status="memorized" if repetitions >= 2 else "unmemorized",
    )


@dataclass(frozen=True)
class GradePreview:
    """이 카드를 지금 채점하면 다음 복습까지 몇 초 남는지.

    화면의 버튼에 "1분" / "10일"을 띄우는 데 쓴다. 웹이 직접 계산하면 SM-2가
    세 번째로 구현되므로(Dart·Python에 이어) 서버가 미리 계산해 내려준다.
    """

    again_seconds: int
    good_seconds: int


def preview(
    state: Sm2State, now: datetime, config: StepConfig = DEFAULT_STEPS
) -> GradePreview:
    now_utc = _as_utc(now)
    again = grade_again(state, now_utc, config).state.due_at
    good = grade_good(state, now_utc, config).state.due_at
    return GradePreview(
        again_seconds=max(0, int((again - now_utc).total_seconds())),
        good_seconds=max(0, int((good - now_utc).total_seconds())),
    )


def grade(
    state: Sm2State,
    value: ReviewGrade,
    now: datetime,
    config: StepConfig = DEFAULT_STEPS,
) -> Sm2GradeResult:
    if value == "again":
        return grade_again(state, now, config)
    return grade_good(state, now, config)
