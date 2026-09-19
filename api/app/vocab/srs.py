"""SM-2 복습 스케줄 계산.

lib/data/srs/sm2.dart를 그대로 옮긴 것이다. 앱은 오프라인이 필요해서 계속 Dart로
계산하고, 웹은 로컬 DB가 없어서 여기를 쓴다. **두 구현이 같은 답을 내야 한다** —
같은 단어를 앱과 웹에서 채점했을 때 다음 복습일이 달라지면 사용자가 바로 알아챈다.

정답지는 test/data/srs/sm2_test.dart다. 이 파일을 고치면 그쪽 테스트도 같이 봐야 한다.
(sm2.dart 주석이 참조하는 docs/SRS.md는 현재 저장소에 없다.)
"""

from __future__ import annotations

import math
from dataclasses import dataclass
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


def grade_again(state: Sm2State, now: datetime) -> Sm2GradeResult:
    """모름.

    ease를 깎고(하한 1.3), 연속 성공을 리셋하고, lapses를 누적한다.
    interval_days를 0으로 되돌리는 건 신규 단어와 같은 상태로 보낸다는 뜻이다 —
    다음 Good은 repetitions == 0 분기를 타서 이 값을 읽지 않는다.
    """
    now_utc = _as_utc(now)
    ease = max(MIN_EASE_FACTOR, _round_half_up_2(state.ease_factor - EASE_PENALTY))

    return Sm2GradeResult(
        state=Sm2State(
            ease_factor=ease,
            interval_days=0,
            repetitions=0,
            lapses=state.lapses + 1,
            due_at=now_utc + RELEARNING_STEP,
            last_reviewed_at=now_utc,
        ),
        memorization_status="unmemorized",
    )


def grade_good(state: Sm2State, now: datetime) -> Sm2GradeResult:
    """외움.

    ease는 변하지 않는다 — Hard/Easy 분기가 없어서 올릴 방법 자체가 없다(의도된 동작).
    연속 성공 횟수에 따라 간격 계산이 달라진다.
    """
    now_utc = _as_utc(now)

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
        ),
        # 두 번 연속 맞히면 외운 것으로 본다.
        memorization_status="memorized" if repetitions >= 2 else "unmemorized",
    )


def grade(state: Sm2State, value: ReviewGrade, now: datetime) -> Sm2GradeResult:
    if value == "again":
        return grade_again(state, now)
    return grade_good(state, now)
