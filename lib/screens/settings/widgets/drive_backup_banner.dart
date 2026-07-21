import 'package:flutter/material.dart';

import '../../../core/theme/nyaki_colors.dart';
import 'google_drive_mark.dart';

class DriveBackupBanner extends StatelessWidget {
  const DriveBackupBanner({
    super.key,
    required this.connected,
    required this.onPrimaryTap,
  });

  final bool connected;
  final VoidCallback onPrimaryTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: NyakiColors.cardBg,
      shape: RoundedRectangleBorder(
        side: BorderSide(color: NyakiColors.ink.withValues(alpha: 0.12)),
        borderRadius: BorderRadius.circular(14),
      ),
      child: Padding(
        padding: const EdgeInsets.fromLTRB(16, 16, 14, 16),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const GoogleDriveMark(),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    '구글 드라이브 백업',
                    style: TextStyle(
                      fontFamily: 'Inter',
                      fontSize: 15,
                      fontWeight: FontWeight.w700,
                      color: NyakiColors.ink,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    '단어는 지금 이 기기에만 저장돼요. 앱을 삭제하면 데이터가 '
                    '사라질 수 있으니, 중요한 단어장은 드라이브에 백업해 두세요.',
                    style: TextStyle(
                      fontFamily: 'Inter',
                      fontSize: 12,
                      height: 1.55,
                      fontWeight: FontWeight.w400,
                      color: NyakiColors.ink.withValues(alpha: 0.55),
                    ),
                  ),
                  const SizedBox(height: 12),
                  FilledButton(
                    onPressed: onPrimaryTap,
                    style: FilledButton.styleFrom(
                      minimumSize: const Size(0, 38),
                      padding: const EdgeInsets.symmetric(
                        horizontal: 14,
                        vertical: 10,
                      ),
                      textStyle: const TextStyle(
                        fontFamily: 'Inter',
                        fontSize: 13,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    child: Text(
                      connected ? '지금 백업하기' : '드라이브 연결하기',
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(width: 4),
            Icon(
              Icons.pets_rounded,
              size: 22,
              color: NyakiColors.ink.withValues(alpha: 0.18),
            ),
          ],
        ),
      ),
    );
  }
}
