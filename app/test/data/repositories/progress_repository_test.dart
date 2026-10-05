import 'dart:convert';

import 'package:drift/drift.dart';
import 'package:drift/native.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:nyaki/data/auth/auth_controller.dart';
import 'package:nyaki/data/auth/auth_repository.dart';
import 'package:nyaki/data/local/app_database.dart';
import 'package:nyaki/data/repositories/progress_repository.dart';

/// 테스트 전용 — 세션 복원 시 항상 로그인된 것으로 취급하는 가짜 AuthRepository.
class _FakeAuthRepository implements AuthRepository {
  @override
  Future<AuthUser?> restoreSession() async => const AuthUser(
        uid: 'test-user',
        provider: SignInProvider.google,
      );

  @override
  Future<AuthUser> signInWithApple() => throw UnimplementedError();

  @override
  Future<AuthUser> signInWithGoogle() => throw UnimplementedError();

  @override
  Future<void> signOut() async {}

  @override
  Future<String?> getIdToken() async => 'fake-token';
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  test(
    '자정 지난 뒤 refresh()하면 어제 완료 기록이 로컬 캐시에서 사라진다(버그 재현 시도)',
    () async {
      SharedPreferences.setMockInitialValues({});
      final db = AppDatabase.forTesting(NativeDatabase.memory());
      final auth = AuthController(_FakeAuthRepository());
      await auth.initialize();
      expect(auth.status, AuthStatus.signedIn);

      final yesterday = DateTime.now().subtract(const Duration(days: 1));
      final yesterdayDate =
          DateTime(yesterday.year, yesterday.month, yesterday.day);

      // 어제 완료된 것으로 로컬 캐시에 미리 심어둔다 — 오늘 자정을 넘긴
      // 직후 상황을 재현.
      await db.into(db.userProgress).insertOnConflictUpdate(
            UserProgressCompanion.insert(
              userId: 'test-user',
              churuBalance: const Value(5),
            ),
          );
      await db.into(db.questState).insertOnConflictUpdate(
            QuestStateCompanion.insert(
              userId: 'test-user',
              questId: 'pet_cat',
              lastCompletedDate: yesterdayDate,
            ),
          );

      final repo = ProgressRepository(
        database: db,
        auth: auth,
        client: MockClient((request) async {
          return http.Response(
            jsonEncode({'churu_balance': 5, 'completed_today': <String>[]}),
            200,
          );
        }),
        apiBaseUrl: 'https://example.test',
      );

      // ① refresh() 전, loadCached()만으로 어제 row가 "오늘 완료"로 새는지 확인
      //    (날짜 필터가 실제로 동작하는지 검증 — 여기서 걸리면 read-side 버그).
      final beforeRefresh = await repo.loadCached();
      expect(
        beforeRefresh.completedQuestIds.contains('pet_cat'),
        isFalse,
        reason: 'loadCached()의 날짜 필터가 어제 row를 걸러내지 못함 — read-side 버그',
      );

      // ② refresh() 호출 — 서버가 오늘 완료 목록을 빈 배열로 내려줌.
      final afterRefresh = await repo.refresh();
      expect(afterRefresh.completedQuestIds.contains('pet_cat'), isFalse);
      expect(afterRefresh.churuBalance, 5);

      // ③ 로컬 DB에 어제 row가 실제로 정리(delete)됐는지 직접 확인
      //    (write-side 정리 로직 검증).
      final remaining = await (db.select(db.questState)
            ..where((row) => row.userId.equals('test-user')))
          .get();
      expect(
        remaining.where((row) => row.lastCompletedDate == yesterdayDate),
        isEmpty,
        reason: '어제 완료 row가 _writeCache()에서 정리되지 않고 그대로 남아있음',
      );
    },
  );

  test(
    '오늘 날짜로 로컬에 남아있어도 서버가 오늘 완료 목록에서 뺐으면 사라진다'
    ' (실기기에서 재현된 실제 버그: add_word가 로컬엔 오늘 날짜로 남아있는데'
    ' 서버 응답엔 없던 케이스)',
    () async {
      SharedPreferences.setMockInitialValues({});
      final db = AppDatabase.forTesting(NativeDatabase.memory());
      final auth = AuthController(_FakeAuthRepository());
      await auth.initialize();

      final today = DateTime.now();
      final todayDate = DateTime(today.year, today.month, today.day);

      // 로컬엔 add_word/pet_cat 둘 다 "오늘" 완료로 남아있는 상태.
      await db.into(db.userProgress).insertOnConflictUpdate(
            UserProgressCompanion.insert(
              userId: 'test-user',
              churuBalance: const Value(15),
            ),
          );
      for (final questId in ['add_word', 'pet_cat']) {
        await db.into(db.questState).insertOnConflictUpdate(
              QuestStateCompanion.insert(
                userId: 'test-user',
                questId: questId,
                lastCompletedDate: todayDate,
              ),
            );
      }

      // 근데 서버는 오늘 pet_cat만 인정한다(add_word는 빠짐).
      final repo = ProgressRepository(
        database: db,
        auth: auth,
        client: MockClient((request) async {
          return http.Response(
            jsonEncode({
              'churu_balance': 15,
              'completed_today': ['pet_cat'],
            }),
            200,
          );
        }),
        apiBaseUrl: 'https://example.test',
      );

      final afterRefresh = await repo.refresh();
      expect(afterRefresh.completedQuestIds, {'pet_cat'});
      expect(
        afterRefresh.completedQuestIds.contains('add_word'),
        isFalse,
        reason: '서버가 오늘 완료로 안 쳐주는 퀘스트가 로컬 캐시엔 여전히 완료로 남음',
      );
    },
  );
}
