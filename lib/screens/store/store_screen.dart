import 'package:flutter/material.dart';

import '../../core/progress_scope.dart';
import '../../core/theme/nyaki_colors.dart';

/// 상점 화면. (2026-08-28) UI 레이아웃만 먼저 잡아본 상태 — 카탈로그가
/// 아직 확정 전이라(TODO.md 참고) 아래 샘플 데이터는 전부 자리표시자이고,
/// 구매 버튼도 실제 차감 로직 없이 UI만 있다. 카테고리별 특수 레이아웃
/// (스와치 줄, 미리보기 카드) 대신 단순한 그리드 하나로 통일.
class StoreScreen extends StatelessWidget {
  const StoreScreen({super.key});

  // ===== v1 카탈로그 후보 (가격은 자리표시자, 아직 확정 아님) ===== //
  static const _sampleItems = [
    (
      name: '단어장 색상 변경권',
      price: 20,
      icon: Icons.menu_book_outlined,
      locked: false,
    ),
    (
      name: '스트릭 프리즈',
      price: 100,
      icon: Icons.ac_unit_outlined,
      // streak_count 시스템 자체가 아직 없어서(GAMIFICATION-PLAN.md 참고)
      // 지켜줄 streak가 없음 — 구현 전까지 잠금 상태로만 노출.
      locked: true,
    ),
  ];
  // ============================================================= //

  @override
  Widget build(BuildContext context) {
    final churuBalance = ProgressScope.of(context).snapshot.churuBalance;
    // TODO: 열빙어 잔액은 아직 ProgressSnapshot에 없음(백엔드 미구현) —
    // 레이아웃 확인용 자리표시자로 0 고정.
    const capelinBalance = 0;

    return ColoredBox(
      color: NyakiColors.cream,
      child: SafeArea(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            _Header(
              churuBalance: churuBalance,
              capelinBalance: capelinBalance,
            ),
            Expanded(
              child: GridView.builder(
                padding: const EdgeInsets.fromLTRB(20, 12, 20, 32),
                itemCount: _sampleItems.length,
                gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                  crossAxisCount: 2,
                  mainAxisSpacing: 10,
                  crossAxisSpacing: 10,
                  childAspectRatio: 1.15,
                ),
                itemBuilder: (context, index) =>
                    _ItemCard(item: _sampleItems[index]),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// 뒤로가기 + 잔액(츄르/열빙어) 두 개.
class _Header extends StatelessWidget {
  const _Header({required this.churuBalance, required this.capelinBalance});

  final int churuBalance;
  final int capelinBalance;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 16, 20, 8),
      child: Row(
        children: [
          GestureDetector(
            onTap: () => Navigator.of(context).pop(),
            child: Container(
              width: 34,
              height: 34,
              decoration: const BoxDecoration(
                color: NyakiColors.cardBg,
                shape: BoxShape.circle,
              ),
              alignment: Alignment.center,
              child: const Icon(
                Icons.arrow_back_ios_new_rounded,
                size: 15,
                color: NyakiColors.ink,
              ),
            ),
          ),
          const Spacer(),
          _BalancePill(
            assetPath: 'assets/images/churu.png',
            balance: churuBalance,
          ),
          const SizedBox(width: 8),
          _BalancePill(
            assetPath: 'assets/images/fish_item.png',
            balance: capelinBalance,
          ),
        ],
      ),
    );
  }
}

class _BalancePill extends StatelessWidget {
  const _BalancePill({required this.assetPath, required this.balance});

  final String assetPath;
  final int balance;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.fromLTRB(9, 6, 12, 6),
      decoration: BoxDecoration(
        color: NyakiColors.cardBg,
        borderRadius: BorderRadius.circular(999),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Image.asset(assetPath, width: 18, height: 18),
          const SizedBox(width: 5),
          Text(
            '$balance',
            style: const TextStyle(
              fontFamily: 'Inter',
              fontSize: 14,
              fontWeight: FontWeight.w600,
              color: NyakiColors.ink,
            ),
          ),
        ],
      ),
    );
  }
}

class _ItemCard extends StatelessWidget {
  const _ItemCard({required this.item});

  final ({String name, int price, IconData icon, bool locked}) item;

  @override
  Widget build(BuildContext context) {
    return Opacity(
      opacity: item.locked ? 0.55 : 1,
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: NyakiColors.cardBg,
          borderRadius: BorderRadius.circular(18),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(
              item.locked ? Icons.lock_outline_rounded : item.icon,
              size: 26,
              color: NyakiColors.ink,
            ),
            const Spacer(),
            Text(
              item.name,
              style: const TextStyle(
                fontFamily: 'Inter',
                fontSize: 13.5,
                fontWeight: FontWeight.w600,
                color: NyakiColors.ink,
              ),
            ),
            const SizedBox(height: 6),
            if (item.locked)
              Text(
                '곧 열려요',
                style: TextStyle(
                  fontFamily: 'Inter',
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                  color: NyakiColors.inkMuted(0.6),
                ),
              )
            else
              Row(
                children: [
                  Image.asset(
                    'assets/images/churu.png',
                    width: 13,
                    height: 13,
                  ),
                  const SizedBox(width: 4),
                  Text(
                    '${item.price}',
                    style: const TextStyle(
                      fontFamily: 'Inter',
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                      color: NyakiColors.ink,
                    ),
                  ),
                  const Spacer(),
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 10,
                      vertical: 5,
                    ),
                    decoration: BoxDecoration(
                      color: NyakiColors.ink,
                      borderRadius: BorderRadius.circular(999),
                    ),
                    child: const Text(
                      '구매',
                      style: TextStyle(
                        fontFamily: 'Inter',
                        fontSize: 11,
                        fontWeight: FontWeight.w600,
                        color: NyakiColors.cardBg,
                      ),
                    ),
                  ),
                ],
              ),
          ],
        ),
      ),
    );
  }
}
