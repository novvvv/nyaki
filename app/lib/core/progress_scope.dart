import 'package:flutter/widgets.dart';

import '../data/progress_controller.dart';

/// 게이미피케이션(츄르/퀘스트) 상태 전용 스코프. NyakiScope/AuthScope와 분리해 둔다.
class ProgressScope extends InheritedNotifier<ProgressController> {
  const ProgressScope({
    super.key,
    required ProgressController controller,
    required super.child,
  }) : super(notifier: controller);

  static ProgressController of(BuildContext context) {
    final scope = context.dependOnInheritedWidgetOfExactType<ProgressScope>();
    assert(scope != null, 'ProgressScope not found in widget tree');
    return scope!.notifier!;
  }
}
