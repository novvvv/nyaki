import 'package:drift/drift.dart';

@DataClassName('WordBookRow')
class WordBooks extends Table {
  TextColumn get id => text()();
  TextColumn get title => text()();
  TextColumn get description => text().nullable()();
  DateTimeColumn get createdAt => dateTime()();
  DateTimeColumn get updatedAt => dateTime()();

  @override
  Set<Column<Object>> get primaryKey => {id};
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
  TextColumn get imagePath => text().nullable()();
  TextColumn get memorizationStatus => text()();
  DateTimeColumn get createdAt => dateTime()();
  DateTimeColumn get updatedAt => dateTime()();
  BoolColumn get isDeleted => boolean().withDefault(const Constant(false))();

  @override
  Set<Column<Object>> get primaryKey => {id};
}
