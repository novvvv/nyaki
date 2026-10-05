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

  // 탭별 아이콘은 준비된 것부터 하나씩 채운다 (지금은 홈만).
  // 아이콘 없는 탭은 기존처럼 점(dot) + 라벨 그대로 유지.
  static const _tabs = [
    (label: '홈', icon: 'assets/icon/home.png', iconSelected: 'assets/icon/home_clicked.png'),
    (label: '퀘스트', icon: 'assets/icon/quest.png', iconSelected: 'assets/icon/quest_clicked.png'),
    (label: '단어장', icon: 'assets/icon/book.png', iconSelected: 'assets/icon/book_clicked.png'),
    (label: '테스트', icon: 'assets/icon/test.png', iconSelected: 'assets/icon/test_clicked.png'),
    (label: '설정', icon: 'assets/icon/profile.png', iconSelected: 'assets/icon/profile_clicked.png'),
  ];

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
                for (var i = 0; i < _tabs.length; i++)
                  _TabItem(
                    key: ValueKey('nyakiBottomBar_${_tabs[i].label}'),
                    label: _tabs[i].label,
                    iconAsset: _tabs[i].icon,
                    selectedIconAsset: _tabs[i].iconSelected,
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
    super.key,
    required this.label,
    required this.selected,
    required this.onTap,
    this.iconAsset,
    this.selectedIconAsset,
  });

  final String label;
  final bool selected;
  final VoidCallback onTap;

  /// 둘 다 있어야 아이콘을 씀. 하나라도 없으면 기존 점(dot) 표시로 폴백.
  final String? iconAsset;
  final String? selectedIconAsset;

  @override
  Widget build(BuildContext context) {
    final hasIcon = iconAsset != null && selectedIconAsset != null;

    // 아이콘이 다 갖춰져서 보조 라벨 텍스트는 시각적으로 안 보여줌.
    // 스크린리더용으로만 label을 남겨둠(Semantics).
    return Semantics(
      label: label,
      button: true,
      selected: selected,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(8),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
          child: hasIcon
              ? Image.asset(
                  selected ? selectedIconAsset! : iconAsset!,
                  width: 22,
                  height: 22,
                )
              : Container(
                  width: 4,
                  height: 4,
                  decoration: BoxDecoration(
                    color: selected
                        ? NyakiColors.ink
                        : Colors.transparent,
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
        ),
      ),
    );
  }
}
