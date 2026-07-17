import 'package:flutter/material.dart';

import '../core/theme/nyaki_colors.dart';
import '../widgets/screen_header.dart';

class QuestScreen extends StatelessWidget {
  const QuestScreen({super.key});

  static const _quests = [
    '냥키 쓰다듬기',
    '단어 추가하기',
    '단어 시험 보기',
  ];

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        ScreenHeader(
          title: 'Daily Quest',
          trailing: Text(
            '0/3',
            style: TextStyle(
              fontFamily: 'Inter',
              fontSize: 14,
              fontWeight: FontWeight.w400,
              color: NyakiColors.ink.withValues(alpha: 0.35),
            ),
          ),
        ),
        Expanded(
          child: ListView.separated(
            padding: const EdgeInsets.fromLTRB(28, 0, 28, 24),
            itemCount: _quests.length,
            separatorBuilder: (_, __) => const SizedBox(height: 10),
            itemBuilder: (context, index) {
              return _QuestPill(title: _quests[index]);
            },
          ),
        ),
      ],
    );
  }
}

class _QuestPill extends StatelessWidget {
  const _QuestPill({required this.title});

  final String title;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.fromLTRB(16, 13, 16, 13),
      decoration: BoxDecoration(
        color: NyakiColors.cardBg,
        borderRadius: BorderRadius.circular(14),
      ),
      child: Row(
        children: [
          Expanded(
            child: Text(
              title,
              style: TextStyle(
                fontFamily: 'Inter',
                fontSize: 14,
                fontWeight: FontWeight.w500,
                color: NyakiColors.ink.withValues(alpha: 0.82),
              ),
            ),
          ),
          Container(
            width: 18,
            height: 18,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              border: Border.all(color: NyakiColors.checkBorder, width: 1.5),
            ),
          ),
        ],
      ),
    );
  }
}
