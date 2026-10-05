import 'package:flutter/material.dart';

import '../core/theme/nyaki_colors.dart';

// ===================== ✨ WordTile ✨ ===================== //
// 단어장 상세의 단어 한 장. Ivory 배경 위 Off white 카드.
//
// ⚠️ Ink를 쓰지 않는 이유 (2026-08-31)
//  - Ink는 자기 배경을 "조상 Material"의 캔버스에 그린다. 그래서 ListView
//    안에서 쓰면 스크롤 뷰포트의 클리핑을 무시하고, 위로 드래그할 때
//    카드 배경이 헤더/탭 영역 아래까지 새어 보인다.
//  - 카드마다 Material을 두고 clipBehavior로 잘라내면 잉크와 배경이
//    그 카드 안에만 그려진다.

class WordTile extends StatelessWidget {
  const WordTile({
    super.key,
    required this.word,
    required this.meaning,
    this.pronunciation,
    this.isBookmarked = false,
    this.onTap,
    this.onBookmarkTap,
  });

  // ✨ Variable ✨
  final String word;
  final String meaning;

  /// 있으면 term 오른쪽에 작게 붙는다. (없으면 자리 차지 안 함)
  final String? pronunciation;

  /// 북마크 채움 여부. onBookmarkTap이 null이면 아이콘 자체가 안 그려진다.
  final bool isBookmarked;

  final VoidCallback? onTap;
  final VoidCallback? onBookmarkTap;

  @override
  Widget build(BuildContext context) {
    final hasPronunciation =
        pronunciation != null && pronunciation!.trim().isNotEmpty;

    return Material(
      color: NyakiColors.cardBg,
      borderRadius: BorderRadius.circular(12),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onTap,
        splashColor: NyakiColors.softDune.withValues(alpha: 0.3),
        highlightColor: NyakiColors.softDune.withValues(alpha: 0.18),
        child: Padding(
          padding: const EdgeInsets.fromLTRB(14, 12, 8, 12),
          child: Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.baseline,
                      textBaseline: TextBaseline.alphabetic,
                      children: [
                        Flexible(
                          child: Text(
                            word,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(
                              fontFamily: 'Inter',
                              fontSize: 15,
                              fontWeight: FontWeight.w600,
                              letterSpacing: -0.15,
                              height: 1.25,
                              color: NyakiColors.ink,
                            ),
                          ),
                        ),
                        if (hasPronunciation) ...[
                          const SizedBox(width: 6),
                          Flexible(
                            child: Text(
                              pronunciation!,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: TextStyle(
                                fontFamily: 'Inter',
                                fontSize: 11,
                                fontWeight: FontWeight.w400,
                                color: NyakiColors.ink.withValues(alpha: 0.28),
                              ),
                            ),
                          ),
                        ],
                      ],
                    ),
                    const SizedBox(height: 2),
                    Text(
                      meaning,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        fontFamily: 'Inter',
                        fontSize: 12.5,
                        fontWeight: FontWeight.w400,
                        height: 1.3,
                        color: NyakiColors.ink.withValues(alpha: 0.45),
                      ),
                    ),
                  ],
                ),
              ),
              if (onBookmarkTap != null)
                _BookmarkButton(
                  isBookmarked: isBookmarked,
                  onTap: onBookmarkTap!,
                ),
            ],
          ),
        ),
      ),
    );
  }
}

/// 카드 오른쪽 북마크 토글. 꺼져 있을 땐 거의 안 보일 만큼 옅게 둔다.
class _BookmarkButton extends StatelessWidget {
  const _BookmarkButton({required this.isBookmarked, required this.onTap});

  final bool isBookmarked;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkResponse(
      onTap: onTap,
      radius: 18,
      containedInkWell: false,
      child: Padding(
        padding: const EdgeInsets.all(6),
        child: Icon(
          isBookmarked
              ? Icons.bookmark_rounded
              : Icons.bookmark_border_rounded,
          size: 15,
          color: isBookmarked
              ? NyakiColors.ink
              : NyakiColors.ink.withValues(alpha: 0.18),
        ),
      ),
    );
  }
}
