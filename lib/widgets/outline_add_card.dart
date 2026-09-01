import 'package:flutter/material.dart';

import '../core/theme/nyaki_colors.dart';

// ===================== ✨ OutlineAddCard ✨ ===================== //
// 리스트에 놓이는 "추가" 카드. (단어장 목록의 '새 단어장 추가',
// 단어장 상세의 빈 화면 '단어 추가')
//
// ⚠️ WordTile과 같은 이유로 Ink 대신 Material + InkWell을 쓴다.
//    Ink는 테두리를 조상 Material에 그려서 스크롤 밖으로 새어 나온다.

class OutlineAddCard extends StatelessWidget {
  const OutlineAddCard({
    super.key,
    required this.label,
    required this.onTap,
    this.dense = false,
  });

  final String label;
  final VoidCallback onTap;

  /// true면 테두리·여백·글자를 한 단계 줄인다.
  final bool dense;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      clipBehavior: Clip.antiAlias,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(dense ? 12 : 22),
        side: BorderSide(
          color: dense
              ? NyakiColors.taupe.withValues(alpha: 0.85)
              : NyakiColors.taupe,
          width: dense ? 1 : 1.2,
        ),
      ),
      child: InkWell(
        onTap: onTap,
        splashColor: NyakiColors.softDune.withValues(alpha: 0.35),
        child: Padding(
          padding: EdgeInsets.symmetric(vertical: dense ? 10 : 14),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(
                Icons.add_rounded,
                size: dense ? 13 : 16,
                color: NyakiColors.ink.withValues(alpha: dense ? 0.42 : 0.55),
              ),
              SizedBox(width: dense ? 5 : 6),
              Text(
                label,
                style: TextStyle(
                  fontFamily: 'Inter',
                  fontSize: dense ? 12 : 13,
                  fontWeight: FontWeight.w500,
                  letterSpacing: -0.1,
                  color: NyakiColors.ink.withValues(alpha: dense ? 0.42 : 0.55),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
