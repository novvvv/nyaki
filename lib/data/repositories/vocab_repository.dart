import '../../models/word.dart';
import '../../models/word_book.dart';

class CreateWordBookInput {
  const CreateWordBookInput({
    required this.title,
    this.description,
  });

  final String title;
  final String? description;
}

class UpdateWordBookInput {
  const UpdateWordBookInput({
    this.title,
    this.description,
  });

  final String? title;
  final String? description;
}

class CreateWordInput {
  const CreateWordInput({
    required this.wordBookId,
    required this.term,
    required this.meaning,
    this.pronunciation,
    this.description,
    this.example,
    this.imagePath,
  });

  final String wordBookId;
  final String term;
  final String meaning;
  final String? pronunciation;
  final String? description;
  final String? example;
  final String? imagePath;
}

class UpdateWordInput {
  const UpdateWordInput({
    this.term,
    this.meaning,
    this.pronunciation,
    this.description,
    this.example,
    this.imagePath,
    this.memorizationStatus,
  });

  final String? term;
  final String? meaning;
  final String? pronunciation;
  final String? description;
  final String? example;
  final String? imagePath;
  final WordMemorizationStatus? memorizationStatus;
}

class VocabNotFoundException implements Exception {
  VocabNotFoundException(this.message);

  final String message;

  @override
  String toString() => message;
}

/// 단어장·단어 CRUD 계약. Hub API 구현체로 교체 가능.
abstract class VocabRepository {
  Future<void> ensureInitialized();

  Future<List<WordBook>> listWordBooks();

  Future<WordBook> getWordBook(String id);

  Future<WordBook> createWordBook(CreateWordBookInput input);

  Future<WordBook> updateWordBook(String id, UpdateWordBookInput input);

  Future<void> deleteWordBook(String id);

  Future<List<Word>> listWords(String wordBookId);

  Future<Word> getWord(String wordBookId, String wordId);

  Future<Word> createWord(CreateWordInput input);

  Future<Word> updateWord(
      String wordBookId, String wordId, UpdateWordInput input);

  Future<void> deleteWord(String wordBookId, String wordId);
}
