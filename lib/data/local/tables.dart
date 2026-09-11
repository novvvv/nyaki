import 'package:drift/drift.dart';

// =================== ✨ WordBooks ✨ =================== //
// 단어장 테이블 
//  id(PK) - 단어장 고유 식별자 
//  title - 단어장 이름 
//  description - 단어장 설명 
//  createdAt - 생성 시각 
//  updatedAt - 마지막 수정 시각 
//  isDeleted - soft delete flag 
// ======================================================= //

@DataClassName('WordBookRow')
class WordBooks extends Table {
  TextColumn get id => text()();
  TextColumn get title => text()();
  TextColumn get description => text().nullable()();
  DateTimeColumn get createdAt => dateTime()();
  DateTimeColumn get updatedAt => dateTime()();
  BoolColumn get isDeleted => boolean().withDefault(const Constant(false))();

  @override
  Set<Column<Object>> get primaryKey => {id};
}

// =================== ✨ SyncOutboxRow ✨ ================ //
// [방향] Device -> Hub (Push)

// Hub로 보낼 변경 큐  * Hub에는 대응 테이블이 없다 * 
// Hub에 안 보낸 변경사항을 잠깐 담아두는 (버퍼)큐로 한 번 성공적으로 보내면 그 즉시 삭제된다. 

// id(PK) - autoIncrement, Queue 일련번호 
// entityType - (word_book/word) 어떤 종류의 변경인지 명시합니다. (종류의 변경만 명시하기에 실제로 어떤 단어가 변경되었는지, 단어장이 변경되었는지는 모른다.)
// entityId - 대상 엔터티 ID. 실제 단어장, 단어 객체 (WordEntries.id or WordBooks.id) 
// operation - 'upsert'/'delete' upsert (Update + Insert) 이미 있으면 수정, 없으면 새로 만든다. 큐를 소비하는측 입장에서는 새 단어 만들기와 기존 단어 수정하기가 일치하기 때문 
// payloadJson - 변경 시점 엔터티 전체 스냅샷 (JSON) 
// createdAt - 큐에 쌓인 시각 

// ======================================================= //

@DataClassName('SyncOutboxRow')
class SyncOutbox extends Table {
  IntColumn get id => integer().autoIncrement()();
  TextColumn get entityType => text()();
  TextColumn get entityId => text()();
  TextColumn get operation => text()();
  TextColumn get payloadJson => text()();
  DateTimeColumn get createdAt => dateTime()();
}

// =================== ✨ SyncStateRow ✨ ================ //
// 마지막 Pull 위치 (앱전용?)
// userId(PK) - Firebase uid 
// cursor - 마지막으로 받아간 Hub (sync_changes.cursor)
// ======================================================= //

@DataClassName('SyncStateRow')
class SyncState extends Table {
  TextColumn get userId => text()();
  IntColumn get cursor => integer().withDefault(const Constant(0))();

  @override
  Set<Column<Object>> get primaryKey => {userId};
}


@DataClassName('WordRow')
class WordEntries extends Table {
  TextColumn get id => text()();
  TextColumn get wordBookId =>
      text().references(WordBooks, #id, onDelete: KeyAction.cascade)();
  TextColumn get term => text()();
  TextColumn get meaning => text()();
  TextColumn get pronunciation => text().nullable()();
  TextColumn get description => text().nullable()();
  TextColumn get example => text().nullable()();
  TextColumn get exampleMeaning => text().nullable()();
  TextColumn get imagePath => text().nullable()();
  TextColumn get memorizationStatus => text()();
  BoolColumn get isBookmarked =>
      boolean().withDefault(const Constant(false))();
  TextColumn get tagsJson => text().withDefault(const Constant('[]'))();

  // ==================== ✨ SM-2 SRS 필드 ✨ ==================== //
  // 계산 규칙: docs/SRS.md · Hub 대응 컬럼: api/app/models/vocab.py WordModel
  RealColumn get srsEaseFactor =>
      real().withDefault(const Constant(2.5))();
  IntColumn get srsIntervalDays =>
      integer().withDefault(const Constant(0))();
  IntColumn get srsRepetitions =>
      integer().withDefault(const Constant(0))();
  IntColumn get srsLapses => integer().withDefault(const Constant(0))();
  DateTimeColumn get srsDueAt =>
      dateTime().withDefault(currentDateAndTime)();
  DateTimeColumn get srsLastReviewedAt => dateTime().nullable()();
  // =============================================================== //

  DateTimeColumn get createdAt => dateTime()();
  DateTimeColumn get updatedAt => dateTime()();
  BoolColumn get isDeleted => boolean().withDefault(const Constant(false))();

  @override
  Set<Column<Object>> get primaryKey => {id};
}

// =================== ✨ UserProgress ✨ =================== //
// 게이미피케이션 — 유저 진행 상태의 로컬 캐시. Hub의 UserProgressModel이
// 진실이고, 여기는 서버가 마지막으로 알려준 값을 들고 있을 뿐이다.
// (api/app/models/gamification.py UserProgressModel 대응)
//  userId(PK) - 유저 식별자
//  churuBalance - 츄르 잔액
//  capelinBalance - 열빙어 잔액 (아침/저녁 복습 퀘스트 보상)
//  streakCount - 연속 학습일 수 (이번 라운드 미사용, 컬럼만)
//  lastActiveDate - 마지막 활동일 (이번 라운드 미사용)
//  dailyReviewGoal - 하루 복습 목표 개수 (이번 라운드 미사용)
//  morningReviewCount / eveningReviewCount - TimeQuest용 (이번 라운드 미사용)
// ======================================================= //

@DataClassName('UserProgressRow')
class UserProgress extends Table {
  TextColumn get userId => text()();
  IntColumn get churuBalance => integer().withDefault(const Constant(0))();
  IntColumn get capelinBalance => integer().withDefault(const Constant(0))();
  IntColumn get streakCount => integer().withDefault(const Constant(0))();
  DateTimeColumn get lastActiveDate => dateTime().nullable()();
  IntColumn get dailyReviewGoal => integer().nullable()();
  IntColumn get morningReviewCount =>
      integer().withDefault(const Constant(0))();
  IntColumn get eveningReviewCount =>
      integer().withDefault(const Constant(0))();

  @override
  Set<Column<Object>> get primaryKey => {userId};
}

// =================== ✨ QuestState ✨ =================== //
// 게이미피케이션 — 퀘스트별 완료 상태의 로컬 캐시. Hub의 QuestStateModel과
// 동일하게 유저×퀘스트당 딱 1 row만 존재(UPSERT), 완료 이력 로그 아님.
// (api/app/models/gamification.py QuestStateModel 대응)
//  userId(PK 일부) - 유저 식별자
//  questId(PK 일부) - 퀘스트 식별자 (예: pet_cat)
//  lastCompletedDate - 마지막으로 완료한 날짜
// ======================================================= //

@DataClassName('QuestStateRow')
class QuestState extends Table {
  TextColumn get userId => text()();
  TextColumn get questId => text()();
  DateTimeColumn get lastCompletedDate => dateTime()();

  @override
  Set<Column<Object>> get primaryKey => {userId, questId};
}
