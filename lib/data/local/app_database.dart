import 'package:drift/drift.dart';
import 'package:drift_flutter/drift_flutter.dart';

import 'tables.dart';

part 'app_database.g.dart';

@DriftDatabase(tables: [WordBooks, WordEntries, SyncOutbox, SyncState])
class AppDatabase extends _$AppDatabase {
  AppDatabase([QueryExecutor? executor]) : super(executor ?? _openConnection());

  AppDatabase.forTesting(super.executor);

  @override
  int get schemaVersion => 2;

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
        },
      );

  static QueryExecutor _openConnection() {
    return driftDatabase(name: 'nyaki.db');
  }
}
