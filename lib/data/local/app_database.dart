import 'package:drift/drift.dart';
import 'package:drift_flutter/drift_flutter.dart';

import 'tables.dart';

part 'app_database.g.dart';

// WordBooks - 단어장 테이블
// WordEntries - 단어 테이블 (SRS 필드 포함)
// SyncOutbox - Outbox Queue Table ?? 
// SyncState - 마지막 pull cursor 저장 
@DriftDatabase(tables: [WordBooks, WordEntries, SyncOutbox, SyncState])
class AppDatabase extends _$AppDatabase {
  AppDatabase([QueryExecutor? executor]) : super(executor ?? _openConnection());

  AppDatabase.forTesting(super.executor);

  @override
  int get schemaVersion => 4;

  @override
  MigrationStrategy get migration => MigrationStrategy(
        onCreate: (migrator) async {
          await migrator.createAll();
        },
        onUpgrade: (migrator, from, to) async {
          if (from < 2) {
            await migrator.addColumn(wordBooks, wordBooks.isDeleted);
            await migrator.createTable(syncOutbox);
            await migrator.createTable(syncState);
          }
          if (from < 3) {
            await migrator.addColumn(wordEntries, wordEntries.isBookmarked);
            await migrator.addColumn(wordEntries, wordEntries.tagsJson);
          }
          if (from < 4) {
            await migrator.addColumn(wordEntries, wordEntries.srsEaseFactor);
            await migrator.addColumn(wordEntries, wordEntries.srsIntervalDays);
            await migrator.addColumn(wordEntries, wordEntries.srsRepetitions);
            await migrator.addColumn(wordEntries, wordEntries.srsLapses);
            await migrator.addColumn(wordEntries, wordEntries.srsDueAt);
            await migrator.addColumn(
              wordEntries,
              wordEntries.srsLastReviewedAt,
            );
            // 기존 row: due_at을 마이그레이션 실행 시각이 아니라
            // 각자의 created_at으로 맞춤 (docs/SRS-PLAN.md 마이그레이션 규칙)
            await migrator.database.customStatement(
              'UPDATE word_entries SET srs_due_at = created_at',
            );
          }
        },
      );

  static QueryExecutor _openConnection() {
    return driftDatabase(name: 'nyaki.db');
  }
}
