import 'package:drift/drift.dart';

import '../../models/word.dart';
import '../../models/word_book.dart';
import '../local/app_database.dart';
import '../vocab_constants.dart';
import 'vocab_repository.dart';

/// Drift(SQLite) 기반 로컬 영속 저장소.
class DriftVocabRepository implements VocabRepository {
  DriftVocabRepository(this._db);

  final AppDatabase _db;

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
  }

  @override
  Future<List<WordBook>> listWordBooks() async {
    await ensureInitialized();
    final rows = await (_db.select(_db.wordBooks)
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

    return getWordBook(id);
  }

  @override
  Future<void> deleteWordBook(String id) async {
    await ensureInitialized();
    final deleted = await (_db.delete(_db.wordBooks)
          ..where((book) => book.id.equals(id)))
        .go();
    if (deleted == 0) {
      throw VocabNotFoundException('단어장을 찾을 수 없습니다: $id');
    }
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
    });
  }

  Future<void> _requireWordBookExists(String id) async {
    await ensureInitialized();
    final exists = await (_db.select(_db.wordBooks)
          ..where((book) => book.id.equals(id)))
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

  String _newId(String prefix) =>
      '$prefix-${DateTime.now().microsecondsSinceEpoch}';

  String? _trimOrNull(String? value) {
    if (value == null) return null;
    final trimmed = value.trim();
    return trimmed.isEmpty ? null : trimmed;
  }
}
