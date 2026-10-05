import 'package:flutter_test/flutter_test.dart';
import 'package:nyaki/models/word.dart';

/// 단어 한 개의 파생 속성.
/// isDue는 출제 목록의 기준이라 경계(정확히 지금)가 어느 쪽인지가 중요하다.
void main() {
  Word makeWord({
    DateTime? dueAt,
    WordMemorizationStatus status = WordMemorizationStatus.unmemorized,
    bool isDeleted = false,
  }) {
    final now = DateTime.now().toUtc();
    return Word(
      id: 'w1',
      wordBookId: 'b1',
      term: 'cat',
      meaning: '고양이',
      memorizationStatus: status,
      srsDueAt: dueAt ?? now,
      createdAt: now,
      updatedAt: now,
      isDeleted: isDeleted,
    );
  }

  group('isDue — 복습 대상 판정', () {
    test('예정 시각이 지났으면 대상', () {
      final word = makeWord(
        dueAt: DateTime.now().toUtc().subtract(const Duration(minutes: 1)),
      );
      expect(word.isDue, isTrue);
    });

    test('예정 시각이 아직이면 대상이 아니다', () {
      final word = makeWord(
        dueAt: DateTime.now().toUtc().add(const Duration(minutes: 1)),
      );
      expect(word.isDue, isFalse);
    });

    test('정확히 지금이면 대상 — 경계는 포함이다', () {
      // 학습 단계의 "즉시 다시"(relearningStep = 0)가 이 경계에 걸린다.
      final word = makeWord(
        dueAt: DateTime.now().toUtc().subtract(const Duration(microseconds: 1)),
      );
      expect(word.isDue, isTrue);
    });
  });

  group('isMemorized', () {
    test('memorized 상태만 true', () {
      expect(
        makeWord(status: WordMemorizationStatus.memorized).isMemorized,
        isTrue,
      );
      expect(
        makeWord(status: WordMemorizationStatus.unmemorized).isMemorized,
        isFalse,
      );
    });
  });

  group('copyWith', () {
    test('넘긴 값만 바꾸고 나머지는 유지한다', () {
      final word = makeWord();
      final updated = word.copyWith(meaning: '야옹이');

      expect(updated.meaning, '야옹이');
      expect(updated.term, word.term);
      expect(updated.srsDueAt, word.srsDueAt);
    });

    test('학습 단계도 옮겨 담는다', () {
      final word = makeWord().copyWith(srsLearningStep: 1);
      expect(word.srsLearningStep, 1);
      expect(word.copyWith(meaning: '뜻').srsLearningStep, 1);
    });
  });
}
