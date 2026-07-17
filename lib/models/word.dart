enum WordMemorizationStatus {
  unmemorized,
  memorized,
}

/// 단어장에 속한 단어 도메인 모델.
class Word {
  const Word({
    required this.id,
    required this.wordBookId,
    required this.term,
    required this.meaning,
    this.pronunciation,
    this.description,
    this.example,
    this.imagePath,
    this.memorizationStatus = WordMemorizationStatus.unmemorized,
    required this.createdAt,
    required this.updatedAt,
    this.isDeleted = false,
  });

  final String id;
  final String wordBookId;

  /// 단어 / 표현 본문.
  final String term;
  final String meaning;
  final String? pronunciation;
  final String? description;
  final String? example;

  /// 프로토타입: 로컬 파일 경로. 이후 URL로 확장.
  final String? imagePath;

  final WordMemorizationStatus memorizationStatus;
  final DateTime createdAt;
  final DateTime updatedAt;
  final bool isDeleted;

  bool get isMemorized =>
      memorizationStatus == WordMemorizationStatus.memorized;

  Word copyWith({
    String? id,
    String? wordBookId,
    String? term,
    String? meaning,
    String? pronunciation,
    String? description,
    String? example,
    String? imagePath,
    WordMemorizationStatus? memorizationStatus,
    DateTime? createdAt,
    DateTime? updatedAt,
    bool? isDeleted,
  }) {
    return Word(
      id: id ?? this.id,
      wordBookId: wordBookId ?? this.wordBookId,
      term: term ?? this.term,
      meaning: meaning ?? this.meaning,
      pronunciation: pronunciation ?? this.pronunciation,
      description: description ?? this.description,
      example: example ?? this.example,
      imagePath: imagePath ?? this.imagePath,
      memorizationStatus: memorizationStatus ?? this.memorizationStatus,
      createdAt: createdAt ?? this.createdAt,
      updatedAt: updatedAt ?? this.updatedAt,
      isDeleted: isDeleted ?? this.isDeleted,
    );
  }
}
