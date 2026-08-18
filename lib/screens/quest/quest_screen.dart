import 'package:flutter/material.dart';

import '../../core/theme/nyaki_colors.dart';

/// 일일 퀘스트 정적 화면. (진행 로직은 이후)
class QuestScreen extends StatelessWidget {
  const QuestScreen({super.key});

  // GAMIFICATION-PLAN.md 퀘스트 목록. 진행 로직·보상 지급은 아직 없음(하드코딩).
  static const _quests = [
    (title: '단어 시험 테스트 누르기', subtitle: '5츄르'),
    (title: '아침 복습 완료', subtitle: '06:00–14:00 · 5츄르'),
    (title: '저녁 복습 완료', subtitle: '18:00–24:00 · 5츄르'),
    (title: '단어 1개 추가하기', subtitle: '5츄르'),
    (title: '냥키 쓰다듬기', subtitle: '5츄르'),
  ];

  @override
  Widget build(BuildContext context) {
    const dividerColor = NyakiColors.softDune;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(28, 20, 28, 0),
          child: Row(
            children: [
              const Expanded(
                child: Text(
                  'Daily Quest',
                  style: TextStyle(
                    fontFamily: 'Inter',
                    fontSize: 24,
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
              final quest = _quests[index];
              return _QuestRow(title: quest.title, subtitle: quest.subtitle);
            },
          ),
        ),
      ],
    );
  }
}

class _QuestRow extends StatelessWidget {
  const _QuestRow({required this.title, required this.subtitle});

  final String title;
  final String subtitle;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 16),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: const TextStyle(
                    fontFamily: 'Inter',
                    fontSize: 14,
                    fontWeight: FontWeight.w500,
                    color: NyakiColors.ink,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  subtitle,
                  style: TextStyle(
                    fontFamily: 'Inter',
                    fontSize: 12,
                    color: NyakiColors.ink.withValues(alpha: 0.4),
                  ),
                ),
              ],
            ),
          ),
          Container(
            width: 18,
            height: 18,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              border: Border.all(
                color: NyakiColors.taupe,
                width: 1.2,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
