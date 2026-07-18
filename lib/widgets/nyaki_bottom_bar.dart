import 'package:flutter/material.dart';

import '../core/theme/nyaki_colors.dart';

class NyakiBottomBar extends StatelessWidget {
  const NyakiBottomBar({
    super.key,
    required this.currentIndex,
    required this.onTap,
  });

  final int currentIndex;
  final ValueChanged<int> onTap;

  static const _labels = ['홈', '퀘스트', '단어장', '추가', '테스트', '설정'];

  @override
  Widget build(BuildContext context) {
    return Material(
      color: NyakiColors.cream,
      child: Container(
        decoration: const BoxDecoration(
          border: Border(top: BorderSide(color: NyakiColors.muted)),
        ),
        padding: const EdgeInsets.only(top: 12),
        child: SafeArea(
          top: false,
          child: Padding(
            padding: const EdgeInsets.only(bottom: 20),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceAround,
              children: [
                for (var i = 0; i < _labels.length; i++)
                  _TabItem(
                    label: _labels[i],
                    selected: currentIndex == i,
                    onTap: () => onTap(i),
                  ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _TabItem extends StatelessWidget {
  const _TabItem({
    required this.label,
    required this.selected,
    required this.onTap,
  });

  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final style = TextStyle(
      fontSize: 11,
      fontWeight: selected ? FontWeight.w600 : FontWeight.w500,
      color: NyakiColors.ink.withValues(alpha: selected ? 1 : 0.3),
    );

    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(8),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (selected) ...[
              Container(
                width: 4,
                height: 4,
                decoration: BoxDecoration(
                  color: NyakiColors.ink,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
              const SizedBox(height: 4),
            ] else
              const SizedBox(height: 8),
            Text(label, style: style),
          ],
        ),
      ),
    );
  }
}
