import 'package:flutter/material.dart';

import '../../core/theme/nyaki_colors.dart';

/// 일일 퀘스트 정적 화면. (진행 로직은 이후)
class QuestScreen extends StatelessWidget {
  const QuestScreen({super.key});

  static const _quests = [
    '냥키 쓰다듬기',
    '단어 추가하기',
    '단어 시험 보기',
  ];

  @override
  Widget build(BuildContext context) {
    final dividerColor = NyakiColors.ink.withValues(alpha: 0.06);

    return Scaffold(
      backgroundColor: NyakiColors.cream,
      body: SafeArea(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 8, 28, 0),
              child: Row(
                children: [
                  IconButton(
                    onPressed: () => Navigator.of(context).pop(),
                    icon: const Icon(Icons.arrow_back_ios_new_rounded),
                    iconSize: 18,
                    color: NyakiColors.ink.withValues(alpha: 0.5),
                    tooltip: '뒤로',
                  ),
                  const Expanded(
                    child: Text(
                      'Daily Quest',
                      style: TextStyle(
                        fontFamily: 'Inter',
                        fontSize: 22,
                        fontWeight: FontWeight.w600,
                        letterSpacing: -0.3,
                        color: NyakiColors.ink,
                      ),
                    ),
                  ),
                  Text(
                    '0 / ${_quests.length}',
                    style: TextStyle(
                      fontFamily: 'Inter',
                      fontSize: 13,
                      color: NyakiColors.ink.withValues(alpha: 0.35),
                    ),
                  ),
                ],
              ),
            ),
            Expanded(
              child: ListView.separated(
                padding: const EdgeInsets.fromLTRB(28, 16, 28, 24),
                itemCount: _quests.length,
                separatorBuilder: (_, __) => Divider(
                  height: 1,
                  thickness: 1,
                  color: dividerColor,
                ),
                itemBuilder: (context, index) {
                  return _QuestRow(title: _quests[index]);
                },
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _QuestRow extends StatelessWidget {
  const _QuestRow({required this.title});

  final String title;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 16),
      child: Row(
        children: [
          Expanded(
            child: Text(
              title,
              style: const TextStyle(
                fontFamily: 'Inter',
                fontSize: 14,
                fontWeight: FontWeight.w500,
                color: NyakiColors.ink,
              ),
            ),
          ),
          Container(
            width: 18,
            height: 18,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              border: Border.all(
                color: NyakiColors.ink.withValues(alpha: 0.18),
                width: 1.2,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
