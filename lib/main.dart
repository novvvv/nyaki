import 'package:firebase_core/firebase_core.dart';
import 'package:flutter/material.dart';

import 'core/auth_scope.dart';
import 'core/nyaki_scope.dart';
import 'core/theme/nyaki_theme.dart';
import 'data/auth/auth_controller.dart';
import 'data/auth/firebase_auth_repository.dart';
import 'data/repositories/drift_vocab_repository.dart';
import 'data/sync/sync_coordinator.dart';
import 'data/vocab_controller.dart';
import 'screens/auth/auth_gate.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await Firebase.initializeApp();

  final repository = await DriftVocabRepository.create();
  final controller = VocabController(repository);
  await controller.initialize();

  // Drift DB는 로그인 여부와 무관하게 그대로 사용한다.
  // Firebase UID는 AuthController.userId로 노출되며, 동기화는 후속 단계.
  final authController = AuthController(FirebaseAuthRepository());
  await authController.initialize();
  final syncCoordinator = SyncCoordinator(
    repository: repository,
    auth: authController,
    vocab: controller,
  )..start();

  runApp(
    NyakiApp(
      controller: controller,
      authController: authController,
      syncCoordinator: syncCoordinator,
    ),
  );
}

class NyakiApp extends StatefulWidget {
  const NyakiApp({
    super.key,
    required this.controller,
    required this.authController,
    required this.syncCoordinator,
  });

  final VocabController controller;
  final AuthController authController;
  final SyncCoordinator syncCoordinator;

  @override
  State<NyakiApp> createState() => _NyakiAppState();
}

class _NyakiAppState extends State<NyakiApp> {
  @override
  void dispose() {
    widget.syncCoordinator.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AuthScope(
      controller: widget.authController,
      child: NyakiScope(
        controller: widget.controller,
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
