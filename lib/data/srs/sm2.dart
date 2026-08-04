import 'dart:math' as math;

import '../../models/word.dart';

// SM-2 복습 스케줄 상태. `Word`의 `srs_*` 컬럼과 1:1 대응한다.
// 계산 규칙: docs/SRS.md

// ======================== ✨ sm2.dart ✨ ======================== // 

// ======================== ✨ Sm2State Class ✨ ======================== // 
//  - easeFactor : 단어가 얼마나 "쉬운"단어인지 나타내는 배수로 높을수록 다음 복습 간격이 크게 늘어난다. (default 2.5, min 1.3)
//  - intervalDays : 다음 복습 일자 
//  - repetitions : "외움"을 연속으로 몇 번 맞았는지 카운트. 한 번이라도 "모름"을 누르면 0으로 리셋된다. 
//  - lapses : "모름"을 총 몇 번 눌렀는지 확인" (통계용/지속누적)
//  - dueAt : 다음 복습이 예정된 실제 날짜/시각 "오늘 복습할 단어" 목록 추출 시 해당 값을 기준으로 조회한다. 
//  - lastReviewdAt : 마지막으로 채점한 시간. 한 번도 복습하지 않은 단어면 null 
// ===================================================================== //

class Sm2State {
  const Sm2State({
    required this.easeFactor,
    required this.intervalDays,
    required this.repetitions,
    required this.lapses,
    required this.dueAt,
    this.lastReviewedAt,
  });

  final double easeFactor;
  final int intervalDays;
  final int repetitions;
  final int lapses;
  final DateTime dueAt;
  final DateTime? lastReviewedAt;
}

// ======================== ✨ Sm2GradeResult Class ✨ ======================== // 
//  - state : 갱신된 SRS 상태 
//  - memorizationStatus : 암기 상태 (unmemorized/memorized)
// =========================================================================== //

class Sm2GradeResult {
  const Sm2GradeResult({
    required this.state,
    required this.memorizationStatus,
  });

  final Sm2State state;
  final WordMemorizationStatus memorizationStatus;
}

// ======================== ✨ Util Method ✨ ======================== //
// _roundHalfUp2 : 부동소수점 오차를 고려하여 깔끔하게 정리하는 유틸 메서드
// ================================================================== //
int roundHalfUp(double x) => (x + 0.5).floor();
double _roundHalfUp2(double x) => roundHalfUp(x * 100) / 100;

// ======================== ✨ relearningStep ✨ ======================== //
// Again(모름)을 누른 뒤 그 단어가 다시 "복습 대상"이 되기까지의 대기 시간.
//
// 0 = 즉시 대상. 진행 중인 세션의 출제 목록은 시작할 때 이미 고정돼 있으므로
// 그 세션 안에서 다시 튀어나오지는 않고, 세션을 끝내고 다음 번 테스트에
// 들어가면 곧바로 출제된다. (= "모른 단어는 다음 판에 바로 다시")
//
// 나중에 "10분 뒤에 다시" 같은 지연을 주고 싶으면 이 값만 바꾸면 된다.
// 계산 규칙 문서: docs/SRS.md
// ===================================================================== //
const Duration relearningStep = Duration.zero;

// ======================== ✨ gradeAgain Method ✨ ======================== //
// 🗒️ summary : Again(모름) Button 클릭 시 다음 SRS 상태를 계산하는 메서드
// 모름(Again) 채점.
// - ease 하락(하한 1.3), repetitions 리셋, lapses 누적
// - due는 relearningStep 뒤 (기본 0 = 즉시) → 다음 테스트에서 바로 다시 출제된다
// - intervalDays는 0으로 되돌린다 (아직 "일 단위 간격"에 진입하지 않은 재학습 상태.
//   신규 단어의 초기값과 동일하며, 다음 Good은 reps==0 분기라 이 값을 읽지 않는다)
//    넘겨받은 채점 시각을 UTC로 통일. (로컬 타임존 섞임 방지)
//    현재 ease에서 0.20을 깎은 뒤, 소수 둘째자리로 정리 (_roundHalfUp2) 후 1.3보다 낮아지면 1.3으로 고정한다.
// ======================================================================== //

Sm2GradeResult gradeAgain(Sm2State state, DateTime now) {

  final nowUtc = now.toUtc(); // 채점 시각 통일
  final ease = math.max(1.3, _roundHalfUp2(state.easeFactor - 0.20));

  final nextState = Sm2State(
    easeFactor: ease,
    intervalDays: 0,
    repetitions: 0,
    lapses: state.lapses + 1,
    dueAt: nowUtc.add(relearningStep),
    lastReviewedAt: nowUtc,
  );

  return Sm2GradeResult(
    state: nextState,
    memorizationStatus: WordMemorizationStatus.unmemorized,
  );
}

// ======================== ✨ gradeGood Method ✨ ======================== // 
// 🗒️ summary : Good(외움) Button 클릭 시 다음 SRS 상태를 계산하는 메서드 
// 외움(Good) 채점.
// - ease는 변하지 않음 (Hard/Easy 분기가 없어서 올릴 방법 자체가 없음 — 의도된 동작)
// - repetitions(연속 성공 횟수)에 따라 interval 계산 방식이 다름:
//    reps == 0 (첫 성공)      → interval = 1일
//    reps == 1 (두 번째 성공) → interval = 3일
//    reps >= 2 (그 이후)      → interval = round_half_up(intervalDays × easeFactor)
// - repetitions는 1 증가, dueAt은 nowUtc + interval일 뒤
// - repetitions가 2 이상이 되면 memorizationStatus가 memorized로 바뀜 (그 전까지 unmemorized)
// ======================================================================== //

Sm2GradeResult gradeGood(Sm2State state, DateTime now) {
  final nowUtc = now.toUtc();

  final int interval;
  if (state.repetitions == 0) {
    interval = 1;
  } else if (state.repetitions == 1) {
    interval = 3;
  } else {
    interval = roundHalfUp(state.intervalDays * state.easeFactor);
  }

  final repetitions = state.repetitions + 1;

  final nextState = Sm2State(
    easeFactor: state.easeFactor,
    intervalDays: interval,
    repetitions: repetitions,
    lapses: state.lapses,
    dueAt: nowUtc.add(Duration(days: interval)),
    lastReviewedAt: nowUtc,
  );

  final status = repetitions >= 2
      ? WordMemorizationStatus.memorized
      : WordMemorizationStatus.unmemorized;

  return Sm2GradeResult(state: nextState, memorizationStatus: status);
}
