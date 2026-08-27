import 'package:flutter/material.dart';

import '../../core/auth_scope.dart';
import '../../core/progress_scope.dart';
import '../../core/theme/nyaki_colors.dart';
import '../../data/auth/auth_controller.dart';
import '../auth/sign_in_screen.dart';

/// 일일 퀘스트 카드뷰 화면. (진행 로직은 이후)
class QuestScreen extends StatelessWidget {
  const QuestScreen({super.key});

  // GAMIFICATION-PLAN.md 퀘스트 목록. questId가 있는 항목만 Hub에 실제로
  // 구현되어 있음(현재는 pet_cat뿐) — 나머지는 진행 로직 없는 정적 표시.
  //
  // currency: 'churu' | 'capelin' — 아침/저녁 복습(기간제 퀘스트)은
  // GAMIFICATION-PLAN.md "열빙어 — 2번째 재화"에 따라 보상 재화만 열빙어로
  // 표시해둔다(디자인 미리보기). 실제 지급 로직(questId 연결, Hub 반영)은
  // 아직 구현 전 — 나중에 붙인다.
  static const _quests = [
    (
      title: '냐키 쓰다듬기',
      meta: '냐키를 쓰담어주세요!',
      icon: Icons.pets_outlined,
      reward: 5,
      currency: 'churu',
      questId: 'pet_cat',
    ),
    (
      title: '단어 1개 추가하기',
      meta: '단어장에 새 단어 추가',
      icon: Icons.add_circle_outline,
      reward: 5,
      currency: 'churu',
      questId: 'add_word',
    ),
    (
      title: '아침 복습 완료',
      meta: '06:00–14:00',
      icon: Icons.schedule_outlined,
      reward: 1,
      currency: 'capelin',
      questId: null,
    ),
    (
      title: '저녁 복습 완료',
      meta: '18:00–24:00',
      icon: Icons.schedule_outlined,
      reward: 1,
      currency: 'capelin',
      questId: null,
    ),
  ];

  @override
  Widget build(BuildContext context) {
    // 구현된(questId != null) 퀘스트만 분모/분자로 카운트한다.
    final implementedIds = _quests
        .where((quest) => quest.questId != null)
        .map((quest) => quest.questId!)
        .toSet();
    final completedIds = ProgressScope.of(context).snapshot.completedQuestIds;
    final completedCount = completedIds.intersection(implementedIds).length;
    final isLoggedIn = AuthScope.of(context).status == AuthStatus.signedIn;

    return Stack(
      children: [
        ColoredBox(
          color: NyakiColors.cream,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(28, 20, 28, 0),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.end,
                  children: [
                    _CounterPill(
                      label: '$completedCount / ${implementedIds.length}',
                    ),
                  ],
                ),
              ),
              Expanded(
                child: ListView.separated(
                  padding: const EdgeInsets.fromLTRB(28, 16, 28, 24),
                  itemCount: _quests.length,
                  separatorBuilder: (_, __) => const SizedBox(height: 10),
                  itemBuilder: (context, index) {
                    final quest = _quests[index];
                    final isCompleted = quest.questId != null &&
                        completedIds.contains(quest.questId);
                    return _QuestCard(
                      title: quest.title,
                      meta: quest.meta,
                      icon: quest.icon,
                      reward: quest.reward,
                      currency: quest.currency,
                      isImplemented: quest.questId != null,
                      isCompleted: isCompleted,
                    );
                  },
                ),
              ),
            ],
          ),
        ),
        // 비로그인: 리스트 전체(바텀바 제외 — 이 화면 범위 밖)를 반투명
        // 박스로 덮고, 탭하면 로그인 화면으로 이동시킨다.
        if (!isLoggedIn)
          Positioned.fill(
            child: GestureDetector(
              onTap: () => Navigator.of(context).push<void>(
                MaterialPageRoute<void>(builder: (_) => const SignInScreen()),
              ),
              child: Container(
                color: Colors.black.withValues(alpha: 0.55),
                alignment: Alignment.center,
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Image.asset(
                      'assets/images/nyaki_stretching.png',
                      width: 120,
                      height: 120,
                      fit: BoxFit.contain,
                    ),
                    const SizedBox(height: 12),
                    const Text(
                      '로그인 후에 이용 가능하다냥',
                      style: TextStyle(
                        fontFamily: 'Inter',
                        fontSize: 16,
                        fontWeight: FontWeight.w600,
                        color: Colors.white,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
      ],
    );
  }
}

/// 우측 상단 "n / m" 카운터 알약.
class _CounterPill extends StatelessWidget {
  const _CounterPill({required this.label});

  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 11, vertical: 5),
      decoration: BoxDecoration(
        color: NyakiColors.cardBg,
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        label,
        style: const TextStyle(
          fontFamily: 'Inter',
          fontSize: 12.5,
          fontWeight: FontWeight.w600,
          color: NyakiColors.ink,
        ),
      ),
    );
  }
}

class _QuestCard extends StatelessWidget {
  const _QuestCard({
    required this.title,
    required this.meta,
    required this.icon,
    required this.reward,
    required this.currency,
    required this.isImplemented,
    required this.isCompleted,
  });

  final String title;
  final String meta;
  final IconData icon;
  final int reward;

  /// 'churu' | 'capelin' — 보상 재화. GAMIFICATION-PLAN.md "열빙어" 참고.
  final String currency;
  final bool isImplemented;
  final bool isCompleted;

  @override
  Widget build(BuildContext context) {
    return Opacity(
      opacity: isImplemented ? 1 : 0.55,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 15),
        decoration: BoxDecoration(
          color: NyakiColors.cardBg,
          borderRadius: BorderRadius.circular(22),
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _CheckCircle(done: isCompleted),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: TextStyle(
                      fontFamily: 'Inter',
                      fontSize: 14.5,
                      fontWeight: FontWeight.w600,
                      color: isCompleted
                          ? NyakiColors.ink.withValues(alpha: 0.6)
                          : NyakiColors.ink,
                      decoration:
                          isCompleted ? TextDecoration.lineThrough : null,
                      decorationColor: NyakiColors.taupe,
                    ),
                  ),
                  const SizedBox(height: 6),
                  Row(
                    children: [
                      Icon(
                        icon,
                        size: 13,
                        color: NyakiColors.ink.withValues(alpha: 0.45),
                      ),
                      const SizedBox(width: 6),
                      Text(
                        meta,
                        style: TextStyle(
                          fontFamily: 'Inter',
                          fontSize: 12,
                          color: NyakiColors.ink.withValues(alpha: 0.45),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
            const SizedBox(width: 8),
            // 열빙어(capelin) 퀘스트는 아직 미구현이어도 보상 재화 미리보기를
            // 보여준다 — 나머지(구현 전 츄르 퀘스트)는 기존대로 '준비중'.
            (isImplemented || currency == 'capelin')
                ? Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Image.asset(
                        currency == 'capelin'
                            ? 'assets/images/fish_item.png'
                            : 'assets/images/churu.png',
                        width: 13,
                        height: 13,
                      ),
                      const SizedBox(width: 4),
                      Text(
                        currency == 'capelin'
                            ? '열빙어 $reward개'
                            : '츄르 $reward개',
                        style: TextStyle(
                          fontFamily: 'Inter',
                          fontSize: 11.5,
                          fontWeight: FontWeight.w600,
                          color: NyakiColors.ink.withValues(alpha: 0.7),
                        ),
                      ),
                    ],
                  )
                : Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 7,
                      vertical: 3,
                    ),
                    decoration: BoxDecoration(
                      color: NyakiColors.softDune,
                      borderRadius: BorderRadius.circular(999),
                    ),
                    child: Text(
                      '준비중',
                      style: TextStyle(
                        fontFamily: 'Inter',
                        fontSize: 10,
                        fontWeight: FontWeight.w600,
                        color: NyakiColors.ink.withValues(alpha: 0.45),
                      ),
                    ),
                  ),
          ],
        ),
      ),
    );
  }
}

class _CheckCircle extends StatelessWidget {
  const _CheckCircle({required this.done});

  final bool done;

  @override
  Widget build(BuildContext context) {
    if (!done) {
      return Container(
        width: 21,
        height: 21,
        margin: const EdgeInsets.only(top: 2),
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          border: Border.all(color: NyakiColors.taupe, width: 1.4),
        ),
      );
    }
    return Container(
      width: 21,
      height: 21,
      margin: const EdgeInsets.only(top: 2),
      decoration: const BoxDecoration(
        shape: BoxShape.circle,
        color: NyakiColors.ink,
      ),
      child: const Icon(Icons.check, size: 13, color: NyakiColors.cream),
    );
  }
}
