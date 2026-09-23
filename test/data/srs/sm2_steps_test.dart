import 'package:flutter_test/flutter_test.dart';
import 'package:nyaki/data/srs/sm2.dart';
import 'package:nyaki/models/word.dart';

/// 학습 단계 — 서버 `api/tests/test_srs_steps.py`와 **같은 입출력**이어야 한다.
/// 같은 단어를 앱과 웹에서 채점했을 때 다음 복습일이 갈리면 사용자가 바로 알아챈다.
void main() {
  final now = DateTime.utc(2026, 9, 23, 12, 0);

  const ankiLike = StepConfig(
    learningSteps: [1, 10],
    relearningSteps: [10],
    graduatingIntervalDays: 1,
  );

  Sm2State newCard() => Sm2State(
        easeFactor: 2.5,
        intervalDays: 0,
        repetitions: 0,
        lapses: 0,
        dueAt: now,
      );

  test('새 카드에서 외움은 1분이 아니라 10분', () {
    final result = gradeGood(newCard(), now, ankiLike);

    expect(result.state.learningStep, 1);
    expect(result.state.dueAt, now.add(const Duration(minutes: 10)));
    expect(result.state.intervalDays, 0);
    expect(result.state.repetitions, 0);
  });

  test('새 카드에서 모름은 첫 단계로', () {
    final result = gradeAgain(newCard(), now, ankiLike);

    expect(result.state.learningStep, 0);
    expect(result.state.dueAt, now.add(const Duration(minutes: 1)));
    // 아직 졸업 전인 카드가 틀린 건 lapse로 세지 않는다 — 안키와 같다.
    expect(result.state.lapses, 0);
  });

  test('마지막 단계를 통과하면 일 단위로 졸업', () {
    final atLast = Sm2State(
      easeFactor: 2.5,
      intervalDays: 0,
      repetitions: 0,
      lapses: 0,
      dueAt: now,
      lastReviewedAt: now,
      learningStep: 1,
    );

    final result = gradeGood(atLast, now, ankiLike);

    expect(result.state.learningStep, isNull);
    expect(result.state.intervalDays, 1);
    expect(result.state.repetitions, 1);
  });

  test('졸업 간격은 설정값을 따른다', () {
    final atLast = Sm2State(
      easeFactor: 2.5,
      intervalDays: 0,
      repetitions: 0,
      lapses: 0,
      dueAt: now,
      lastReviewedAt: now,
      learningStep: 1,
    );
    const config = StepConfig(
      learningSteps: [1, 10],
      relearningSteps: [10],
      graduatingIntervalDays: 3,
    );

    final result = gradeGood(atLast, now, config);

    expect(result.state.intervalDays, 3);
    expect(result.state.dueAt, now.add(const Duration(days: 3)));
  });

  test('복습 카드가 틀리면 재학습 단계로', () {
    final review = Sm2State(
      easeFactor: 2.5,
      intervalDays: 20,
      repetitions: 4,
      lapses: 0,
      dueAt: now,
      lastReviewedAt: now.subtract(const Duration(days: 20)),
    );

    final result = gradeAgain(review, now, ankiLike);

    expect(result.state.learningStep, 0);
    expect(result.state.dueAt, now.add(const Duration(minutes: 10)));
    expect(result.state.lapses, 1);
    expect(result.state.easeFactor, 2.3);
  });

  test('재학습을 마치면 다시 복습 카드로', () {
    final relearning = Sm2State(
      easeFactor: 2.3,
      intervalDays: 0,
      repetitions: 0,
      lapses: 1,
      dueAt: now,
      lastReviewedAt: now,
      learningStep: 0,
    );

    final result = gradeGood(relearning, now, ankiLike);

    expect(result.state.learningStep, isNull);
    expect(result.state.intervalDays, 1);
    expect(result.state.repetitions, 1);
  });

  test('안키 기본 구성 한 바퀴 — 1분 → 10분 → 1일 → 3일', () {
    var state = newCard();

    state = gradeAgain(state, now, ankiLike).state;
    expect(state.dueAt, now.add(const Duration(minutes: 1)));

    final at1m = now.add(const Duration(minutes: 1));
    state = gradeGood(state, at1m, ankiLike).state;
    expect(state.dueAt, at1m.add(const Duration(minutes: 10)));

    final at11m = at1m.add(const Duration(minutes: 10));
    state = gradeGood(state, at11m, ankiLike).state;
    expect(state.learningStep, isNull);
    expect(state.intervalDays, 1);

    final tomorrow = at11m.add(const Duration(days: 1));
    state = gradeGood(state, tomorrow, ankiLike).state;
    expect(state.intervalDays, 3);
    expect(state.repetitions, 2);
  });

  test('단계를 안 쓰면 예전 그대로', () {
    final again = gradeAgain(newCard(), now);
    expect(again.state.dueAt, now);
    expect(again.state.learningStep, isNull);

    final good = gradeGood(newCard(), now);
    expect(good.state.dueAt, now.add(const Duration(days: 1)));
    expect(good.state.intervalDays, 1);
    expect(good.memorizationStatus, WordMemorizationStatus.unmemorized);
  });
}
