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
    this.isBookmarked = false,
    this.tags = const [],
    this.srsEaseFactor = 2.5,
    this.srsIntervalDays = 0,
    this.srsRepetitions = 0,
    this.srsLapses = 0,
    required this.srsDueAt,
    this.srsLastReviewedAt,
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
  final bool isBookmarked;
  final List<String> tags;

  // ==================== SM-2 SRS 필드 ==================== //
  // 계산 규칙: docs/SRS.md
  final double srsEaseFactor;
  final int srsIntervalDays;
  final int srsRepetitions;
  final int srsLapses;
  final DateTime srsDueAt;
  final DateTime? srsLastReviewedAt;
  // ========================================================= //

  final DateTime createdAt;
  final DateTime updatedAt;
  final bool isDeleted;

  bool get isMemorized =>
      memorizationStatus == WordMemorizationStatus.memorized;

  /// 지금 시각 기준으로 복습 대상인지 (srsDueAt이 지났는지).
  bool get isDue => !srsDueAt.isAfter(DateTime.now());

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
    bool? isBookmarked,
    List<String>? tags,
    double? srsEaseFactor,
    int? srsIntervalDays,
    int? srsRepetitions,
    int? srsLapses,
    DateTime? srsDueAt,
    DateTime? srsLastReviewedAt,
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
      isBookmarked: isBookmarked ?? this.isBookmarked,
      tags: tags ?? this.tags,
      srsEaseFactor: srsEaseFactor ?? this.srsEaseFactor,
      srsIntervalDays: srsIntervalDays ?? this.srsIntervalDays,
      srsRepetitions: srsRepetitions ?? this.srsRepetitions,
      srsLapses: srsLapses ?? this.srsLapses,
      srsDueAt: srsDueAt ?? this.srsDueAt,
      srsLastReviewedAt: srsLastReviewedAt ?? this.srsLastReviewedAt,
      createdAt: createdAt ?? this.createdAt,
      updatedAt: updatedAt ?? this.updatedAt,
      isDeleted: isDeleted ?? this.isDeleted,
    );
  }
}
