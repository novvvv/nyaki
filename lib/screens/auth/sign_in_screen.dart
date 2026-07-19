import 'package:flutter/material.dart';

import '../../core/auth_scope.dart';
import '../../core/theme/nyaki_colors.dart';
import '../../data/auth/auth_repository.dart';

/// 선택형 로그인 화면. Apple·Google 로그인 또는 건너뛰기.
class SignInScreen extends StatelessWidget {
  const SignInScreen({super.key});

  Future<void> _run(
      BuildContext context, Future<void> Function() action) async {
    try {
      await action();
      // 설정 화면 등에서 push된 경우 로그인 성공 시 닫는다.
      if (context.mounted && Navigator.of(context).canPop()) {
        Navigator.of(context).pop();
      }
    } on AuthCancelledException {
      // 사용자가 로그인 창을 닫은 경우: 조용히 화면 유지.
    } catch (error) {
      if (!context.mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(error.toString())),
      );
    }
  }

  Future<void> _skip(BuildContext context) async {
    final navigator = Navigator.of(context);
    if (navigator.canPop()) {
      navigator.pop();
      return;
    }
    await AuthScope.of(context).skipSignIn();
  }

  @override
  Widget build(BuildContext context) {
    final auth = AuthScope.of(context);
    final width = MediaQuery.sizeOf(context).width;
    final catSize = (width * 0.4).clamp(128.0, 176.0);

    return Scaffold(
      backgroundColor: NyakiColors.cream,
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 32),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const Text(
                'Nyaki',
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontFamily: 'Inter',
                  fontSize: 26,
                  fontWeight: FontWeight.w700,
                  color: NyakiColors.ink,
                ),
              ),
              const SizedBox(height: 24),
              Center(
                child: SizedBox(
                  width: catSize,
                  height: catSize,
                  child: Image.asset(
                    'assets/images/nyangki_sleeping.png',
                    fit: BoxFit.contain,
                  ),
                ),
              ),
              const SizedBox(height: 40),
              _SignInButton(
                label: 'Apple로 계속',
                icon: Icons.apple_rounded,
                filled: true,
                enabled: !auth.busy,
                onTap: () => _run(context, auth.signInWithApple),
              ),
              const SizedBox(height: 10),
              _SignInButton(
                label: 'Google로 계속',
                icon: Icons.g_mobiledata_rounded,
                filled: false,
                enabled: !auth.busy,
                onTap: () => _run(context, auth.signInWithGoogle),
              ),
              const SizedBox(height: 14),
              TextButton(
                onPressed: auth.busy ? null : () => _skip(context),
                style: TextButton.styleFrom(
                  foregroundColor: NyakiColors.ink.withValues(alpha: 0.45),
                ),
                child: const Text(
                  '로그인 없이 시작',
                  style: TextStyle(
                    fontFamily: 'Inter',
                    fontSize: 13,
                    fontWeight: FontWeight.w500,
                    decoration: TextDecoration.underline,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _SignInButton extends StatelessWidget {
  const _SignInButton({
    required this.label,
    required this.icon,
    required this.filled,
    required this.enabled,
    required this.onTap,
  });

  final String label;
  final IconData icon;
  final bool filled;
  final bool enabled;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final foreground = filled ? NyakiColors.cream : NyakiColors.ink;

    return SizedBox(
      height: 52,
      child: Material(
        color: filled ? NyakiColors.ink : Colors.transparent,
        shape: RoundedRectangleBorder(
          side: BorderSide(
            color: NyakiColors.ink.withValues(alpha: filled ? 1 : 0.25),
          ),
          borderRadius: BorderRadius.circular(10),
        ),
        child: InkWell(
          onTap: enabled ? onTap : null,
          borderRadius: BorderRadius.circular(10),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(icon, size: 22, color: foreground),
              const SizedBox(width: 8),
              Text(
                label,
                style: TextStyle(
                  fontFamily: 'Inter',
                  fontSize: 15,
                  fontWeight: FontWeight.w600,
                  color: foreground,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
