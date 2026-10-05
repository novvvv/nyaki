import 'word.dart';

/// 단어장 도메인 모델.
class WordBook {
  const WordBook({
    required this.id,
    required this.title,
    this.description,
    required this.createdAt,
    required this.updatedAt,
    this.words = const [],
  });

  final String id;
  final String title;
  final String? description;
  final DateTime createdAt;
  final DateTime updatedAt;
  final List<Word> words;

  int get wordCount => words.where((word) => !word.isDeleted).length;

  List<Word> get activeWords =>
      words.where((word) => !word.isDeleted).toList(growable: false);

  int get memorizedCount =>
      activeWords.where((word) => word.isMemorized).length;

  /// 오늘 복습해야 하는 단어들 (srsDueAt이 지난 단어).
  List<Word> get dueWords =>
      activeWords.where((word) => word.isDue).toList(growable: false);

  int get dueCount => dueWords.length;

  int get learningRate =>
      wordCount == 0 ? 0 : (memorizedCount / wordCount * 100).round();

  String get metaLabel => '$wordCount개 · 암기 $learningRate%';

  WordBook copyWith({
    String? id,
    String? title,
    String? description,
    DateTime? createdAt,
    DateTime? updatedAt,
    List<Word>? words,
  }) {
    return WordBook(
      id: id ?? this.id,
      title: title ?? this.title,
      description: description ?? this.description,
      createdAt: createdAt ?? this.createdAt,
      updatedAt: updatedAt ?? this.updatedAt,
      words: words ?? this.words,
    );
  }
}
