import 'dart:convert';

import 'package:drift/drift.dart';
import 'package:uuid/uuid.dart';

import '../../models/word.dart';
import '../../models/word_book.dart';
import '../local/app_database.dart';
import '../srs/sm2.dart';
import '../vocab_constants.dart';
import 'vocab_repository.dart';

/// Drift(SQLite) 기반 로컬 영속 저장소.
class DriftVocabRepository implements VocabRepository {
  DriftVocabRepository(this._db);

  final AppDatabase _db;
  static const _uuid = Uuid();

  /// SyncCoordinator가 outbox/cursor를 관리할 때 사용하는 로컬 DB.
  AppDatabase get database => _db;

  static Future<DriftVocabRepository> create() async {
    final repository = DriftVocabRepository(AppDatabase());
    await repository.ensureInitialized();
    return repository;
  }

  static DriftVocabRepository forTesting(AppDatabase database) {
    return DriftVocabRepository(database);
  }

  Future<void> close() => _db.close();

  @override
  Future<void> ensureInitialized() async {
    final count = await _db.select(_db.wordBooks).get();
    if (count.isNotEmpty) return;

    final now = DateTime.now();
    await _db.into(_db.wordBooks).insert(
          WordBooksCompanion.insert(
            id: VocabConstants.defaultWordBookId,
            title: VocabConstants.defaultWordBookTitle,
            description: Value(VocabConstants.defaultWordBookDescription),
            createdAt: now,
            updatedAt: now,
          ),
        );
    await _enqueueWordBook(VocabConstants.defaultWordBookId, 'upsert');
  }

  static const _localBootstrapUserId = '__local_bootstrap__';

  /// 앱 최초 sync 이전에 로컬에만 있던 데이터를 outbox에 한 번 올린다.
  Future<bool> isLocalBootstrapDone() async {
    final row = await (_db.select(_db.syncState)
          ..where((state) => state.userId.equals(_localBootstrapUserId)))
        .getSingleOrNull();
    return row != null;
  }

  Future<void> markLocalBootstrapDone() async {
    await _db.into(_db.syncState).insertOnConflictUpdate(
          SyncStateCompanion.insert(
            userId: _localBootstrapUserId,
            cursor: const Value(1),
          ),
        );
  }

  Future<void> bootstrapLocalEntitiesForSync() async {
    await ensureInitialized();

    final books = await (_db.select(_db.wordBooks)
          ..where((book) => book.isDeleted.equals(false)))
        .get();
    for (final book in books) {
      if (await _hasPendingOutboxEntry('word_book', book.id)) continue;
      await _enqueueWordBook(book.id, 'upsert');
    }

    final words = await (_db.select(_db.wordEntries)
          ..where((word) => word.isDeleted.equals(false)))
        .get();
    for (final word in words) {
      if (await _hasPendingOutboxEntry('word', word.id)) continue;
      await _enqueueWord(word.id, 'upsert');
    }
  }

  @override
  Future<List<WordBook>> listWordBooks() async {
    await ensureInitialized();
    final rows = await (_db.select(_db.wordBooks)
          ..where((book) => book.isDeleted.equals(false))
          ..orderBy([(book) => OrderingTerm.asc(book.createdAt)]))
        .get();
    return Future.wait(rows.map(_loadWordBook));
  }

  @override
  Future<WordBook> getWordBook(String id) async {
    await ensureInitialized();
    final row = await (_db.select(_db.wordBooks)
          ..where((book) => book.id.equals(id)))
        .getSingleOrNull();
    if (row == null) {
      throw VocabNotFoundException('단어장을 찾을 수 없습니다: $id');
    }
    return _loadWordBook(row);
  }

  @override
  Future<WordBook> createWordBook(CreateWordBookInput input) async {
    await ensureInitialized();
    final title = input.title.trim();
    if (title.isEmpty) {
      throw ArgumentError('단어장 이름은 필수입니다.');
    }

    final now = DateTime.now();
    final id = _newId('wordbook');
    await _db.into(_db.wordBooks).insert(
          WordBooksCompanion.insert(
            id: id,
            title: title,
            description: Value(_trimOrNull(input.description)),
            createdAt: now,
            updatedAt: now,
          ),
        );
    await _enqueueWordBook(id, 'upsert');
    return getWordBook(id);
  }

  @override
  Future<WordBook> updateWordBook(String id, UpdateWordBookInput input) async {
    await getWordBook(id);
    final title = input.title?.trim();
    if (title != null && title.isEmpty) {
      throw ArgumentError('단어장 이름은 비워둘 수 없습니다.');
    }

    final now = DateTime.now();
    await (_db.update(_db.wordBooks)..where((book) => book.id.equals(id)))
        .write(
      WordBooksCompanion(
        title: title == null ? const Value.absent() : Value(title),
        description: input.description == null
            ? const Value.absent()
            : Value(_trimOrNull(input.description)),
        updatedAt: Value(now),
      ),
    );
    await _enqueueWordBook(id, 'upsert');

    return getWordBook(id);
  }

  @override
  Future<void> deleteWordBook(String id) async {
    await ensureInitialized();
    final now = DateTime.now();
    final deleted = await (_db.update(_db.wordBooks)
          ..where((book) => book.id.equals(id) & book.isDeleted.equals(false)))
        .write(WordBooksCompanion(
            isDeleted: const Value(true), updatedAt: Value(now)));
    if (deleted == 0) {
      throw VocabNotFoundException('단어장을 찾을 수 없습니다: $id');
    }
    await _enqueueWordBook(id, 'delete');
  }

  @override
  Future<List<Word>> listWords(String wordBookId) async {
    await _requireWordBookExists(wordBookId);
    final rows = await (_db.select(_db.wordEntries)
          ..where(
            (word) =>
                word.wordBookId.equals(wordBookId) &
                word.isDeleted.equals(false),
          )
          ..orderBy([(word) => OrderingTerm.asc(word.createdAt)]))
        .get();
    return rows.map(_mapWord).toList(growable: false);
  }

  @override
  Future<Word> getWord(String wordBookId, String wordId) async {
    await _requireWordBookExists(wordBookId);
    final row = await (_db.select(_db.wordEntries)
          ..where(
            (word) =>
                word.id.equals(wordId) &
                word.wordBookId.equals(wordBookId) &
                word.isDeleted.equals(false),
          ))
        .getSingleOrNull();
    if (row == null) {
      throw VocabNotFoundException('단어를 찾을 수 없습니다: $wordId');
    }
    return _mapWord(row);
  }

  @override
  Future<Word> createWord(CreateWordInput input) async {
    final term = input.term.trim();
    final meaning = input.meaning.trim();
    if (term.isEmpty || meaning.isEmpty) {
      throw ArgumentError('단어와 의미는 필수입니다.');
    }

    await _requireWordBookExists(input.wordBookId);
    final now = DateTime.now();
    final id = _newId('word');

    await _db.transaction(() async {
      await _db.into(_db.wordEntries).insert(
            WordEntriesCompanion.insert(
              id: id,
              wordBookId: input.wordBookId,
              term: term,
              meaning: meaning,
              pronunciation: Value(_trimOrNull(input.pronunciation)),
              description: Value(_trimOrNull(input.description)),
              example: Value(_trimOrNull(input.example)),
              exampleMeaning: Value(_trimOrNull(input.exampleMeaning)),
              imagePath: Value(_trimOrNull(input.imagePath)),
              memorizationStatus: WordMemorizationStatus.unmemorized.name,
              isBookmarked: Value(input.isBookmarked),
              tagsJson: Value(_encodeTags(input.tags)),
              createdAt: now,
              updatedAt: now,
            ),
          );
      await (_db.update(_db.wordBooks)
            ..where((book) => book.id.equals(input.wordBookId)))
          .write(WordBooksCompanion(updatedAt: Value(now)));
      await _enqueueWord(id, 'upsert');
      await _syncCardsForWord(id);
    });

    return getWord(input.wordBookId, id);
  }

  @override
  Future<Word> updateWord(
    String wordBookId,
    String wordId,
    UpdateWordInput input,
  ) async {
    await getWord(wordBookId, wordId);
    final term = input.term?.trim();
    final meaning = input.meaning?.trim();
    if (term != null && term.isEmpty) {
      throw ArgumentError('단어는 비워둘 수 없습니다.');
    }
    if (meaning != null && meaning.isEmpty) {
      throw ArgumentError('의미는 비워둘 수 없습니다.');
    }

    final now = DateTime.now();
    await _db.transaction(() async {
      await (_db.update(_db.wordEntries)
            ..where((word) => word.id.equals(wordId)))
          .write(
        WordEntriesCompanion(
          term: term == null ? const Value.absent() : Value(term),
          meaning: meaning == null ? const Value.absent() : Value(meaning),
          pronunciation: input.pronunciation == null
              ? const Value.absent()
              : Value(_trimOrNull(input.pronunciation)),
          description: input.description == null
              ? const Value.absent()
              : Value(_trimOrNull(input.description)),
          example: input.example == null
              ? const Value.absent()
              : Value(_trimOrNull(input.example)),
          exampleMeaning: input.exampleMeaning == null
              ? const Value.absent()
              : Value(_trimOrNull(input.exampleMeaning)),
          imagePath: input.imagePath == null
              ? const Value.absent()
              : Value(_trimOrNull(input.imagePath)),
          memorizationStatus: input.memorizationStatus == null
              ? const Value.absent()
              : Value(input.memorizationStatus!.name),
          isBookmarked: input.isBookmarked == null
              ? const Value.absent()
              : Value(input.isBookmarked!),
          tagsJson: input.tags == null
              ? const Value.absent()
              : Value(_encodeTags(input.tags!)),
          updatedAt: Value(now),
        ),
      );
      await (_db.update(_db.wordBooks)
            ..where((book) => book.id.equals(wordBookId)))
          .write(WordBooksCompanion(updatedAt: Value(now)));
      await _enqueueWord(wordId, 'upsert');
    });

    return getWord(wordBookId, wordId);
  }

  @override
  Future<void> deleteWord(String wordBookId, String wordId) async {
    await getWord(wordBookId, wordId);
    final now = DateTime.now();

    await _db.transaction(() async {
      await (_db.update(_db.wordEntries)
            ..where((word) => word.id.equals(wordId)))
          .write(
        WordEntriesCompanion(
          isDeleted: const Value(true),
          updatedAt: Value(now),
        ),
      );
      await (_db.update(_db.wordBooks)
            ..where((book) => book.id.equals(wordBookId)))
          .write(WordBooksCompanion(updatedAt: Value(now)));
      await _enqueueWord(wordId, 'delete');
      await _syncCardsForWord(wordId);
    });
  }


  // ==================== ✨ _loadStepConfig ✨ ==================== //
  // 로컬에 캐시된 복습 흐름 설정을 StepConfig로 읽는다.
  // 서버 `/v1/progress`가 내려준 값을 ProgressRepository가 적어둔 것이다.
  // 행이 없거나 값이 비어 있으면 단계 없음 = 기존 동작.
  // ============================================================== //
  Future<StepConfig> _loadStepConfig() async {
    final row = await _db.select(_db.userProgress).getSingleOrNull();
    if (row == null) return defaultStepConfig;

    List<int> parse(String? raw) {
      if (raw == null || raw.isEmpty) return const [];
      return raw
          .split(RegExp(r'[,\s]+'))
          .map((chunk) => int.tryParse(chunk.trim()) ?? 0)
          .where((minutes) => minutes > 0)
          .toList(growable: false);
    }

    return StepConfig(
      learningSteps: parse(row.learningSteps),
      relearningSteps: parse(row.relearningSteps),
      graduatingIntervalDays: row.graduatingIntervalDays ?? 1,
    );
  }

  // ==================== ✨ gradeWord ✨ ==================== //
  // Feature.
  //   - 지금 보고 있는 단어 1개를 SM-2 로직을 통해 채점하여, 저장하는 함수이다.
  //   - 스와이프/버튼을 누를 때마다 호출된다.
  //
  // Parameter
  //   wordBookId - 단어장 id
  //   wordId - 단어 id
  //   grade - 등급 (모름/외움)
  // =========================================================== //
  @override
  Future<Word> gradeWord(
    String wordBookId,
    String wordId,
    ReviewGrade grade,
  ) async {
    // DB에서 id + wordBookId가 일치하고 삭제되지 않은 단어를 찾아 Word로 반환한다.
    // "채점 전" 현재 상태 전체가 필요하다 — SM-2 계산이 이전 ease/interval에 의존한다.
    final row = await getWord(wordBookId, wordId);

    // 채점 대상은 단어가 아니라 **카드**다(안키의 Card).
    // 앱 화면은 아직 recognition 카드만 다룬다 — recall/cloze는 웹에서 낸다.
    // 카드가 없으면(카드 도입 전 데이터) 만들어 두고 시작한다.
    await _syncCardsForWord(wordId);
    final cardId = cardIdFor(wordId, 'recognition');
    final card = await (_db.select(_db.cards)..where((c) => c.id.equals(cardId)))
        .getSingleOrNull();

    final state = card != null
        ? Sm2State(
            easeFactor: card.srsEaseFactor,
            intervalDays: card.srsIntervalDays,
            repetitions: card.srsRepetitions,
            lapses: card.srsLapses,
            dueAt: card.srsDueAt,
            lastReviewedAt: card.srsLastReviewedAt,
            learningStep: card.srsLearningStep,
          )
        : Sm2State(
            easeFactor: row.srsEaseFactor,
            intervalDays: row.srsIntervalDays,
            repetitions: row.srsRepetitions,
            lapses: row.srsLapses,
            dueAt: row.srsDueAt,
            lastReviewedAt: row.srsLastReviewedAt,
            learningStep: row.srsLearningStep,
          );

    // 복습 흐름 설정은 서버가 진실이고 앱은 캐시를 읽는다.
    // 캐시가 없으면(로그인 전·구버전 Hub) 단계 없이 예전 방식으로 돈다.
    final config = await _loadStepConfig();

    final now = DateTime.now();
    final result = grade == ReviewGrade.again
        ? gradeAgain(state, now, config)
        : gradeGood(state, now, config);

    await _db.transaction(() async {
      // 1. 카드에 되쓴다 — 여기가 진짜 SRS 상태다.
      await (_db.update(_db.cards)..where((c) => c.id.equals(cardId))).write(
        CardsCompanion(
          srsEaseFactor: Value(result.state.easeFactor),
          srsIntervalDays: Value(result.state.intervalDays),
          srsRepetitions: Value(result.state.repetitions),
          srsLapses: Value(result.state.lapses),
          srsDueAt: Value(result.state.dueAt),
          srsLastReviewedAt: Value(result.state.lastReviewedAt),
          srsLearningStep: Value(result.state.learningStep),
          updatedAt: Value(now),
        ),
      );
      await _enqueueCard(cardId, 'upsert');

      // 2. 단어 행에도 복사한다. 목록·암기율이 아직 단어를 읽고,
      //    서버도 recognition 카드를 같은 방식으로 단어에 반영한다.
      await (_db.update(_db.wordEntries)..where((w) => w.id.equals(wordId)))
          .write(
        WordEntriesCompanion(
          srsEaseFactor: Value(result.state.easeFactor),
          srsIntervalDays: Value(result.state.intervalDays),
          srsRepetitions: Value(result.state.repetitions),
          srsLapses: Value(result.state.lapses),
          srsDueAt: Value(result.state.dueAt),
          srsLastReviewedAt: Value(result.state.lastReviewedAt),
          srsLearningStep: Value(result.state.learningStep),
          memorizationStatus: Value(result.memorizationStatus.name),
          updatedAt: Value(now),
        ),
      );
      await _enqueueWord(wordId, 'upsert');
    });

    return getWord(wordBookId, wordId);
  }

  Future<void> _requireWordBookExists(String id) async {
    await ensureInitialized();
    final exists = await (_db.select(_db.wordBooks)
          ..where((book) => book.id.equals(id) & book.isDeleted.equals(false)))
        .getSingleOrNull();
    if (exists == null) {
      throw VocabNotFoundException('단어장을 찾을 수 없습니다: $id');
    }
  }

  Future<WordBook> _loadWordBook(WordBookRow row) async {
    final wordRows = await (_db.select(_db.wordEntries)
          ..where((word) => word.wordBookId.equals(row.id))
          ..orderBy([(word) => OrderingTerm.asc(word.createdAt)]))
        .get();

    return WordBook(
      id: row.id,
      title: row.title,
      description: row.description,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      words: wordRows.map(_mapWord).toList(growable: false),
    );
  }

  Word _mapWord(WordRow row) {
    return Word(
      id: row.id,
      wordBookId: row.wordBookId,
      term: row.term,
      meaning: row.meaning,
      pronunciation: row.pronunciation,
      description: row.description,
      example: row.example,
      exampleMeaning: row.exampleMeaning,
      imagePath: row.imagePath,
      memorizationStatus: WordMemorizationStatus.values.byName(
        row.memorizationStatus,
      ),
      isBookmarked: row.isBookmarked,
      tags: _decodeTags(row.tagsJson),
      srsEaseFactor: row.srsEaseFactor,
      srsIntervalDays: row.srsIntervalDays,
      srsRepetitions: row.srsRepetitions,
      srsLapses: row.srsLapses,
      srsDueAt: row.srsDueAt,
      srsLastReviewedAt: row.srsLastReviewedAt,
      srsLearningStep: row.srsLearningStep,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      isDeleted: row.isDeleted,
    );
  }

  Future<bool> _hasPendingOutboxEntry(String entityType, String entityId) async {
    final row = await (_db.select(_db.syncOutbox)
          ..where(
            (outbox) =>
                outbox.entityType.equals(entityType) &
                outbox.entityId.equals(entityId),
          ))
        .getSingleOrNull();
    return row != null;
  }

  // ==================== ✨ 카드 ✨ ==================== //
  // 안키의 Card. 단어는 정보를 담고 출제되는 것은 카드다.
  // 서버 api/app/vocab/services.py의 sync_cards_for_word와 같은 규칙이어야 한다 —
  // 오프라인에서 만든 카드가 서버에서 만든 것과 같은 id를 가져야 충돌 없이 합쳐진다.
  // ==================================================== //

  static const _defaultCardKinds = ['recognition'];

  /// 카드 id는 규칙으로 만든다 — 서버와 같은 값이어야 한다.
  static String cardIdFor(String wordId, String kind) => '$wordId:$kind';

  List<String> _parseCardKinds(String? raw) {
    if (raw == null || raw.isEmpty) return _defaultCardKinds;
    final kinds = raw
        .split(RegExp(r'[,\s]+'))
        .map((chunk) => chunk.trim())
        .where((chunk) =>
            chunk == 'recognition' || chunk == 'recall' || chunk == 'cloze')
        .toList(growable: false);
    return kinds.isEmpty ? _defaultCardKinds : kinds;
  }

  /// 단어의 카드를 단어장 설정에 맞춘다. 없으면 만들고, 빠진 종류는 soft delete.
  Future<void> _syncCardsForWord(String wordId) async {
    final word = await (_db.select(_db.wordEntries)
          ..where((w) => w.id.equals(wordId)))
        .getSingleOrNull();
    if (word == null) return;

    final book = await (_db.select(_db.wordBooks)
          ..where((b) => b.id.equals(word.wordBookId)))
        .getSingleOrNull();
    final kinds =
        word.isDeleted ? <String>[] : _parseCardKinds(book?.cardKinds);

    final existing = {
      for (final card in await (_db.select(_db.cards)
            ..where((c) => c.wordId.equals(wordId)))
          .get())
        card.kind: card,
    };

    for (final kind in kinds) {
      final card = existing[kind];
      if (card == null) {
        await _db.into(_db.cards).insert(
              CardsCompanion.insert(
                id: cardIdFor(wordId, kind),
                wordId: Value(wordId),
                kind: kind,
                srsDueAt: word.srsDueAt,
                createdAt: word.createdAt,
                updatedAt: word.updatedAt,
              ),
            );
        await _enqueueCard(cardIdFor(wordId, kind), 'upsert');
      } else if (card.isDeleted) {
        await (_db.update(_db.cards)..where((c) => c.id.equals(card.id)))
            .write(CardsCompanion(
          isDeleted: const Value(false),
          updatedAt: Value(word.updatedAt),
        ));
        await _enqueueCard(card.id, 'upsert');
      }
    }

    for (final entry in existing.entries) {
      if (!kinds.contains(entry.key) && !entry.value.isDeleted) {
        await (_db.update(_db.cards)..where((c) => c.id.equals(entry.value.id)))
            .write(CardsCompanion(
          isDeleted: const Value(true),
          updatedAt: Value(word.updatedAt),
        ));
        await _enqueueCard(entry.value.id, 'upsert');
      }
    }
  }

  Future<void> _enqueueCard(String id, String operation) async {
    final row = await (_db.select(_db.cards)..where((c) => c.id.equals(id)))
        .getSingle();
    await _db.into(_db.syncOutbox).insert(
          SyncOutboxCompanion.insert(
            entityType: 'card',
            entityId: id,
            operation: operation,
            payloadJson: jsonEncode({
              'id': row.id,
              'word_id': row.wordId,
              'kind': row.kind,
              'srs_ease_factor': row.srsEaseFactor,
              'srs_interval_days': row.srsIntervalDays,
              'srs_repetitions': row.srsRepetitions,
              'srs_lapses': row.srsLapses,
              'srs_due_at': row.srsDueAt.toUtc().toIso8601String(),
              'srs_last_reviewed_at':
                  row.srsLastReviewedAt?.toUtc().toIso8601String(),
              'srs_learning_step': row.srsLearningStep,
              'created_at': row.createdAt.toUtc().toIso8601String(),
              'updated_at': row.updatedAt.toUtc().toIso8601String(),
              'is_deleted': row.isDeleted,
            }),
            createdAt: DateTime.now().toUtc(),
          ),
        );
  }

  Future<void> _enqueueWordBook(String id, String operation) async {
    final row = await (_db.select(_db.wordBooks)
          ..where((book) => book.id.equals(id)))
        .getSingle();
    await _db.into(_db.syncOutbox).insert(
          SyncOutboxCompanion.insert(
            entityType: 'word_book',
            entityId: id,
            operation: operation,
            payloadJson: jsonEncode({
              'id': row.id,
              'title': row.title,
              'description': row.description,
              'created_at': row.createdAt.toUtc().toIso8601String(),
              'updated_at': row.updatedAt.toUtc().toIso8601String(),
              'is_deleted': row.isDeleted,
            }),
            createdAt: DateTime.now().toUtc(),
          ),
        );
  }

  Future<void> _enqueueWord(String id, String operation) async {
    final row = await (_db.select(_db.wordEntries)
          ..where((word) => word.id.equals(id)))
        .getSingle();
    await _db.into(_db.syncOutbox).insert(
          SyncOutboxCompanion.insert(
            entityType: 'word',
            entityId: id,
            operation: operation,
            payloadJson: jsonEncode({
              'id': row.id,
              'word_book_id': row.wordBookId,
              'term': row.term,
              'meaning': row.meaning,
              'pronunciation': row.pronunciation,
              'description': row.description,
              'example': row.example,
              'example_meaning': row.exampleMeaning,
              'image_path': row.imagePath,
              'memorization_status': row.memorizationStatus,
              'is_bookmarked': row.isBookmarked,
              'tags': _decodeTags(row.tagsJson),
              'srs_ease_factor': row.srsEaseFactor,
              'srs_interval_days': row.srsIntervalDays,
              'srs_repetitions': row.srsRepetitions,
              'srs_lapses': row.srsLapses,
              'srs_due_at': row.srsDueAt.toUtc().toIso8601String(),
              'srs_last_reviewed_at':
                  row.srsLastReviewedAt?.toUtc().toIso8601String(),
              'srs_learning_step': row.srsLearningStep,
              'created_at': row.createdAt.toUtc().toIso8601String(),
              'updated_at': row.updatedAt.toUtc().toIso8601String(),
              'is_deleted': row.isDeleted,
            }),
            createdAt: DateTime.now().toUtc(),
          ),
        );
  }

  String _newId(String prefix) => '$prefix-${_uuid.v4()}';

  String? _trimOrNull(String? value) {
    if (value == null) return null;
    final trimmed = value.trim();
    return trimmed.isEmpty ? null : trimmed;
  }

  String _encodeTags(List<String> tags) {
    final cleaned = tags
        .map((tag) => tag.trim())
        .where((tag) => tag.isNotEmpty)
        .toList(growable: false);
    return jsonEncode(cleaned);
  }

  List<String> _decodeTags(String raw) {
    try {
      final decoded = jsonDecode(raw);
      if (decoded is! List) return const [];
      return decoded
          .whereType<String>()
          .map((tag) => tag.trim())
          .where((tag) => tag.isNotEmpty)
          .toList(growable: false);
    } catch (_) {
      return const [];
    }
  }
}
