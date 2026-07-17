import 'package:flutter/widgets.dart';

import '../data/vocab_controller.dart';

class NyakiScope extends InheritedNotifier<VocabController> {
  const NyakiScope({
    super.key,
    required VocabController controller,
    required super.child,
  }) : super(notifier: controller);

  static VocabController of(BuildContext context) {
    final scope = context.dependOnInheritedWidgetOfExactType<NyakiScope>();
    assert(scope != null, 'NyakiScope not found in widget tree');
    return scope!.notifier!;
  }
}
