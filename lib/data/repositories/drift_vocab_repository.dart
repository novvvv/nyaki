import 'dart:convert';

import 'package:drift/drift.dart';
import 'package:uuid/uuid.dart';

import '../../models/word.dart';
import '../../models/word_book.dart';
import '../local/app_database.dart';
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
              imagePath: Value(_trimOrNull(input.imagePath)),
              memorizationStatus: WordMemorizationStatus.unmemorized.name,
              createdAt: now,
              updatedAt: now,
            ),
          );
      await (_db.update(_db.wordBooks)
            ..where((book) => book.id.equals(input.wordBookId)))
          .write(WordBooksCompanion(updatedAt: Value(now)));
      await _enqueueWord(id, 'upsert');
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
          imagePath: input.imagePath == null
              ? const Value.absent()
              : Value(_trimOrNull(input.imagePath)),
          memorizationStatus: input.memorizationStatus == null
              ? const Value.absent()
              : Value(input.memorizationStatus!.name),
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
    });
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
      imagePath: row.imagePath,
      memorizationStatus: WordMemorizationStatus.values.byName(
        row.memorizationStatus,
      ),
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
              'image_path': row.imagePath,
              'memorization_status': row.memorizationStatus,
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
}
