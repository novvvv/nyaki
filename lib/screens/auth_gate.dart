import 'package:flutter/material.dart';

import '../core/auth_scope.dart';
import '../core/theme/nyaki_colors.dart';
import '../data/auth/auth_controller.dart';
import 'app_shell.dart';
import 'sign_in_screen.dart';

/// 세션 복원 결과에 따라 로그인 화면 또는 앱 본체를 보여준다.
/// 건너뛰기를 선택하면 로컬 전용 모드로 앱에 진입한다.
class AuthGate extends StatelessWidget {
  const AuthGate({super.key});

  @override
  Widget build(BuildContext context) {
    final auth = AuthScope.of(context);

    switch (auth.status) {
      case AuthStatus.initializing:
        return const Scaffold(
          backgroundColor: NyakiColors.cream,
          body: Center(
            child: CircularProgressIndicator(color: NyakiColors.ink),
          ),
        );
      case AuthStatus.signedOut:
        return auth.skipped ? const AppShell() : const SignInScreen();
      case AuthStatus.signedIn:
        return const AppShell();
    }
  }
}
