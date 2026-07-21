import 'package:drift/native.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:nyaki/data/auth/auth_controller.dart';
import 'package:nyaki/data/auth/auth_repository.dart';
import 'package:nyaki/data/local/app_database.dart';
import 'package:nyaki/data/repositories/drift_vocab_repository.dart';
import 'package:nyaki/data/sync/sync_coordinator.dart';
import 'package:nyaki/data/vocab_controller.dart';
import 'package:nyaki/main.dart';

class _FakeAuthRepository implements AuthRepository {
  @override
  Future<AuthUser?> restoreSession() async => null;

  @override
  Future<AuthUser> signInWithApple() async {
    throw AuthException('테스트에서는 Apple 로그인을 쓰지 않아요.');
  }

  @override
  Future<AuthUser> signInWithGoogle() async {
    throw AuthException('테스트에서는 Google 로그인을 쓰지 않아요.');
  }

  @override
  Future<void> signOut() async {}

  @override
  Future<String?> getIdToken() async => null;
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('홈 탭에 고양이만 표시한다', (WidgetTester tester) async {
    SharedPreferences.setMockInitialValues({});

    final db = AppDatabase.forTesting(NativeDatabase.memory());
    final repository = DriftVocabRepository.forTesting(db);
    final controller = VocabController(repository);
    await controller.initialize();

    final authController = AuthController(
      _FakeAuthRepository(),
      preferences: await SharedPreferences.getInstance(),
    );
    await authController.initialize();
    await authController.skipSignIn();

    await tester.pumpWidget(
      NyakiApp(
        controller: controller,
        authController: authController,
        syncCoordinator: SyncCoordinator(
          repository: repository,
          auth: authController,
          vocab: controller,
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('홈'), findsOneWidget);
    expect(find.byType(Image), findsOneWidget);
    expect(find.text('6월 26일'), findsNothing);
    expect(find.text('단어 복습'), findsNothing);

    await db.close();
  });
}
