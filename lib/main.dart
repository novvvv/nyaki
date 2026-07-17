import 'package:flutter/material.dart';

import 'core/nyaki_scope.dart';
import 'core/theme/nyaki_theme.dart';
import 'data/repositories/drift_vocab_repository.dart';
import 'data/vocab_controller.dart';
import 'screens/app_shell.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  final repository = await DriftVocabRepository.create();
  final controller = VocabController(repository);
  await controller.initialize();

  runApp(NyakiApp(controller: controller));
}

class NyakiApp extends StatelessWidget {
  const NyakiApp({super.key, required this.controller});

  final VocabController controller;

  @override
  Widget build(BuildContext context) {
    return NyakiScope(
      controller: controller,
      child: MaterialApp(
        title: 'Nyaki',
        debugShowCheckedModeBanner: false,
        theme: buildNyakiTheme(),
        home: const AppShell(),
      ),
    );
  }
}
