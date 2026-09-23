import 'dart:convert';

import 'package:drift/drift.dart' hide isNull;
import 'package:drift/native.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:nyaki/data/local/app_database.dart';
import 'package:nyaki/data/repositories/drift_vocab_repository.dart';
import 'package:nyaki/data/repositories/vocab_repository.dart';
import 'package:nyaki/models/word.dart';

/// 로컬 저장소. 메모리 DB에 실제 스키마를 올려 검증한다.
///
/// 여기서 보는 것은 **채점 결과가 DB와 outbox에 제대로 남는지**다.
/// SM-2 계산 자체는 test/data/srs가 보고, 이 파일은 그 결과를 어떻게 적는지를 본다.
/// 동기화는 outbox에 쌓인 것만 서버로 가므로, 빠뜨리면 그 변경은 영영 안 간다.
void main() {
  late AppDatabase db;
  late DriftVocabRepository repository;

  setUp(() async {
    db = AppDatabase.forTesting(NativeDatabase.memory());
    repository = DriftVocabRepository(db);
    await repository.ensureInitialized();
  });

  tearDown(() async {
    await db.close();
  });

  Future<Word> seedWord({String term = 'cat'}) async {
    final book = await repository.createWordBook(
      const CreateWordBookInput(title: '테스트 단어장'),
    );
    return repository.createWord(
      CreateWordInput(wordBookId: book.id, term: term, meaning: '고양이'),
    );
  }

  Future<List<SyncOutboxRow>> outbox() => db.select(db.syncOutbox).get();

  group('createWord', () {
    test('새 단어는 즉시 복습 대상이다 — due가 created_at이다', () async {
      final word = await seedWord();

      expect(word.isDue, isTrue);
      expect(word.srsIntervalDays, 0);
      expect(word.srsRepetitions, 0);
      expect(word.srsLearningStep, isNull);
    });

    test('outbox에 upsert가 쌓인다 — 이게 있어야 서버로 간다', () async {
      final word = await seedWord();
      final rows = await outbox();

      final wordRows = rows.where((row) => row.entityId == word.id);
      expect(wordRows, hasLength(1));
      expect(wordRows.first.operation, 'upsert');
      expect(wordRows.first.entityType, 'word');
    });
  });

  group('gradeWord — 단계 설정이 없을 때', () {
    test('외움은 1일 뒤로 민다', () async {
      final word = await seedWord();

      final graded = await repository.gradeWord(
        word.wordBookId,
        word.id,
        ReviewGrade.good,
      );

      expect(graded.srsIntervalDays, 1);
      expect(graded.srsRepetitions, 1);
      expect(graded.srsLearningStep, isNull);
      expect(graded.isDue, isFalse);
    });

    test('모름은 즉시 다시 대상이 된다', () async {
      final word = await seedWord();

      final graded = await repository.gradeWord(
        word.wordBookId,
        word.id,
        ReviewGrade.again,
      );

      expect(graded.isDue, isTrue);
      expect(graded.srsIntervalDays, 0);
    });

    test('채점도 outbox에 쌓인다', () async {
      final word = await seedWord();
      final before = (await outbox()).length;

      await repository.gradeWord(word.wordBookId, word.id, ReviewGrade.good);

      expect((await outbox()).length, greaterThan(before));
    });
  });

  group('gradeWord — 학습 단계를 켰을 때', () {
    /// 서버가 내려준 설정을 ProgressRepository가 적어두는 자리.
    Future<void> setSteps(String learning, String relearning) async {
      await db.into(db.userProgress).insertOnConflictUpdate(
            UserProgressCompanion.insert(
              userId: 'test-user',
              learningSteps: Value(learning),
              relearningSteps: Value(relearning),
              graduatingIntervalDays: const Value(1),
            ),
          );
    }

    test('새 단어의 외움은 일이 아니라 분 단위로 간다', () async {
      await setSteps('1,10', '10');
      final word = await seedWord();

      final graded = await repository.gradeWord(
        word.wordBookId,
        word.id,
        ReviewGrade.good,
      );

      expect(graded.srsLearningStep, 1);
      expect(graded.srsIntervalDays, 0); // 아직 졸업 전
      final delta = graded.srsDueAt.difference(DateTime.now().toUtc());
      expect(delta.inMinutes, inInclusiveRange(9, 10));
    });

    test('마지막 단계를 통과하면 졸업해서 일 단위가 된다', () async {
      await setSteps('1,10', '10');
      final word = await seedWord();

      await repository.gradeWord(word.wordBookId, word.id, ReviewGrade.good);
      final graduated = await repository.gradeWord(
        word.wordBookId,
        word.id,
        ReviewGrade.good,
      );

      expect(graduated.srsLearningStep, isNull);
      expect(graduated.srsIntervalDays, 1);
      expect(graduated.srsRepetitions, 1);
    });

    test('설정이 빈 문자열이면 단계를 쓰지 않는다', () async {
      await setSteps('', '');
      final word = await seedWord();

      final graded = await repository.gradeWord(
        word.wordBookId,
        word.id,
        ReviewGrade.good,
      );

      expect(graded.srsIntervalDays, 1);
      expect(graded.srsLearningStep, isNull);
    });
  });

  group('deleteWord', () {
    test('soft delete — 목록에서는 빠지고 outbox에는 delete가 쌓인다', () async {
      final word = await seedWord();

      await repository.deleteWord(word.wordBookId, word.id);

      final words = await repository.listWords(word.wordBookId);
      expect(words, isEmpty);

      final deleteRows =
          (await outbox()).where((row) => row.operation == 'delete');
      expect(deleteRows, isNotEmpty);
    });
  });

  group('outbox payload', () {
    test('학습 단계가 페이로드에 실린다 — 빠지면 서버가 단계를 모른다', () async {
      await db.into(db.userProgress).insertOnConflictUpdate(
            UserProgressCompanion.insert(
              userId: 'test-user',
              learningSteps: const Value('1,10'),
            ),
          );
      final word = await seedWord();
      await repository.gradeWord(word.wordBookId, word.id, ReviewGrade.good);

      final rows = await outbox();
      final payload = jsonDecode(rows.last.payloadJson) as Map<String, dynamic>;

      expect(payload.containsKey('srs_learning_step'), isTrue);
      expect(payload['srs_learning_step'], 1);
    });
  });

  group('카드 — 안키의 Note/Card 구분', () {
    test('단어를 만들면 recognition 카드가 함께 생긴다', () async {
      final word = await seedWord();

      final cards = await db.select(db.cards).get();
      expect(cards, hasLength(1));
      expect(cards.first.id, '${word.id}:recognition');
      expect(cards.first.kind, 'recognition');
      expect(cards.first.srsDueAt, word.srsDueAt);
    });

    test('카드도 outbox에 실린다 — 안 실으면 서버가 카드를 모른다', () async {
      final word = await seedWord();

      final cardRows =
          (await outbox()).where((row) => row.entityType == 'card').toList();
      expect(cardRows, hasLength(1));
      expect(cardRows.first.entityId, '${word.id}:recognition');

      final payload =
          jsonDecode(cardRows.first.payloadJson) as Map<String, dynamic>;
      expect(payload['kind'], 'recognition');
      expect(payload['word_id'], word.id);
    });

    test('채점은 카드에 쓰이고 단어에도 복사된다', () async {
      final word = await seedWord();

      await repository.gradeWord(word.wordBookId, word.id, ReviewGrade.good);

      final card = await (db.select(db.cards)
            ..where((c) => c.id.equals('${word.id}:recognition')))
          .getSingle();
      expect(card.srsIntervalDays, 1);
      expect(card.srsRepetitions, 1);

      // 목록·암기율이 아직 단어를 읽는다. 서버도 같은 방식으로 복사한다.
      final updated = await repository.getWord(word.wordBookId, word.id);
      expect(updated.srsIntervalDays, 1);
    });

    test('채점하면 카드 변경이 outbox에 쌓인다', () async {
      final word = await seedWord();
      final before =
          (await outbox()).where((row) => row.entityType == 'card').length;

      await repository.gradeWord(word.wordBookId, word.id, ReviewGrade.good);

      final after =
          (await outbox()).where((row) => row.entityType == 'card').length;
      expect(after, greaterThan(before));
    });

    test('단어를 지우면 카드도 빠진다', () async {
      final word = await seedWord();

      await repository.deleteWord(word.wordBookId, word.id);

      final card = await (db.select(db.cards)
            ..where((c) => c.wordId.equals(word.id)))
          .getSingle();
      expect(card.isDeleted, isTrue);
    });
  });
}
