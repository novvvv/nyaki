import '../models/word_book.dart';

/// DB 도입 전 앱 실행 중에만 유지되는 임시 인메모리 데이터.
abstract final class MockVocabData {
  static final wordBooks = <WordBook>[];

  static const dailyAddCounts = [2, 3, 2, 4, 3, 5, 5];
  static const dayLabels = ['20', '21', '22', '23', '24', '25', '26'];
  static const scrollDates = [23, 24, 25, 26, 27, 28, 29];
  static const selectedDate = 26;
  static const selectedMonthLabel = '6월 26일';
  static const todayAddCount = 5;
  static const weekAddCount = 23;
}
