// 시뮬레이터/실기기에 떠 있는 "진짜" 앱 로컬 DB(nyaki.db)에 테스트용 더미 단어 10개를
// 직접 추가하는 일회성 스크립트.
//
// ⚠️ 주의: 이 파일은 개발자가 수동으로 테스트할 때만 실행하는 용도다.
//   - lib/data/seed/seed_default_nyaki_words.dart(실제 유저에게 배포되는 시드)는 절대 건드리지 않는다.
//   - 이 파일 자체도 앱 빌드에 포함되지 않는다 (integration_test/ 디렉터리는 `flutter test`로만 실행됨).
//
// 실행 방법 (시뮬레이터/기기가 이미 연결돼 있어야 함):
//   flutter test integration_test/add_dummy_words_test.dart -d <device-id>
//
// 실행 후 앱을 다시 켜면(`flutter run ...`) 기본 단어장에 더미 단어 10개가 추가돼 있다.
// 지우고 싶으면 앱 안에서 단어 삭제하거나, 시뮬레이터를 초기화하면 된다.

import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:nyaki/data/repositories/drift_vocab_repository.dart';
import 'package:nyaki/data/repositories/vocab_repository.dart';
import 'package:nyaki/data/vocab_constants.dart';

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('기본 단어장에 더미 테스트 단어 10개 추가', (tester) async {
    final repository = await DriftVocabRepository.create();

    const dummyWords = <(String term, String meaning, String pron, String example)>[
      ('dog', '개', '/dɔːɡ/', 'The dog is barking.'),
      ('sun', '태양', '/sʌn/', 'The sun is bright today.'),
      ('moon', '달', '/muːn/', 'The moon is full tonight.'),
      ('apple', '사과', '/ˈæpl/', 'She ate an apple.'),
      ('water', '물', '/ˈwɔːtər/', 'Drink more water.'),
      ('book', '책', '/bʊk/', 'I read a book.'),
      ('run', '달리다', '/rʌn/', 'He runs every morning.'),
      ('happy', '행복한', '/ˈhæpi/', 'I am happy today.'),
      ('blue', '파란색', '/bluː/', 'The sky is blue.'),
      ('mountain', '산', '/ˈmaʊntən/', 'We climbed the mountain.'),
    ];

    final existingTerms = (await repository.listWords(
      VocabConstants.defaultWordBookId,
    ))
        .map((w) => w.term)
        .toSet();

    var added = 0;
    for (final (term, meaning, pron, example) in dummyWords) {
      if (existingTerms.contains(term)) continue;
      await repository.createWord(
        CreateWordInput(
          wordBookId: VocabConstants.defaultWordBookId,
          term: term,
          meaning: meaning,
          pronunciation: pron,
          example: example,
        ),
      );
      added++;
    }

    // ignore: avoid_print
    print('더미 단어 $added개 추가 완료 (이미 있던 단어는 건너뜀).');

    await repository.close();
  });
}
