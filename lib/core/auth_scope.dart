import 'package:flutter/widgets.dart';

import '../data/auth/auth_controller.dart';

/// 인증 상태 전용 스코프. 단어 상태(NyakiScope)와 분리해 둔다.
class AuthScope extends InheritedNotifier<AuthController> {
  const AuthScope({
    super.key,
    required AuthController controller,
    required super.child,
  }) : super(notifier: controller);

  static AuthController of(BuildContext context) {
    final scope = context.dependOnInheritedWidgetOfExactType<AuthScope>();
    assert(scope != null, 'AuthScope not found in widget tree');
    return scope!.notifier!;
  }
}
