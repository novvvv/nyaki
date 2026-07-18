import 'package:flutter/material.dart';

import 'core/auth_scope.dart';
import 'core/nyaki_scope.dart';
import 'core/theme/nyaki_theme.dart';
import 'data/auth/auth_controller.dart';
import 'data/auth/auth_repository.dart';
import 'data/repositories/drift_vocab_repository.dart';
import 'data/vocab_controller.dart';
import 'screens/auth_gate.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  final repository = await DriftVocabRepository.create();
  final controller = VocabController(repository);
  await controller.initialize();

  // TODO(auth): Firebase 설정 후 FirebaseAuthRepository로 교체.
  final authController = AuthController(UnconfiguredAuthRepository());
  await authController.initialize();

  runApp(NyakiApp(controller: controller, authController: authController));
}

class NyakiApp extends StatelessWidget {
  const NyakiApp({
    super.key,
    required this.controller,
    required this.authController,
  });

  final VocabController controller;
  final AuthController authController;

  @override
  Widget build(BuildContext context) {
    return AuthScope(
      controller: authController,
      child: NyakiScope(
        controller: controller,
        child: MaterialApp(
          title: 'Nyaki',
          debugShowCheckedModeBanner: false,
          theme: buildNyakiTheme(),
          home: const AuthGate(),
        ),
      ),
    );
  }
}
