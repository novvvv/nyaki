import 'package:drift/native.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:nyaki/data/auth/auth_controller.dart';
import 'package:nyaki/data/auth/auth_repository.dart';
import 'package:nyaki/data/local/app_database.dart';
import 'package:nyaki/data/repositories/drift_vocab_repository.dart';
import 'package:nyaki/data/vocab_controller.dart';
import 'package:nyaki/main.dart';

void main() {
  testWidgets('홈 탭에 고양이만 표시한다', (WidgetTester tester) async {
    final db = AppDatabase.forTesting(NativeDatabase.memory());
    final repository = DriftVocabRepository.forTesting(db);
    final controller = VocabController(repository);
    await controller.initialize();

    final authController = AuthController(UnconfiguredAuthRepository());
    await authController.initialize();
    authController.skipSignIn();

    await tester.pumpWidget(
      NyakiApp(controller: controller, authController: authController),
    );
    await tester.pumpAndSettle();

    expect(find.text('홈'), findsOneWidget);
    expect(find.byType(Image), findsOneWidget);
    expect(find.text('6월 26일'), findsNothing);
    expect(find.text('단어 복습'), findsNothing);

    await db.close();
  });
}
