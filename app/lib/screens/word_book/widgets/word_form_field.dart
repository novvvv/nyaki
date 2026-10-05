import 'package:flutter/material.dart';

import '../../../core/theme/nyaki_colors.dart';

// ===============================================
// 단어 추가/수정 화면이 공유하는 폼 부품.
// - WordFormTopBar : [뒤로·액션] / [가운데] / [즐겨찾기] 3분할 상단 바
// - WordFormField  : 밑줄형 입력 필드
// 두 화면의 시각 언어를 하나로 맞추기 위해 여기 모아둔다.
// ===============================================

/// 단어 폼 상단 바.
///
/// 왼쪽에 뒤로가기 + 저장/추가 액션, 가운데에 [center] (단어장 선택 또는 화면 제목),
/// 오른쪽에 즐겨찾기 하트를 둔다. 큰 제목 대신 가벼운 텍스트 버튼으로 처리해서
/// 폼 자체에 시선이 먼저 가도록 한다.
class WordFormTopBar extends StatelessWidget {
  const WordFormTopBar({
    super.key,
    required this.showBack,
    required this.actionLabel,
    required this.onAction,
    required this.isBookmarked,
    required this.onBookmarkChanged,
    required this.center,
  });

  final bool showBack;
  final String actionLabel;

  /// null이면 액션 비활성(저장 중이거나 저장 대상이 없을 때).
  final VoidCallback? onAction;
  final bool isBookmarked;
  final ValueChanged<bool> onBookmarkChanged;
  final Widget center;

  @override
  Widget build(BuildContext context) {
    final enabled = onAction != null;

    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 10, 16, 6),
      child: Stack(
        alignment: Alignment.center,
        children: [
          // 가운데 — 단어장 선택 / 화면 제목. 양쪽 버튼과 겹치지 않게 여백을 준다.
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 96),
            child: Align(alignment: Alignment.center, child: center),
          ),

          Align(
            alignment: Alignment.centerLeft,
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                if (showBack)
                  IconButton(
                    onPressed: () => Navigator.of(context).pop(),
                    icon: const Icon(Icons.arrow_back_ios_new_rounded),
                    iconSize: 17,
                    color: NyakiColors.ink.withValues(alpha: 0.45),
                    tooltip: '뒤로',
                    padding: EdgeInsets.zero,
                    constraints: const BoxConstraints(
                      minWidth: 34,
                      minHeight: 34,
                    ),
                  ),
                TextButton(
                  onPressed: onAction,
                  style: TextButton.styleFrom(
                    foregroundColor: NyakiColors.ink,
                    disabledForegroundColor:
                        NyakiColors.ink.withValues(alpha: 0.25),
                    padding: const EdgeInsets.symmetric(
                      horizontal: 8,
                      vertical: 6,
                    ),
                    minimumSize: Size.zero,
                    tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                  ),
                  child: Text(
                    actionLabel,
                    style: TextStyle(
                      fontFamily: 'Inter',
                      fontSize: 14,
                      fontWeight: FontWeight.w600,
                      color: enabled
                          ? NyakiColors.ink
                          : NyakiColors.ink.withValues(alpha: 0.25),
                    ),
                  ),
                ),
              ],
            ),
          ),

          Align(
            alignment: Alignment.centerRight,
            child: IconButton(
              onPressed: () => onBookmarkChanged(!isBookmarked),
              icon: Icon(
                isBookmarked
                    ? Icons.favorite_rounded
                    : Icons.favorite_border_rounded,
              ),
              iconSize: 19,
              color: isBookmarked
                  ? NyakiColors.ink
                  : NyakiColors.ink.withValues(alpha: 0.3),
              tooltip: isBookmarked ? '즐겨찾기 해제' : '즐겨찾기',
              padding: EdgeInsets.zero,
              constraints: const BoxConstraints(minWidth: 36, minHeight: 36),
            ),
          ),
        ],
      ),
    );
  }
}

/// 밑줄형 입력 필드. 라벨은 작게 위에, 선은 포커스일 때만 진해진다.
class WordFormField extends StatelessWidget {
  const WordFormField({
    super.key,
    required this.controller,
    required this.label,
    required this.hint,
    this.maxLines = 1,
    this.isRequired = false,
    this.errorText,
    this.onChanged,
  });

  final TextEditingController controller;
  final String label;
  final String hint;
  final int maxLines;
  final bool isRequired;
  final String? errorText;
  final ValueChanged<String>? onChanged;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 22),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Text(
                label,
                style: TextStyle(
                  fontFamily: 'Inter',
                  fontSize: 11,
                  fontWeight: FontWeight.w600,
                  letterSpacing: 0.2,
                  color: NyakiColors.ink.withValues(alpha: 0.4),
                ),
              ),
              if (isRequired) ...[
                const SizedBox(width: 3),
                Text(
                  '*',
                  style: TextStyle(
                    fontFamily: 'Inter',
                    fontSize: 11,
                    fontWeight: FontWeight.w600,
                    color: NyakiColors.taupe,
                  ),
                ),
              ],
            ],
          ),
          const SizedBox(height: 2),
          TextField(
            controller: controller,
            maxLines: maxLines,
            onChanged: onChanged,
            style: const TextStyle(
              fontFamily: 'Inter',
              fontSize: 15,
              fontWeight: FontWeight.w500,
              height: 1.4,
              color: NyakiColors.ink,
            ),
            decoration: InputDecoration(
              hintText: hint,
              errorText: errorText,
              isDense: true,
              hintStyle: TextStyle(
                fontFamily: 'Inter',
                fontSize: 14,
                fontWeight: FontWeight.w400,
                color: NyakiColors.ink.withValues(alpha: 0.25),
              ),
              errorStyle: const TextStyle(
                fontFamily: 'Inter',
                fontSize: 11,
              ),
              contentPadding: EdgeInsets.only(
                top: 8,
                bottom: maxLines > 1 ? 10 : 8,
              ),
              border: UnderlineInputBorder(
                borderSide: BorderSide(color: NyakiColors.taupe, width: 1),
              ),
              enabledBorder: UnderlineInputBorder(
                borderSide: BorderSide(
                  color: NyakiColors.taupe.withValues(alpha: 0.55),
                  width: 1,
                ),
              ),
              focusedBorder: const UnderlineInputBorder(
                borderSide: BorderSide(color: NyakiColors.ink, width: 1.4),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
