import 'package:flutter_test/flutter_test.dart';
import 'package:nyaki/models/word.dart';
import 'package:nyaki/models/word_book.dart';

/// 단어장의 집계값. 목록 화면과 테스트 화면이 이 값으로 숫자를 보여준다.
void main() {
  final now = DateTime.now().toUtc();

  Word makeWord(
    String id, {
    bool isDeleted = false,
    bool memorized = false,
    Duration dueIn = Duration.zero,
  }) {
    return Word(
      id: id,
      wordBookId: 'b1',
      term: id,
      meaning: '뜻',
      memorizationStatus: memorized
          ? WordMemorizationStatus.memorized
          : WordMemorizationStatus.unmemorized,
      srsDueAt: now.add(dueIn),
      createdAt: now,
      updatedAt: now,
      isDeleted: isDeleted,
    );
  }

  WordBook makeBook(List<Word> words) => WordBook(
        id: 'b1',
        title: '냐키',
        createdAt: now,
        updatedAt: now,
        words: words,
      );

  group('활성 단어', () {
    test('삭제된 단어는 개수에서 빠진다 — soft delete라 행은 남아 있다', () {
      final book = makeBook([
        makeWord('a'),
        makeWord('b', isDeleted: true),
      ]);

      expect(book.wordCount, 1);
      expect(book.activeWords.map((w) => w.id), ['a']);
    });
  });

  group('dueCount — 오늘 복습할 개수', () {
    test('예정 시각이 지난 단어만 센다', () {
      final book = makeBook([
        makeWord('a', dueIn: const Duration(minutes: -1)),
        makeWord('b', dueIn: const Duration(minutes: -5)),
        makeWord('c', dueIn: const Duration(hours: 5)),
      ]);

      expect(book.dueCount, 2);
    });

    test('삭제된 단어는 due로 세지 않는다', () {
      final book = makeBook([
        makeWord('a', dueIn: const Duration(minutes: -1), isDeleted: true),
      ]);

      expect(book.dueCount, 0);
    });
  });

  group('learningRate — 목록에 뜨는 암기율', () {
    test('외운 단어 비율을 반올림한다', () {
      final book = makeBook([
        makeWord('a', memorized: true),
        makeWord('b', memorized: true),
        makeWord('c'),
      ]);

      expect(book.memorizedCount, 2);
      expect(book.learningRate, 67);
    });

    test('단어가 없으면 0 — 0으로 나누지 않는다', () {
      expect(makeBook([]).learningRate, 0);
    });

    test('metaLabel은 개수와 암기율을 함께 보여준다', () {
      final book = makeBook([
        makeWord('a', memorized: true),
        makeWord('b'),
      ]);

      expect(book.metaLabel, '2개 · 암기 50%');
    });
  });
}
