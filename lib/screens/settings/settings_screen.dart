import 'package:flutter/material.dart';

import '../../core/auth_scope.dart';
import '../../core/error_snackbar.dart';
import '../../core/nyaki_scope.dart';
import '../../core/progress_scope.dart';
import '../../core/theme/nyaki_colors.dart';
import '../../data/auth/auth_controller.dart';
import '../../data/auth/auth_repository.dart';
import '../auth/sign_in_screen.dart';
import 'google_drive_backup_screen.dart';

/// 마이페이지 탭. 계정·게이미피케이션 요약·학습 통계·데이터 백업을 담당한다.
class SettingsScreen extends StatefulWidget {
  const SettingsScreen({super.key});

  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
  bool _driveConnected = false;
  DateTime? _lastBackupAt;

  Future<void> _signOut(BuildContext context, AuthController auth) async {
    try {
      await auth.signOut();
    } catch (error) {
      if (!context.mounted) return;
      showErrorSnackBar(context, message: '로그아웃에 실패했어요.', error: error);
    }
  }

  void _openSignIn(BuildContext context) {
    Navigator.of(context).push<void>(
      MaterialPageRoute<void>(builder: (_) => const SignInScreen()),
    );
  }

  String _driveStatusLabel() {
    if (!_driveConnected) return '연결 안 됨';
    if (_lastBackupAt == null) return '연결됨';
    return '${_lastBackupAt!.month}월 ${_lastBackupAt!.day}일 백업';
  }

  Future<void> _openDriveBackup() async {
    final result = await Navigator.of(context).push<GoogleDriveBackupResult>(
      MaterialPageRoute<GoogleDriveBackupResult>(
        builder: (_) => GoogleDriveBackupScreen(
          initialConnected: _driveConnected,
          initialLastBackupAt: _lastBackupAt,
        ),
      ),
    );

    if (result == null || !mounted) return;

    setState(() {
      _driveConnected = result.connected;
      _lastBackupAt = result.lastBackupAt;
    });
  }

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: AuthScope.of(context),
      builder: (context, _) {
        final auth = AuthScope.of(context);
        final signedIn = auth.status == AuthStatus.signedIn;
        final user = auth.user;

        // NyakiScope/ProgressScope도 .of(context) 호출 자체가 구독을 걸어서,
        // 값이 바뀌면 이 build()가 다시 불린다 — 별도 ListenableBuilder 불필요.
        final wordBooks = NyakiScope.of(context).wordBooks;
        final totalWords = wordBooks.fold<int>(
          0,
          (sum, book) => sum + book.wordCount,
        );
        final progress = ProgressScope.of(context).snapshot;

        return SingleChildScrollView(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const Padding(
                padding: EdgeInsets.fromLTRB(28, 20, 28, 16),
                child: Text(
                  '마이페이지',
                  style: TextStyle(
                    fontFamily: 'Inter',
                    fontSize: 24,
                    fontWeight: FontWeight.w600,
                    letterSpacing: -0.3,
                    color: NyakiColors.ink,
                  ),
                ),
              ),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 28),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    signedIn
                        ? _ProfileHeader(
                            user: user!,
                            bookCount: wordBooks.length,
                            wordCount: totalWords,
                            onSignOut: () => _signOut(context, auth),
                          )
                        : _SignedOutHeader(
                            onSignIn: () => _openSignIn(context),
                          ),
                    const SizedBox(height: 22),

                    // 츄르 — 가장 중요한 값이라 2칸 와이드 카드.
                    _MyPageCard(
                      wide: true,
                      label: '츄르',
                      value: '${progress.churuBalance}',
                      valueFontSize: 26,
                      sub: '오늘 완료한 퀘스트 ${progress.completedQuestIds.length}개',
                    ),
                    const SizedBox(height: 10),

                    Row(
                      children: [
                        Expanded(
                          child: _MyPageCard(
                            label: '단어장',
                            value: '${wordBooks.length}개',
                          ),
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: _MyPageCard(
                            label: '전체 단어',
                            value: '$totalWords개',
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 10),

                    Row(
                      children: [
                        Expanded(
                          child: _MyPageCard(
                            label: '구글 드라이브',
                            value: _driveConnected ? '연결됨' : '연결 안 됨',
                            valueFontSize: 15,
                            sub: _driveConnected ? _driveStatusLabel() : null,
                            onTap: _openDriveBackup,
                          ),
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: _MyPageCard(
                            label: '자동 백업',
                            value: '끔',
                            valueFontSize: 15,
                            dim: true,
                          ),
                        ),
                      ],
                    ),

                    Padding(
                      padding: const EdgeInsets.only(top: 18),
                      child: Column(
                        children: [
                          if (signedIn)
                            const _FooterRow(label: '계정 삭제', value: '준비 중'),
                          const _FooterRow(label: '버전', value: '1.0.0'),
                        ],
                      ),
                    ),
                    const SizedBox(height: 24),
                  ],
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}

/// 로그인된 상태 헤더: 이니셜 배지 + 이름 + "제공자 · 단어장 N · 단어 M".
class _ProfileHeader extends StatelessWidget {
  const _ProfileHeader({
    required this.user,
    required this.bookCount,
    required this.wordCount,
    required this.onSignOut,
  });

  final AuthUser user;
  final int bookCount;
  final int wordCount;
  final VoidCallback onSignOut;

  String get _initial {
    final source = user.displayName ?? user.email ?? '?';
    return source.isEmpty ? '?' : source.substring(0, 1).toUpperCase();
  }

  @override
  Widget build(BuildContext context) {
    final providerLabel =
        user.provider == SignInProvider.apple ? 'Apple 계정' : 'Google 계정';

    return Row(
      crossAxisAlignment: CrossAxisAlignment.center,
      children: [
        Container(
          width: 52,
          height: 52,
          decoration: const BoxDecoration(
            color: NyakiColors.ink,
            shape: BoxShape.circle,
          ),
          alignment: Alignment.center,
          child: Text(
            _initial,
            style: const TextStyle(
              fontFamily: 'Inter',
              fontSize: 18,
              fontWeight: FontWeight.w700,
              color: NyakiColors.cardBg,
            ),
          ),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                user.displayName ?? user.email ?? providerLabel,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(
                  fontFamily: 'Inter',
                  fontSize: 16,
                  fontWeight: FontWeight.w700,
                  color: NyakiColors.ink,
                ),
              ),
              const SizedBox(height: 3),
              Text(
                '$providerLabel · 단어장 $bookCount · 단어 $wordCount',
                style: TextStyle(
                  fontFamily: 'Inter',
                  fontSize: 12.5,
                  color: NyakiColors.ink.withValues(alpha: 0.5),
                ),
              ),
            ],
          ),
        ),
        TextButton(
          onPressed: onSignOut,
          style: TextButton.styleFrom(
            foregroundColor: NyakiColors.ink.withValues(alpha: 0.45),
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
          ),
          child: const Text(
            '로그아웃',
            style: TextStyle(
              fontFamily: 'Inter',
              fontSize: 12,
              fontWeight: FontWeight.w600,
            ),
          ),
        ),
      ],
    );
  }
}

/// 로그인 안 된 상태 헤더: 안내 + 로그인 진입.
class _SignedOutHeader extends StatelessWidget {
  const _SignedOutHeader({required this.onSignIn});

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
                  color: NyakiColors.ink.withValues(alpha: 0.45),
                ),
              ),
            ],
          ),
        ),
        TextButton(
          onPressed: onSignIn,
          style: TextButton.styleFrom(foregroundColor: NyakiColors.ink),
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

/// 마이페이지 카드 그리드의 한 칸. [wide]면 한 줄 전체를 차지한다.
class _MyPageCard extends StatelessWidget {
  const _MyPageCard({
    required this.label,
    required this.value,
    this.valueFontSize = 20,
    this.sub,
    this.wide = false,
    this.dim = false,
    this.onTap,
  });

  final String label;
  final String value;
  final double valueFontSize;
  final String? sub;
  final bool wide;
  final bool dim;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final opacity = dim ? 0.55 : 1.0;

    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(20),
      child: Opacity(
        opacity: opacity,
        child: Container(
          width: wide ? double.infinity : null,
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 14),
          decoration: BoxDecoration(
            color: NyakiColors.cardBg,
            borderRadius: BorderRadius.circular(20),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                label,
                style: TextStyle(
                  fontFamily: 'Inter',
                  fontSize: 11.5,
                  fontWeight: FontWeight.w600,
                  color: NyakiColors.ink.withValues(alpha: 0.45),
                ),
              ),
              const SizedBox(height: 8),
              Text(
                value,
                style: TextStyle(
                  fontFamily: 'Inter',
                  fontSize: valueFontSize,
                  fontWeight: FontWeight.w700,
                  color: NyakiColors.ink,
                ),
              ),
              if (sub != null) ...[
                const SizedBox(height: 2),
                Text(
                  sub!,
                  style: TextStyle(
                    fontFamily: 'Inter',
                    fontSize: 11,
                    color: NyakiColors.ink.withValues(alpha: 0.45),
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

/// 카드 그리드 밖, 얇은 텍스트 항목(계정 삭제/버전 등).
class _FooterRow extends StatelessWidget {
  const _FooterRow({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 13),
      decoration: BoxDecoration(
        border: Border(
          bottom: BorderSide(color: NyakiColors.softDune, width: 1),
        ),
      ),
      child: Row(
        children: [
          Expanded(
            child: Text(
              label,
              style: const TextStyle(
                fontFamily: 'Inter',
                fontSize: 13.5,
                fontWeight: FontWeight.w600,
                color: NyakiColors.ink,
              ),
            ),
          ),
          Text(
            value,
            style: TextStyle(
              fontFamily: 'Inter',
              fontSize: 12.5,
              fontWeight: FontWeight.w500,
              color: NyakiColors.ink.withValues(alpha: 0.45),
            ),
          ),
        ],
      ),
    );
  }
}
