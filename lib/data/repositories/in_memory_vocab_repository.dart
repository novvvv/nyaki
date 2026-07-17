import '../../models/word.dart';
import '../../models/word_book.dart';
import '../vocab_constants.dart';
import 'vocab_repository.dart';

/// 테스트 전용 인메모리 구현. 앱 런타임은 DriftVocabRepository 사용.
class InMemoryVocabRepository implements VocabRepository {
  InMemoryVocabRepository();

  final List<WordBook> _wordBooks = [];

  @override
  Future<void> ensureInitialized() async {
    if (_wordBooks.isNotEmpty) return;

    final now = DateTime.now();
    _wordBooks.add(
      WordBook(
        id: VocabConstants.defaultWordBookId,
        title: VocabConstants.defaultWordBookTitle,
        description: VocabConstants.defaultWordBookDescription,
        createdAt: now,
        updatedAt: now,
      ),
    );
  }

  @override
  Future<List<WordBook>> listWordBooks() async {
    await ensureInitialized();
    return _wordBooks.map(_cloneWordBook).toList(growable: false);
  }

  @override
  Future<WordBook> getWordBook(String id) async {
    await ensureInitialized();
    return _cloneWordBook(_requireWordBook(id));
  }

  @override
  Future<WordBook> createWordBook(CreateWordBookInput input) async {
    await ensureInitialized();
    final title = input.title.trim();
    if (title.isEmpty) {
      throw ArgumentError('단어장 이름은 필수입니다.');
    }

    final now = DateTime.now();
    final wordBook = WordBook(
      id: _newId('wordbook'),
      title: title,
      description: _trimOrNull(input.description),
      createdAt: now,
      updatedAt: now,
    );
    _wordBooks.add(wordBook);
    return _cloneWordBook(wordBook);
  }

  @override
  Future<WordBook> updateWordBook(String id, UpdateWordBookInput input) async {
    await ensureInitialized();
    final index = _wordBookIndex(id);
    final current = _wordBooks[index];
    final title = input.title?.trim();

    if (title != null && title.isEmpty) {
      throw ArgumentError('단어장 이름은 비워둘 수 없습니다.');
    }

    final updated = current.copyWith(
      title: title ?? current.title,
      description: input.description == null
          ? current.description
          : _trimOrNull(input.description),
      updatedAt: DateTime.now(),
    );
    _wordBooks[index] = updated;
    return _cloneWordBook(updated);
  }

  @override
  Future<void> deleteWordBook(String id) async {
    await ensureInitialized();
    final index = _wordBookIndex(id);
    _wordBooks.removeAt(index);
  }

  @override
  Future<List<Word>> listWords(String wordBookId) async {
    final wordBook = _requireWordBook(wordBookId);
    return wordBook.activeWords.map(_cloneWord).toList(growable: false);
  }

  @override
  Future<Word> getWord(String wordBookId, String wordId) async {
    return _cloneWord(_requireWord(wordBookId, wordId));
  }

  @override
  Future<Word> createWord(CreateWordInput input) async {
    final term = input.term.trim();
    final meaning = input.meaning.trim();
    if (term.isEmpty || meaning.isEmpty) {
      throw ArgumentError('단어와 의미는 필수입니다.');
    }

    final index = _wordBookIndex(input.wordBookId);
    final now = DateTime.now();
    final word = Word(
      id: _newId('word'),
      wordBookId: input.wordBookId,
      term: term,
      meaning: meaning,
      pronunciation: _trimOrNull(input.pronunciation),
      description: _trimOrNull(input.description),
      example: _trimOrNull(input.example),
      imagePath: _trimOrNull(input.imagePath),
      createdAt: now,
      updatedAt: now,
    );

    final wordBook = _wordBooks[index];
    _wordBooks[index] = wordBook.copyWith(
      words: [...wordBook.words, word],
      updatedAt: now,
    );
    return _cloneWord(word);
  }

  @override
  Future<Word> updateWord(
    String wordBookId,
    String wordId,
    UpdateWordInput input,
  ) async {
    final bookIndex = _wordBookIndex(wordBookId);
    final wordBook = _wordBooks[bookIndex];
    final wordIndex = _wordIndex(wordBook, wordId);
    final current = wordBook.words[wordIndex];

    final term = input.term?.trim();
    final meaning = input.meaning?.trim();
    if (term != null && term.isEmpty) {
      throw ArgumentError('단어는 비워둘 수 없습니다.');
    }
    if (meaning != null && meaning.isEmpty) {
      throw ArgumentError('의미는 비워둘 수 없습니다.');
    }

    final now = DateTime.now();
    final updated = current.copyWith(
      term: term ?? current.term,
      meaning: meaning ?? current.meaning,
      pronunciation: input.pronunciation == null
          ? current.pronunciation
          : _trimOrNull(input.pronunciation),
      description: input.description == null
          ? current.description
          : _trimOrNull(input.description),
      example:
          input.example == null ? current.example : _trimOrNull(input.example),
      imagePath: input.imagePath == null
          ? current.imagePath
          : _trimOrNull(input.imagePath),
      memorizationStatus:
          input.memorizationStatus ?? current.memorizationStatus,
      updatedAt: now,
    );

    final words = [...wordBook.words];
    words[wordIndex] = updated;
    _wordBooks[bookIndex] = wordBook.copyWith(words: words, updatedAt: now);
    return _cloneWord(updated);
  }

  @override
  Future<void> deleteWord(String wordBookId, String wordId) async {
    final bookIndex = _wordBookIndex(wordBookId);
    final wordBook = _wordBooks[bookIndex];
    final wordIndex = _wordIndex(wordBook, wordId);
    final now = DateTime.now();

    final words = [...wordBook.words];
    words[wordIndex] = words[wordIndex].copyWith(
      isDeleted: true,
      updatedAt: now,
    );
    _wordBooks[bookIndex] = wordBook.copyWith(words: words, updatedAt: now);
  }

  WordBook _requireWordBook(String id) {
    for (final wordBook in _wordBooks) {
      if (wordBook.id == id) return wordBook;
    }
    throw VocabNotFoundException('단어장을 찾을 수 없습니다: $id');
  }

  int _wordBookIndex(String id) {
    final index = _wordBooks.indexWhere((book) => book.id == id);
    if (index == -1) {
      throw VocabNotFoundException('단어장을 찾을 수 없습니다: $id');
    }
    return index;
  }

  Word _requireWord(String wordBookId, String wordId) {
    final wordBook = _requireWordBook(wordBookId);
    for (final word in wordBook.words) {
      if (word.id == wordId && !word.isDeleted) return word;
    }
    throw VocabNotFoundException('단어를 찾을 수 없습니다: $wordId');
  }

  int _wordIndex(WordBook wordBook, String wordId) {
    final index = wordBook.words.indexWhere((word) => word.id == wordId);
    if (index == -1) {
      throw VocabNotFoundException('단어를 찾을 수 없습니다: $wordId');
    }
    return index;
  }

  String _newId(String prefix) =>
      '$prefix-${DateTime.now().microsecondsSinceEpoch}';

  String? _trimOrNull(String? value) {
    if (value == null) return null;
    final trimmed = value.trim();
    return trimmed.isEmpty ? null : trimmed;
  }

  WordBook _cloneWordBook(WordBook wordBook) {
    return wordBook.copyWith(
      words: wordBook.words.map(_cloneWord).toList(growable: false),
    );
  }

  Word _cloneWord(Word word) => word.copyWith();
}
