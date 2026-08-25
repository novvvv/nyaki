import 'package:flutter/material.dart';

import '../../core/auth_scope.dart';
import '../../core/progress_scope.dart';
import '../../core/theme/nyaki_colors.dart';
import '../../data/auth/auth_controller.dart';

/// 일일 퀘스트 정적 화면. (진행 로직은 이후)
class QuestScreen extends StatelessWidget {
  const QuestScreen({super.key});

  // GAMIFICATION-PLAN.md 퀘스트 목록. questId가 있는 항목만 Hub에 실제로
  // 구현되어 있음(현재는 pet_cat뿐) — 나머지는 진행 로직 없는 정적 표시.
  static const _quests = [
    (title: '단어 시험 테스트 누르기', subtitle: '5츄르', questId: null),
    (title: '아침 복습 완료', subtitle: '06:00–14:00 · 5츄르', questId: null),
    (title: '저녁 복습 완료', subtitle: '18:00–24:00 · 5츄르', questId: null),
    (title: '단어 1개 추가하기', subtitle: '5츄르', questId: null),
    (title: '냥키 쓰다듬기', subtitle: '5츄르', questId: 'pet_cat'),
  ];

  @override
  Widget build(BuildContext context) {
    const dividerColor = NyakiColors.softDune;

    // 구현된(questId != null) 퀘스트만 분모/분자로 카운트한다.
    final implementedIds = _quests
        .where((quest) => quest.questId != null)
        .map((quest) => quest.questId!)
        .toSet();
    final completedIds = ProgressScope.of(context).snapshot.completedQuestIds;
    final completedCount = completedIds.intersection(implementedIds).length;
    final isLoggedIn = AuthScope.of(context).status == AuthStatus.signedIn;

    return ColoredBox(
      color: NyakiColors.cream,
      child: Column(
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
                  '$completedCount / ${implementedIds.length}',
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
                final isCompleted =
                    quest.questId != null && completedIds.contains(quest.questId);
                return _QuestRow(
                  title: quest.title,
                  subtitle: quest.subtitle,
                  isLoggedIn: isLoggedIn,
                  isCompleted: isCompleted,
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}

class _QuestRow extends StatelessWidget {
  const _QuestRow({
    required this.title,
    required this.subtitle,
    required this.isLoggedIn,
    required this.isCompleted,
  });

  final String title;
  final String subtitle;
  final bool isLoggedIn;
  final bool isCompleted;

  void _showLoginRequiredDialog(BuildContext context) {
    showDialog<void>(
      context: context,
      builder: (context) => AlertDialog(
        content: const Text('로그인 후 이용 가능해요!'),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(),
            child: const Text('닫기'),
          ),
        ],
      ),
    );
  }

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
          if (!isLoggedIn)
            GestureDetector(
              onTap: () => _showLoginRequiredDialog(context),
              child: const Icon(
                Icons.lock_outline,
                size: 18,
                color: NyakiColors.taupe,
              ),
            )
          else if (isCompleted)
            const Icon(
              Icons.check_circle,
              size: 18,
              color: NyakiColors.taupe,
            )
          else
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
