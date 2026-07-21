import 'package:flutter/material.dart';

import '../../core/auth_scope.dart';
import '../../core/theme/nyaki_colors.dart';
import '../../data/auth/auth_repository.dart';

/// 웹 로그인 화면과 같은 톤의 선택형 로그인.
class SignInScreen extends StatelessWidget {
  const SignInScreen({super.key});

  static const _catAsset = 'assets/images/cat.png';

  Future<void> _run(
    BuildContext context,
    Future<void> Function() action,
  ) async {
    try {
      await action();
      if (context.mounted && Navigator.of(context).canPop()) {
        Navigator.of(context).pop();
      }
    } on AuthCancelledException {
      // 사용자가 로그인 창을 닫은 경우.
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
    final catSize = (width * 0.68).clamp(220.0, 260.0);

    return Scaffold(
      backgroundColor: NyakiColors.cream,
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 24),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 340),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    'Vocabulary, calmly',
                    style: TextStyle(
                      fontFamily: 'Inter',
                      fontSize: 11,
                      fontWeight: FontWeight.w500,
                      letterSpacing: 2.4,
                      color: NyakiColors.ink.withValues(alpha: 0.35),
                    ),
                  ),
                  const SizedBox(height: 10),
                  const Text(
                    'Nyaki',
                    style: TextStyle(
                      fontFamily: 'Inter',
                      fontSize: 40,
                      fontWeight: FontWeight.w600,
                      letterSpacing: -0.5,
                      color: NyakiColors.ink,
                    ),
                  ),
                  const SizedBox(height: 12),
                  Text(
                    '폰과 웹에서 같은 단어장을\n외우고, 기록하고, 어디서든 이어서.',
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      fontFamily: 'Inter',
                      fontSize: 15,
                      height: 1.65,
                      color: NyakiColors.ink.withValues(alpha: 0.45),
                    ),
                  ),
                  const SizedBox(height: 28),
                  Text(
                    '궁금한 거 있으면 언제든지 물어보라냥',
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      fontFamily: 'Inter',
                      fontSize: 15,
                      fontWeight: FontWeight.w500,
                      height: 1.5,
                      color: NyakiColors.ink.withValues(alpha: 0.6),
                    ),
                  ),
                  const SizedBox(height: 16),
                  Image.asset(
                    _catAsset,
                    width: catSize,
                    height: catSize,
                    fit: BoxFit.contain,
                  ),
                  const SizedBox(height: 28),
                  _SignInButton(
                    label: 'Google로 계속하기',
                    filled: true,
                    enabled: !auth.busy,
                    onTap: () => _run(context, auth.signInWithGoogle),
                  ),
                  const SizedBox(height: 10),
                  _SignInButton(
                    label: 'Apple로 계속',
                    filled: false,
                    enabled: !auth.busy,
                    onTap: () => _run(context, auth.signInWithApple),
                  ),
                  const SizedBox(height: 8),
                  TextButton(
                    onPressed: auth.busy ? null : () => _skip(context),
                    style: TextButton.styleFrom(
                      foregroundColor: NyakiColors.ink.withValues(alpha: 0.4),
                    ),
                    child: const Text(
                      '로그인 없이 시작',
                      style: TextStyle(
                        fontFamily: 'Inter',
                        fontSize: 13,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  ),
                  const SizedBox(height: 16),
                  Text(
                    '모바일 앱과 실시간 동기화',
                    style: TextStyle(
                      fontFamily: 'Inter',
                      fontSize: 11,
                      color: NyakiColors.ink.withValues(alpha: 0.3),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _SignInButton extends StatelessWidget {
  const _SignInButton({
    required this.label,
    required this.filled,
    required this.enabled,
    required this.onTap,
  });

  final String label;
  final bool filled;
  final bool enabled;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final foreground = filled ? NyakiColors.cream : NyakiColors.ink;

    return SizedBox(
      width: double.infinity,
      height: 44,
      child: Material(
        color: filled ? NyakiColors.ink : Colors.transparent,
        shape: RoundedRectangleBorder(
          side: BorderSide(
            color: NyakiColors.ink.withValues(alpha: filled ? 1 : 0.08),
          ),
          borderRadius: BorderRadius.circular(8),
        ),
        child: InkWell(
          onTap: enabled ? onTap : null,
          borderRadius: BorderRadius.circular(8),
          child: Center(
            child: Text(
              label,
              style: TextStyle(
                fontFamily: 'Inter',
                fontSize: 15,
                fontWeight: FontWeight.w500,
                color: foreground,
              ),
            ),
          ),
        ),
      ),
    );
  }
}
