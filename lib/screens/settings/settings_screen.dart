import 'package:flutter/material.dart';

import '../../core/auth_scope.dart';
import '../../core/theme/nyaki_colors.dart';
import '../../data/auth/auth_controller.dart';
import '../../data/auth/auth_repository.dart';
import '../auth/sign_in_screen.dart';

/// 설정 탭. 계정(로그인) 관리를 담당한다.
class SettingsScreen extends StatelessWidget {
  const SettingsScreen({super.key});

  Future<void> _signOut(BuildContext context, AuthController auth) async {
    try {
      await auth.signOut();
    } catch (error) {
      if (!context.mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(error.toString())),
      );
    }
  }

  void _openSignIn(BuildContext context) {
    Navigator.of(context).push<void>(
      MaterialPageRoute<void>(builder: (_) => const SignInScreen()),
    );
  }

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: AuthScope.of(context),
      builder: (context, _) {
        final auth = AuthScope.of(context);
        final signedIn = auth.status == AuthStatus.signedIn;
        final user = auth.user;

        final welcomeName = user?.displayName ?? user?.email;

        return Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const Padding(
              padding: EdgeInsets.fromLTRB(28, 18, 28, 6),
              child: Text(
                '설정',
                style: TextStyle(
                  fontFamily: 'Inter',
                  fontSize: 22,
                  fontWeight: FontWeight.w700,
                  color: NyakiColors.ink,
                ),
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(28, 0, 28, 24),
              child: Text(
                signedIn
                    ? (welcomeName == null ? '환영해요!' : '$welcomeName님, 환영해요!')
                    : '로그인하면 계정을 연결할 수 있어요.',
                style: TextStyle(
                  fontFamily: 'Inter',
                  fontSize: 13,
                  fontWeight: FontWeight.w500,
                  color: NyakiColors.ink.withValues(alpha: 0.5),
                ),
              ),
            ),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 28),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    '계정',
                    style: TextStyle(
                      fontFamily: 'Inter',
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                      color: NyakiColors.ink.withValues(alpha: 0.45),
                    ),
                  ),
                  const SizedBox(height: 10),
                  _SettingsCard(
                    child: signedIn
                        ? _AccountRow(
                            user: user!,
                            onSignOut: () => _signOut(context, auth),
                          )
                        : _SignedOutRow(
                            onSignIn: () => _openSignIn(context),
                          ),
                  ),
                ],
              ),
            ),
          ],
        );
      },
    );
  }
}

class _SettingsCard extends StatelessWidget {
  const _SettingsCard({required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: NyakiColors.cream,
      shape: RoundedRectangleBorder(
        side: BorderSide(color: NyakiColors.ink.withValues(alpha: 0.14)),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
        child: child,
      ),
    );
  }
}

/// 로그인된 상태: 사용자 정보 + 로그아웃.
class _AccountRow extends StatelessWidget {
  const _AccountRow({required this.user, required this.onSignOut});

  final AuthUser user;
  final VoidCallback onSignOut;

  @override
  Widget build(BuildContext context) {
    final providerLabel =
        user.provider == SignInProvider.apple ? 'Apple 계정' : 'Google 계정';

    return Row(
      children: [
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                user.displayName ?? user.email ?? providerLabel,
                style: const TextStyle(
                  fontFamily: 'Inter',
                  fontSize: 15,
                  fontWeight: FontWeight.w600,
                  color: NyakiColors.ink,
                ),
              ),
              const SizedBox(height: 4),
              Text(
                providerLabel,
                style: TextStyle(
                  fontFamily: 'Inter',
                  fontSize: 12,
                  fontWeight: FontWeight.w400,
                  color: NyakiColors.ink.withValues(alpha: 0.45),
                ),
              ),
            ],
          ),
        ),
        TextButton(
          onPressed: onSignOut,
          style: TextButton.styleFrom(
            foregroundColor: NyakiColors.ink.withValues(alpha: 0.55),
          ),
          child: const Text(
            '로그아웃',
            style: TextStyle(
              fontFamily: 'Inter',
              fontSize: 13,
              fontWeight: FontWeight.w600,
            ),
          ),
        ),
      ],
    );
  }
}

/// 로그인 안 된 상태: 안내 + 로그인 진입.
class _SignedOutRow extends StatelessWidget {
  const _SignedOutRow({required this.onSignIn});

  final VoidCallback onSignIn;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                '로그인하지 않음',
                style: TextStyle(
                  fontFamily: 'Inter',
                  fontSize: 15,
                  fontWeight: FontWeight.w600,
                  color: NyakiColors.ink,
                ),
              ),
              const SizedBox(height: 4),
              Text(
                '단어는 이 기기에만 저장돼요',
                style: TextStyle(
                  fontFamily: 'Inter',
                  fontSize: 12,
                  fontWeight: FontWeight.w400,
                  color: NyakiColors.ink.withValues(alpha: 0.45),
                ),
              ),
            ],
          ),
        ),
        TextButton(
          onPressed: onSignIn,
          style: TextButton.styleFrom(
            foregroundColor: NyakiColors.ink,
          ),
          child: const Text(
            '로그인',
            style: TextStyle(
              fontFamily: 'Inter',
              fontSize: 13,
              fontWeight: FontWeight.w600,
            ),
          ),
        ),
      ],
    );
  }
}
