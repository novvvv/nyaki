import 'package:flutter/foundation.dart';

import '../models/word.dart';
import '../models/word_book.dart';
import 'repositories/vocab_repository.dart';
import 'seed/seed_default_nyaki_words.dart';

/// UI가 구독하는 단어장·단어 상태 레이어.
class VocabController extends ChangeNotifier {
  VocabController(this._repository);

  final VocabRepository _repository;

  List<WordBook> wordBooks = [];
  bool isReady = false;
  Object? initError;

  Future<void> initialize() async {
    try {
      await _repository.ensureInitialized();
      await seedDefaultNyakiWords(_repository);
      await reload();
      initError = null;
    } catch (error) {
      initError = error;
    } finally {
      isReady = true;
      notifyListeners();
    }
  }

  Future<void> reload() async {
    wordBooks = await _repository.listWordBooks();
    notifyListeners();
  }

  WordBook? findWordBook(String id) {
    for (final wordBook in wordBooks) {
      if (wordBook.id == id) return wordBook;
    }
    return null;
  }

  Future<WordBook> createWordBook({
    required String title,
    String? description,
  }) async {
    final created = await _repository.createWordBook(
      CreateWordBookInput(title: title, description: description),
    );
    await reload();
    return created;
  }

  Future<WordBook> updateWordBook({
    required String id,
    String? title,
    String? description,
  }) async {
    final updated = await _repository.updateWordBook(
      id,
      UpdateWordBookInput(title: title, description: description),
    );
    await reload();
    return updated;
  }

  Future<void> deleteWordBook(String id) async {
    await _repository.deleteWordBook(id);
    await reload();
  }

  Future<Word> createWord(CreateWordInput input) async {
    final created = await _repository.createWord(input);
    await reload();
    return created;
  }

  Future<Word> updateWord({
    required String wordBookId,
    required String wordId,
    UpdateWordInput? input,
  }) async {
    final updated = await _repository.updateWord(
      wordBookId,
      wordId,
      input ?? const UpdateWordInput(),
    );
    await reload();
    return updated;
  }

  Future<void> deleteWord({
    required String wordBookId,
    required String wordId,
  }) async {
    await _repository.deleteWord(wordBookId, wordId);
    await reload();
  }
}
