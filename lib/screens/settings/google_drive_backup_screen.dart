import 'dart:async';

import 'package:flutter/material.dart';

import '../../core/auth_scope.dart';
import '../../core/theme/nyaki_colors.dart';
import '../../data/auth/auth_repository.dart';
import 'widgets/google_drive_mark.dart';

/// 구글 드라이브 백업 상세. API 연동 전 UI 목업.
class GoogleDriveBackupScreen extends StatefulWidget {
  const GoogleDriveBackupScreen({
    super.key,
    this.initialConnected = false,
    this.initialLastBackupAt,
  });

  final bool initialConnected;
  final DateTime? initialLastBackupAt;

  @override
  State<GoogleDriveBackupScreen> createState() =>
      _GoogleDriveBackupScreenState();
}

class _GoogleDriveBackupScreenState extends State<GoogleDriveBackupScreen> {
  late bool _connected;
  DateTime? _lastBackupAt;

  @override
  void initState() {
    super.initState();
    _connected = widget.initialConnected;
    _lastBackupAt = widget.initialLastBackupAt;
  }

  String _formatBackupTime(DateTime time) {
    final hour = time.hour;
    final minute = time.minute.toString().padLeft(2, '0');
    final period = hour >= 12 ? '오후' : '오전';
    final hour12 = hour % 12 == 0 ? 12 : hour % 12;
    return '${time.year}. ${time.month}. ${time.day}. $period $hour12:$minute';
  }

  Future<void> _connectDrive() async {
    setState(() => _connected = true);
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('구글 드라이브에 연결했어요')),
    );
  }

  Future<void> _disconnectDrive() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: NyakiColors.cream,
        title: const Text(
          '드라이브 연결을 해제할까요?',
          style: TextStyle(
            fontFamily: 'Inter',
            fontSize: 17,
            fontWeight: FontWeight.w700,
            color: NyakiColors.ink,
          ),
        ),
        content: Text(
          '백업 파일은 드라이브에 그대로 남아요.',
          style: TextStyle(
            fontFamily: 'Inter',
            fontSize: 14,
            color: NyakiColors.ink.withValues(alpha: 0.6),
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: const Text('취소'),
          ),
          TextButton(
            onPressed: () => Navigator.of(context).pop(true),
            child: const Text('해제'),
          ),
        ],
      ),
    );

    if (confirmed != true || !mounted) return;

    setState(() {
      _connected = false;
      _lastBackupAt = null;
    });
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('드라이브 연결을 해제했어요')),
    );
  }

  Future<void> _runBackup() async {
    if (!_connected) {
      await _connectDrive();
      if (!mounted || !_connected) return;
    }

    final completed = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      backgroundColor: NyakiColors.cream,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(18)),
      ),
      builder: (context) => const _DriveBackupProgressSheet(),
    );

    if (completed != true || !mounted) return;

    setState(() => _lastBackupAt = DateTime.now());
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('드라이브에 백업했어요')),
    );
  }

  Future<void> _importBackup() async {
    if (!_connected) {
      await _connectDrive();
      if (!mounted || !_connected) return;
    }

    final confirmed = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      backgroundColor: NyakiColors.cream,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(18)),
      ),
      builder: (context) => _DriveImportConfirmSheet(
        fileName: 'nyaki-backup-20260721.json',
        wordBookCount: 2,
        wordCount: 47,
        backupAt: _lastBackupAt ?? DateTime(2026, 7, 21, 15, 12),
      ),
    );

    if (confirmed != true || !mounted) return;

    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('드라이브 백업을 가져왔어요')),
    );
  }

  @override
  Widget build(BuildContext context) {
    final auth = AuthScope.of(context);
    final user = auth.user;
    final accountLabel = user?.email ??
        (user?.provider == SignInProvider.apple ? 'Apple 계정' : 'Google 계정');

    return Scaffold(
      backgroundColor: NyakiColors.cream,
      body: SafeArea(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(12, 8, 20, 0),
              child: Align(
                alignment: Alignment.centerLeft,
                child: IconButton(
                  onPressed: () => Navigator.of(context).pop(
                    GoogleDriveBackupResult(
                      connected: _connected,
                      lastBackupAt: _lastBackupAt,
                    ),
                  ),
                  icon: const Icon(Icons.arrow_back_ios_new_rounded),
                  iconSize: 18,
                  color: NyakiColors.ink,
                ),
              ),
            ),
            const Padding(
              padding: EdgeInsets.fromLTRB(28, 4, 28, 6),
              child: Text(
                '구글 드라이브',
                style: TextStyle(
                  fontFamily: 'Inter',
                  fontSize: 22,
                  fontWeight: FontWeight.w700,
                  color: NyakiColors.ink,
                ),
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(28, 0, 28, 20),
              child: Text(
                'Nyaki 단어장을 내 드라이브에 보관해요.',
                style: TextStyle(
                  fontFamily: 'Inter',
                  fontSize: 13,
                  fontWeight: FontWeight.w500,
                  color: NyakiColors.ink.withValues(alpha: 0.5),
                ),
              ),
            ),
            Expanded(
              child: ListView(
                padding: const EdgeInsets.fromLTRB(28, 0, 28, 28),
                children: [
                  _StatusCard(
                    connected: _connected,
                    accountLabel: accountLabel,
                    lastBackupLabel: _lastBackupAt == null
                        ? '아직 백업하지 않았어요'
                        : '마지막 백업 · ${_formatBackupTime(_lastBackupAt!)}',
                  ),
                  const SizedBox(height: 14),
                  _ActionCard(
                    title: '지금 백업하기',
                    description: '이 기기의 단어장을 드라이브 Nyaki 폴더에 저장',
                    primary: true,
                    onTap: _runBackup,
                  ),
                  const SizedBox(height: 10),
                  _ActionCard(
                    title: '드라이브에서 가져오기',
                    description: '백업 파일을 선택해 이 기기에 복원',
                    onTap: _importBackup,
                  ),
                  const SizedBox(height: 10),
                  _ActionCard(
                    title: 'CSV로 내보내기',
                    description: '스프레드시트 편집용 파일 저장',
                    muted: true,
                    onTap: () {
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(content: Text('준비 중이에요')),
                      );
                    },
                  ),
                  if (_connected) ...[
                    const SizedBox(height: 24),
                    Center(
                      child: TextButton(
                        onPressed: _disconnectDrive,
                        child: Text(
                          '드라이브 연결 해제',
                          style: TextStyle(
                            fontFamily: 'Inter',
                            fontSize: 13,
                            fontWeight: FontWeight.w600,
                            color: NyakiColors.ink.withValues(alpha: 0.45),
                          ),
                        ),
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class GoogleDriveBackupResult {
  const GoogleDriveBackupResult({
    required this.connected,
    this.lastBackupAt,
  });

  final bool connected;
  final DateTime? lastBackupAt;
}

class _StatusCard extends StatelessWidget {
  const _StatusCard({
    required this.connected,
    required this.accountLabel,
    required this.lastBackupLabel,
  });

  final bool connected;
  final String accountLabel;
  final String lastBackupLabel;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: NyakiColors.cream,
      shape: RoundedRectangleBorder(
        side: BorderSide(color: NyakiColors.ink.withValues(alpha: 0.14)),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const GoogleDriveMark(size: 32),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    connected ? '연결됨' : '연결 안 됨',
                    style: TextStyle(
                      fontFamily: 'Inter',
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                      color: connected
                          ? NyakiColors.ink.withValues(alpha: 0.45)
                          : NyakiColors.ink.withValues(alpha: 0.35),
                    ),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    accountLabel,
                    style: const TextStyle(
                      fontFamily: 'Inter',
                      fontSize: 15,
                      fontWeight: FontWeight.w600,
                      color: NyakiColors.ink,
                    ),
                  ),
                  const SizedBox(height: 10),
                  Text(
                    lastBackupLabel,
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
          ],
        ),
      ),
    );
  }
}

class _ActionCard extends StatelessWidget {
  const _ActionCard({
    required this.title,
    required this.description,
    required this.onTap,
    this.primary = false,
    this.muted = false,
  });

  final String title;
  final String description;
  final VoidCallback onTap;
  final bool primary;
  final bool muted;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: primary ? NyakiColors.cardBg : NyakiColors.cream,
      shape: RoundedRectangleBorder(
        side: BorderSide(
          color: primary
              ? NyakiColors.ink.withValues(alpha: 0.22)
              : NyakiColors.ink.withValues(alpha: 0.12),
        ),
        borderRadius: BorderRadius.circular(12),
      ),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: Opacity(
          opacity: muted ? 0.72 : 1,
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: const TextStyle(
                    fontFamily: 'Inter',
                    fontSize: 14,
                    fontWeight: FontWeight.w700,
                    color: NyakiColors.ink,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  description,
                  style: TextStyle(
                    fontFamily: 'Inter',
                    fontSize: 12,
                    height: 1.5,
                    fontWeight: FontWeight.w400,
                    color: NyakiColors.ink.withValues(alpha: 0.5),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _DriveBackupProgressSheet extends StatefulWidget {
  const _DriveBackupProgressSheet();

  @override
  State<_DriveBackupProgressSheet> createState() =>
      _DriveBackupProgressSheetState();
}

class _DriveBackupProgressSheetState extends State<_DriveBackupProgressSheet> {
  double _progress = 0;

  @override
  void initState() {
    super.initState();
    _simulateProgress();
  }

  Future<void> _simulateProgress() async {
    for (var step = 1; step <= 20; step++) {
      await Future<void>.delayed(const Duration(milliseconds: 80));
      if (!mounted) return;
      setState(() => _progress = step / 20);
    }
    if (!mounted) return;
    Navigator.of(context).pop(true);
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.fromLTRB(
        24,
        16,
        24,
        24 + MediaQuery.viewPaddingOf(context).bottom,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Center(
            child: Container(
              width: 36,
              height: 4,
              decoration: BoxDecoration(
                color: NyakiColors.muted,
                borderRadius: BorderRadius.circular(999),
              ),
            ),
          ),
          const SizedBox(height: 20),
          const Text(
            '드라이브에 백업 중',
            style: TextStyle(
              fontFamily: 'Inter',
              fontSize: 17,
              fontWeight: FontWeight.w700,
              color: NyakiColors.ink,
            ),
          ),
          const SizedBox(height: 10),
          Text(
            '냥키 단어장 2권 · 단어 47개',
            style: TextStyle(
              fontFamily: 'Inter',
              fontSize: 13,
              fontWeight: FontWeight.w400,
              color: NyakiColors.ink.withValues(alpha: 0.55),
            ),
          ),
          const SizedBox(height: 18),
          ClipRRect(
            borderRadius: BorderRadius.circular(999),
            child: LinearProgressIndicator(
              minHeight: 6,
              value: _progress,
              backgroundColor: NyakiColors.muted,
              color: NyakiColors.ink,
            ),
          ),
          const SizedBox(height: 10),
          Text(
            'nyaki-backup-20260721.json 업로드 중',
            style: TextStyle(
              fontFamily: 'Inter',
              fontSize: 12,
              fontWeight: FontWeight.w400,
              color: NyakiColors.ink.withValues(alpha: 0.35),
            ),
          ),
        ],
      ),
    );
  }
}

class _DriveImportConfirmSheet extends StatelessWidget {
  const _DriveImportConfirmSheet({
    required this.fileName,
    required this.wordBookCount,
    required this.wordCount,
    required this.backupAt,
  });

  final String fileName;
  final int wordBookCount;
  final int wordCount;
  final DateTime backupAt;

  String _formatBackupTime(DateTime time) {
    final hour = time.hour;
    final minute = time.minute.toString().padLeft(2, '0');
    final period = hour >= 12 ? '오후' : '오전';
    final hour12 = hour % 12 == 0 ? 12 : hour % 12;
    return '${time.year}. ${time.month}. ${time.day}. $period $hour12:$minute';
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.fromLTRB(
        24,
        16,
        24,
        24 + MediaQuery.viewPaddingOf(context).bottom,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Center(
            child: Container(
              width: 36,
              height: 4,
              decoration: BoxDecoration(
                color: NyakiColors.muted,
                borderRadius: BorderRadius.circular(999),
              ),
            ),
          ),
          const SizedBox(height: 20),
          const Text(
            '드라이브 백업을 가져올까요?',
            style: TextStyle(
              fontFamily: 'Inter',
              fontSize: 17,
              fontWeight: FontWeight.w700,
              color: NyakiColors.ink,
            ),
          ),
          const SizedBox(height: 12),
          Text(
            '$fileName\n'
            '단어장 $wordBookCount권 · 단어 $wordCount개\n'
            '백업 시각 · ${_formatBackupTime(backupAt)}',
            style: TextStyle(
              fontFamily: 'Inter',
              fontSize: 13,
              height: 1.6,
              fontWeight: FontWeight.w400,
              color: NyakiColors.ink.withValues(alpha: 0.55),
            ),
          ),
          const SizedBox(height: 16),
          Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: NyakiColors.cardBg,
              borderRadius: BorderRadius.circular(10),
              border: Border.all(
                color: NyakiColors.ink.withValues(alpha: 0.1),
              ),
            ),
            child: Text(
              '현재 기기의 단어장과 합칩니다. 같은 단어는 덮어쓰지 않고 건너뜁니다.',
              style: TextStyle(
                fontFamily: 'Inter',
                fontSize: 12,
                height: 1.5,
                fontWeight: FontWeight.w500,
                color: NyakiColors.ink.withValues(alpha: 0.6),
              ),
            ),
          ),
          const SizedBox(height: 18),
          Row(
            children: [
              Expanded(
                child: OutlinedButton(
                  onPressed: () => Navigator.of(context).pop(false),
                  style: OutlinedButton.styleFrom(
                    foregroundColor: NyakiColors.ink,
                    side: BorderSide(
                      color: NyakiColors.ink.withValues(alpha: 0.18),
                    ),
                    minimumSize: const Size(0, 46),
                  ),
                  child: const Text(
                    '취소',
                    style: TextStyle(
                      fontFamily: 'Inter',
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: FilledButton(
                  onPressed: () => Navigator.of(context).pop(true),
                  style: FilledButton.styleFrom(
                    minimumSize: const Size(0, 46),
                  ),
                  child: const Text(
                    '가져오기',
                    style: TextStyle(
                      fontFamily: 'Inter',
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
