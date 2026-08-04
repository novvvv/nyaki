import 'package:flutter_test/flutter_test.dart';

import 'package:nyaki/data/srs/sm2.dart';
import 'package:nyaki/models/word.dart';

void main() {
  final now = DateTime.utc(2026, 1, 1, 9, 0);

  // 계산에 dueAt/lastReviewedAt 초기값은 쓰이지 않음 (출력에서만 새로 채워짐)
  final initial = Sm2State(
    easeFactor: 2.5,
    intervalDays: 0,
    repetitions: 0,
    lapses: 0,
    dueAt: now,
  );

  group('gradeGood 연속 4회 — SRS.md 워크스루 표 1', () {
    test('#1 Good: reps 0→1, interval 1일', () {
      final result = gradeGood(initial, now);
      expect(result.state.easeFactor, 2.5);
      expect(result.state.repetitions, 1);
      expect(result.state.intervalDays, 1);
      expect(result.state.dueAt, now.add(const Duration(days: 1)));
      expect(result.memorizationStatus, WordMemorizationStatus.unmemorized);
    });

    test('#2 Good: reps 1→2, interval 3일 → memorized', () {
      final s1 = gradeGood(initial, now).state;
      final result = gradeGood(s1, now);
      expect(result.state.repetitions, 2);
      expect(result.state.intervalDays, 3);
      expect(result.state.dueAt, now.add(const Duration(days: 3)));
      expect(result.memorizationStatus, WordMemorizationStatus.memorized);
    });

    test('#3 Good: reps 2→3, interval round_half_up(3×2.5)=8일', () {
      final s1 = gradeGood(initial, now).state;
      final s2 = gradeGood(s1, now).state;
      final result = gradeGood(s2, now);
      expect(result.state.repetitions, 3);
      expect(result.state.intervalDays, 8);
      expect(result.state.dueAt, now.add(const Duration(days: 8)));
    });

    test('#4 Good: reps 3→4, interval round_half_up(8×2.5)=20일', () {
      final s1 = gradeGood(initial, now).state;
      final s2 = gradeGood(s1, now).state;
      final s3 = gradeGood(s2, now).state;
      final result = gradeGood(s3, now);
      expect(result.state.repetitions, 4);
      expect(result.state.intervalDays, 20);
      expect(result.state.dueAt, now.add(const Duration(days: 20)));
    });
  });

  group('4번째에 Again — SRS.md 워크스루 표 2', () {
    late Sm2State afterThreeGoods; // ease 2.5, interval 8, reps 3, lapses 0

    setUp(() {
      final s1 = gradeGood(initial, now).state;
      final s2 = gradeGood(s1, now).state;
      afterThreeGoods = gradeGood(s2, now).state;
    });

    test('#4 Again: ease 2.5→2.3, reps 3→0, interval 0, lapses 1, due는 즉시', () {
      final result = gradeAgain(afterThreeGoods, now);
      expect(result.state.easeFactor, 2.3);
      expect(result.state.repetitions, 0);
      expect(result.state.intervalDays, 0);
      expect(result.state.lapses, 1);
      expect(result.state.dueAt, now.add(relearningStep));
      expect(result.memorizationStatus, WordMemorizationStatus.unmemorized);
    });

    test('Again한 단어는 곧바로 복습 대상이 된다 (다음 테스트에서 바로 출제)', () {
      final result = gradeAgain(afterThreeGoods, now);
      // Word.isDue는 !dueAt.isAfter(now) 이므로, due가 now 이하이면 즉시 대상이다.
      expect(result.state.dueAt.isAfter(now), isFalse);
    });

    test('#5 Good: reps 0→1, interval 1일', () {
      final s4 = gradeAgain(afterThreeGoods, now).state;
      final result = gradeGood(s4, now);
      expect(result.state.easeFactor, 2.3);
      expect(result.state.repetitions, 1);
      expect(result.state.intervalDays, 1);
    });

    test('#6 Good: reps 1→2, interval 3일 → memorized', () {
      final s4 = gradeAgain(afterThreeGoods, now).state;
      final s5 = gradeGood(s4, now).state;
      final result = gradeGood(s5, now);
      expect(result.state.repetitions, 2);
      expect(result.state.intervalDays, 3);
      expect(result.memorizationStatus, WordMemorizationStatus.memorized);
    });

    test('#7 Good: reps 2→3, interval round_half_up(3×2.3)=7일', () {
      final s4 = gradeAgain(afterThreeGoods, now).state;
      final s5 = gradeGood(s4, now).state;
      final s6 = gradeGood(s5, now).state;
      final result = gradeGood(s6, now);
      expect(result.state.repetitions, 3);
      expect(result.state.intervalDays, 7);
    });
  });

  group('roundHalfUp', () {
    test("'.5'는 무조건 올림 (banker's rounding 아님)", () {
      expect(roundHalfUp(7.5), 8);
      expect(roundHalfUp(2.5), 3);
      expect(roundHalfUp(20.0), 20);
    });

    test('ease는 1.3 밑으로 안 내려감', () {
      final low = Sm2State(
        easeFactor: 1.35,
        intervalDays: 1,
        repetitions: 0,
        lapses: 0,
        dueAt: now,
      );
      final result = gradeAgain(low, now); // 1.35 - 0.20 = 1.15 → clamp
      expect(result.state.easeFactor, 1.3);
    });
  });
}
