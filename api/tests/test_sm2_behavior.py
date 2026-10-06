"""SM-2가 실제로 잘 도는지 — 기존 테스트가 덮지 않는 부분.

test_srs.py는 첫 몇 번의 채점을, test_srs_steps.py는 학습 단계를 덮는다.
여기서는 "오래 쓰면 어떻게 되나"와 "어떤 순서로 눌러도 깨지지 않나"를 본다.

1. 운영 기본값(학습 단계 0 · 10분, 재학습 0분, 졸업 1일)으로 한 카드의 일생
2. 연속 성공 간격표와 ease 하한
3. lapses는 졸업한 카드가 틀렸을 때만 센다
4. 버튼 미리보기("10분", "3일")가 실제 채점 결과와 같다
5. 시간대가 섞여 들어와도 같은 순간으로 계산한다
6. 무작위로 수천 번 눌러도 지켜지는 불변식 · 간격 상한(100년)
7. API로 며칠을 건너뛰며 한 카드를 끝까지 채점한다
"""

import random
import uuid
from datetime import datetime, timedelta, timezone

import pytest
from fastapi.testclient import TestClient

from app.core.auth import get_current_user_id
from app.core.database import Base, SessionLocal, engine
from app.main import app
from app.models import CardModel
from app.vocab import services
from app.vocab.srs import (
    MAX_INTERVAL_DAYS,
    MIN_EASE_FACTOR,
    Sm2State,
    StepConfig,
    grade,
    grade_again,
    grade_good,
    preview,
)

NOW = datetime(2026, 10, 7, 9, 0, tzinfo=timezone.utc)
MINUTE = timedelta(minutes=1)
DAY = timedelta(days=1)

# 운영 기본값 — services.DEFAULT_LEARNING_STEPS / DEFAULT_RELEARNING_STEPS
PROD = StepConfig(
    learning_steps=services.DEFAULT_LEARNING_STEPS,
    relearning_steps=services.DEFAULT_RELEARNING_STEPS,
    graduating_interval_days=1,
)
NO_STEPS = StepConfig()


def _new_card(at: datetime = NOW) -> Sm2State:
    return Sm2State(
        ease_factor=2.5,
        interval_days=0,
        repetitions=0,
        lapses=0,
        due_at=at,
        last_reviewed_at=None,
    )


def _goods(state: Sm2State, count: int, config: StepConfig = NO_STEPS) -> list[Sm2State]:
    """복습일마다 맞힌다. 각 채점 직후 상태를 모은다."""
    states = []
    now = NOW
    for _ in range(count):
        state = grade_good(state, now, config).state
        states.append(state)
        now = state.due_at
    return states


# ==================== 1. 운영 기본값으로 한 카드의 일생 ====================


def test_prod_defaults_new_card_lifecycle() -> None:
    """새 카드 → 바로 다시(0분) → 10분 → 졸업 1일 → 3일 → 8일."""
    card = _new_card()

    # 처음 본 카드에서 '외움'은 0분 단계를 건너뛰고 10분 단계로 간다.
    first = grade_good(card, NOW, PROD).state
    assert first.learning_step == 1
    assert first.due_at == NOW + 10 * MINUTE
    assert first.interval_days == 0
    assert first.repetitions == 0

    # 10분 단계를 맞히면 졸업 — 1일 뒤.
    graduated = grade_good(first, first.due_at, PROD).state
    assert graduated.learning_step is None
    assert graduated.interval_days == 1
    assert graduated.repetitions == 1
    assert graduated.due_at == first.due_at + DAY

    # 이후는 SM-2 그대로 — 3일, 그다음 round(3 × 2.5) = 8일.
    second = grade_good(graduated, graduated.due_at, PROD).state
    assert second.interval_days == 3
    third = grade_good(second, second.due_at, PROD).state
    assert third.interval_days == 8


def test_prod_defaults_again_on_new_card_comes_back_at_once() -> None:
    """처음 본 카드를 모른다고 하면 0분 단계 — 이 세션 안에서 바로 다시 나온다."""
    result = grade_again(_new_card(), NOW, PROD).state

    assert result.learning_step == 0
    assert result.due_at == NOW
    assert result.lapses == 0  # 졸업 전 실패는 lapse가 아니다


def test_prod_defaults_lapse_relearns_then_restarts_at_one_day() -> None:
    """20일짜리 카드를 틀리면 재학습(0분) → 맞히면 1일부터 다시 쌓는다.

    고전 SM-2와 같다 — 틀린 카드는 긴 간격을 잃는다. ease만 깎인 채 남는다.
    """
    review = Sm2State(
        ease_factor=2.5,
        interval_days=20,
        repetitions=4,
        lapses=0,
        due_at=NOW,
        last_reviewed_at=NOW - 20 * DAY,
    )

    failed = grade_again(review, NOW, PROD).state
    assert failed.learning_step == 0
    assert failed.due_at == NOW  # 재학습 0분
    assert failed.interval_days == 0
    assert failed.repetitions == 0
    assert failed.lapses == 1
    assert failed.ease_factor == 2.3

    relearned = grade_good(failed, NOW, PROD).state
    assert relearned.learning_step is None
    assert relearned.interval_days == 1
    assert relearned.repetitions == 1
    assert relearned.ease_factor == 2.3

    # 깎인 ease로 다시 쌓인다 — 1, 3, round(3 × 2.3) = 7
    next_ = grade_good(relearned, relearned.due_at, PROD).state
    assert next_.interval_days == 3
    after = grade_good(next_, next_.due_at, PROD).state
    assert after.interval_days == 7


# ==================== 2. 간격표와 ease ====================


def test_interval_table_for_consecutive_goods() -> None:
    """ease 2.5에서 매번 맞히면 1 → 3 → 8 → 20 → 50 → 125 → 313 → 783일."""
    intervals = [state.interval_days for state in _goods(_new_card(), 8)]

    assert intervals == [1, 3, 8, 20, 50, 125, 313, 783]


def test_good_never_changes_ease_and_never_shrinks_interval() -> None:
    states = _goods(_new_card(), 10)

    assert {state.ease_factor for state in states} == {2.5}
    intervals = [state.interval_days for state in states]
    assert intervals == sorted(intervals)


def test_ease_drops_by_point_two_and_stops_at_floor() -> None:
    """2.5 → 2.3 → 2.1 → 1.9 → 1.7 → 1.5 → 1.3 → 1.3. 소수점 오차가 쌓이지 않는다."""
    state = _new_card()
    eases = []
    for _ in range(8):
        state = grade_again(state, NOW, NO_STEPS).state
        eases.append(state.ease_factor)

    assert eases == [2.3, 2.1, 1.9, 1.7, 1.5, 1.3, 1.3, 1.3]
    assert min(eases) == MIN_EASE_FACTOR


def test_floor_ease_still_grows_the_interval() -> None:
    """ease 하한(1.3)에서도 간격은 늘어난다 — 0으로 수렴하거나 줄지 않는다."""
    state = Sm2State(
        ease_factor=1.3,
        interval_days=3,
        repetitions=2,
        lapses=6,
        due_at=NOW,
        last_reviewed_at=NOW - 3 * DAY,
    )
    intervals = []
    now = NOW
    for _ in range(5):
        state = grade_good(state, now, NO_STEPS).state
        intervals.append(state.interval_days)
        now = state.due_at

    # round(3×1.3)=4, round(4×1.3)=5, round(5×1.3)=7(6.5 올림), round(7×1.3)=9, round(9×1.3)=12
    assert intervals == [4, 5, 7, 9, 12]


def test_due_is_exactly_interval_days_after_grading() -> None:
    """다음 복습일은 '채점한 시각 + 간격'이다. 원래 복습일이 아니라."""
    late = NOW + 5 * DAY  # 복습일보다 5일 늦게 맞혔다
    card = Sm2State(
        ease_factor=2.5,
        interval_days=3,
        repetitions=2,
        lapses=0,
        due_at=NOW,
        last_reviewed_at=NOW - 3 * DAY,
    )

    result = grade_good(card, late, NO_STEPS).state

    assert result.interval_days == 8
    assert result.due_at == late + 8 * DAY
    assert result.last_reviewed_at == late


def test_memorized_after_two_goods_and_forgotten_on_again() -> None:
    card = _new_card()
    first = grade_good(card, NOW, NO_STEPS)
    second = grade_good(first.state, first.state.due_at, NO_STEPS)
    failed = grade_again(second.state, second.state.due_at, NO_STEPS)

    assert first.memorization_status == "unmemorized"
    assert second.memorization_status == "memorized"
    assert failed.memorization_status == "unmemorized"


# ==================== 3. lapses ====================


def test_lapses_count_only_graduated_cards() -> None:
    """새 카드 · 학습 중 · 재학습 중 실패는 lapse가 아니다. 졸업한 카드만 센다."""
    new_fail = grade_again(_new_card(), NOW, PROD).state
    assert new_fail.lapses == 0

    learning = grade_good(_new_card(), NOW, PROD).state  # 10분 단계
    learning_fail = grade_again(learning, NOW, PROD).state
    assert learning_fail.lapses == 0

    graduated = grade_good(learning, NOW, PROD).state
    lapse = grade_again(graduated, NOW, PROD).state
    assert lapse.lapses == 1

    # 재학습 단계에서 또 틀려도 두 번 세지 않는다.
    relearning_fail = grade_again(lapse, NOW, PROD).state
    assert relearning_fail.lapses == 1


# ==================== 4. 버튼 미리보기 ====================


@pytest.mark.parametrize(
    "card",
    [
        pytest.param(_new_card(), id="새 카드"),
        pytest.param(grade_good(_new_card(), NOW, PROD).state, id="10분 단계"),
        pytest.param(
            Sm2State(2.5, 8, 3, 0, NOW, NOW - 8 * DAY), id="8일짜리 복습 카드"
        ),
        pytest.param(
            grade_again(Sm2State(2.5, 8, 3, 0, NOW, NOW - 8 * DAY), NOW, PROD).state,
            id="재학습 중",
        ),
    ],
)
def test_preview_matches_actual_grading(card: Sm2State) -> None:
    """버튼에 뜨는 시간과 실제로 눌렀을 때의 다음 복습이 같아야 한다."""
    shown = preview(card, NOW, PROD)
    again = grade_again(card, NOW, PROD).state.due_at
    good = grade_good(card, NOW, PROD).state.due_at

    assert shown.again_seconds == int((again - NOW).total_seconds())
    assert shown.good_seconds == int((good - NOW).total_seconds())


def test_preview_values_under_prod_defaults() -> None:
    review = Sm2State(2.5, 8, 3, 0, NOW, NOW - 8 * DAY)

    assert preview(_new_card(), NOW, PROD).again_seconds == 0
    assert preview(_new_card(), NOW, PROD).good_seconds == 600  # 10분
    assert preview(review, NOW, PROD).good_seconds == 20 * 86400  # round(8×2.5)


# ==================== 5. 시간대 ====================


def test_timezone_of_now_does_not_change_the_result() -> None:
    """같은 순간을 KST로 넘겨도 UTC와 같은 답을 내고, UTC로 저장한다."""
    kst = timezone(timedelta(hours=9))
    card = Sm2State(2.5, 3, 2, 0, NOW, NOW - 3 * DAY)

    from_utc = grade_good(card, NOW, PROD).state
    from_kst = grade_good(card, NOW.astimezone(kst), PROD).state

    assert from_kst == from_utc
    assert from_kst.due_at.utcoffset() == timedelta(0)


# ==================== 6. 무작위 불변식 ====================


def _check_invariants(before: Sm2State, after: Sm2State, now: datetime) -> None:
    assert MIN_EASE_FACTOR <= after.ease_factor <= before.ease_factor
    assert 0 <= after.interval_days <= MAX_INTERVAL_DAYS
    assert after.repetitions >= 0
    assert after.due_at >= now  # 과거로 잡히는 일은 없다
    assert after.last_reviewed_at == now
    assert 0 <= after.lapses - before.lapses <= 1
    if after.learning_step is not None:
        # 학습 · 재학습 중인 카드는 아직 간격도 연속 성공도 없다.
        assert after.interval_days == 0
        assert after.repetitions == 0
    else:
        # 운영 기본값에서는 채점된 카드가 학습 단계 밖이면 반드시 1일 이상이다.
        # 암기율(OK = 간격 1일 이상)이 이 성질에 기대고 있다.
        assert after.interval_days >= 1


@pytest.mark.parametrize("seed", [1, 7, 42, 2026])
def test_random_grading_keeps_invariants(seed: int) -> None:
    rng = random.Random(seed)
    state = _new_card()
    now = NOW
    for _ in range(3000):
        value = "good" if rng.random() < 0.6 else "again"
        before = state
        state = grade(state, value, now, PROD).state
        _check_invariants(before, state, now)
        # 제때 · 일찍 · 늦게 복습하는 경우를 섞는다. 3000번 동안 시계가 너무
        # 멀리 가지 않도록 시간 이동은 최대 60일로 묶는다.
        wait = min(state.due_at - now, 60 * DAY)
        now += wait + rng.choice([timedelta(0), -wait / 2, 3 * DAY])


def test_interval_is_capped_at_one_hundred_years() -> None:
    """간격 상한은 36500일(100년). 안키의 Maximum interval 기본값과 같다.

    상한이 없을 때는 연속으로 맞히면 2.5배씩 커져 17번째에 다음 복습일이 서기
    9999년을 넘어 OverflowError가 났다. 동기화로 큰 간격을 가진 카드가 올라오면
    그 카드가 든 채점 요청 전체가 500으로 실패했다.
    """
    states = _goods(_new_card(), 30)

    assert max(state.interval_days for state in states) == MAX_INTERVAL_DAYS
    # 상한에 닿은 뒤로는 그대로 머문다.
    assert [state.interval_days for state in states[-3:]] == [MAX_INTERVAL_DAYS] * 3


def test_huge_interval_from_sync_is_pulled_down_to_the_cap() -> None:
    """앱이 올린 카드의 간격이 비정상적으로 커도 채점이 터지지 않는다."""
    card = Sm2State(2.5, 2_000_000, 20, 0, NOW, NOW - DAY)

    result = grade_good(card, NOW, PROD).state

    assert result.interval_days == MAX_INTERVAL_DAYS
    assert result.due_at == NOW + MAX_INTERVAL_DAYS * DAY
    assert preview(card, NOW, PROD).good_seconds == MAX_INTERVAL_DAYS * 86400


# ==================== 7. API로 며칠을 건너뛰며 ====================


def _client() -> tuple[TestClient, str]:
    Base.metadata.create_all(bind=engine)
    user = f"sm2-{uuid.uuid4().hex[:8]}"
    app.dependency_overrides[get_current_user_id] = lambda: user
    client = TestClient(app)
    stamp = NOW.isoformat()
    assert (
        client.put(
            "/v1/word-books/b1",
            json={"id": "b1", "title": "b1", "created_at": stamp, "updated_at": stamp},
        ).status_code
        == 200
    )
    assert (
        client.put(
            "/v1/word-books/b1/words/w1",
            json={
                "id": "w1",
                "word_book_id": "b1",
                "term": "揺れる",
                "meaning": "흔들리다",
                "created_at": stamp,
                "updated_at": stamp,
            },
        ).status_code
        == 200
    )
    return client, user


def _card(user: str) -> CardModel:
    with SessionLocal() as session:
        return session.get(CardModel, ("w1:recognition", user))


def _due_ids(client: TestClient) -> list[str]:
    return [card["id"] for card in client.get("/v1/review/due?limit=50").json()["cards"]]


def test_api_lifecycle_over_days(monkeypatch: pytest.MonkeyPatch) -> None:
    """서버 시각을 옮겨가며 한 카드를 채점한다. 출제 여부와 저장값이 순수 함수와 같다."""
    client, user = _client()
    clock = {"now": NOW}
    monkeypatch.setattr(services, "utc_now", lambda: clock["now"])
    expected = _card(user)
    state = Sm2State(
        ease_factor=expected.srs_ease_factor,
        interval_days=expected.srs_interval_days,
        repetitions=expected.srs_repetitions,
        lapses=expected.srs_lapses,
        due_at=expected.srs_due_at,
        last_reviewed_at=expected.srs_last_reviewed_at,
        learning_step=expected.srs_learning_step,
    )

    def press(value: str) -> None:
        nonlocal state
        assert _due_ids(client) == ["w1:recognition"], "채점할 때는 출제 중이어야 한다"
        response = client.post(
            "/v1/review/grades",
            json={
                "grades": [
                    {
                        "id": uuid.uuid4().hex,
                        "word_id": "w1",
                        "card_id": "w1:recognition",
                        "grade": value,
                        "reviewed_at": clock["now"].isoformat(),
                    }
                ]
            },
        )
        assert response.json()["applied"] == 1
        state = grade(state, value, clock["now"], PROD).state
        saved = _card(user)
        assert saved.srs_interval_days == state.interval_days
        assert saved.srs_repetitions == state.repetitions
        assert saved.srs_lapses == state.lapses
        assert saved.srs_ease_factor == state.ease_factor
        assert saved.srs_learning_step == state.learning_step
        assert services._as_utc(saved.srs_due_at) == state.due_at

    def jump_to_due() -> None:
        # 복습일 1분 전에는 안 나오고, 복습일이 되면 나온다.
        due = services._as_utc(_card(user).srs_due_at)
        if due > clock["now"]:
            clock["now"] = due - MINUTE
            assert _due_ids(client) == []
        clock["now"] = due

    # 새 카드 → 외움(10분) → 외움(졸업 1일) → 3일 → 모름(재학습) → 외움(1일) → 3일
    for value in ["good", "good", "good", "good", "again", "good", "good"]:
        jump_to_due()
        press(value)

    final = _card(user)
    assert final.srs_lapses == 1
    assert final.srs_ease_factor == 2.3
    assert final.srs_interval_days == 3
    assert final.srs_learning_step is None
