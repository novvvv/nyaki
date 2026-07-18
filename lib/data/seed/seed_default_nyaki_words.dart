import '../repositories/vocab_repository.dart';
import '../vocab_constants.dart';

/// 기본 냥키 단어장에 시드 단어가 없으면 더미 3개를 넣는다.
/// 이미 시드된 경우에도 cat에 기본 이미지가 없으면 채워 넣는다.
Future<void> seedDefaultNyakiWords(VocabRepository repository) async {
  final wordBooks = await repository.listWordBooks();

  final targetIndex = wordBooks.indexWhere(
    (book) => book.id == VocabConstants.defaultWordBookId,
  );
  if (targetIndex == -1) return;

  final target = wordBooks[targetIndex];

  if (target.activeWords.isEmpty) {
    for (final seed in defaultNyakiSeedWords) {
      await repository.createWord(
        CreateWordInput(
          wordBookId: VocabConstants.defaultWordBookId,
          term: seed.term,
          meaning: seed.meaning,
          pronunciation: seed.pronunciation,
          description: seed.description,
          example: seed.example,
          imagePath: seed.imagePath,
        ),
      );
    }
    return;
  }

  for (final word in target.activeWords) {
    if (word.term != 'cat') continue;
    if (word.imagePath == _catImagePath) continue;
    await repository.updateWord(
      VocabConstants.defaultWordBookId,
      word.id,
      const UpdateWordInput(imagePath: _catImagePath),
    );
  }
}

/// 시드용 간단한 단어 정의.
class SeedWord {
  const SeedWord({
    required this.term,
    required this.meaning,
    this.pronunciation,
    this.description,
    this.example,
    this.imagePath,
  });

  final String term;
  final String meaning;
  final String? pronunciation;
  final String? description;
  final String? example;
  final String? imagePath;
}

const _catImagePath = 'assets/images/nyangki_sleeping.png';

const defaultNyakiSeedWords = <SeedWord>[
  SeedWord(
    term: 'cat',
    meaning: '고양이',
    pronunciation: '/kæt/',
    example: 'I have a cat.',
    imagePath: _catImagePath,
  ),
  SeedWord(
    term: 'nap',
    meaning: '낮잠',
    pronunciation: '/næp/',
    example: 'The cat took a nap.',
  ),
  SeedWord(
    term: 'purr',
    meaning: '그르렁거리다',
    pronunciation: '/pɜːr/',
    description: '고양이가 기분 좋을 때 내는 소리',
  ),
];
