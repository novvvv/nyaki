import 'dart:math';

import 'package:flutter/material.dart';

import '../../core/auth_scope.dart';
import '../../core/progress_scope.dart';
import '../../core/theme/nyaki_colors.dart';
import '../../data/auth/auth_controller.dart';
import '../auth/sign_in_screen.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

/// [assets] 중에서 무작위로 하나를 고른다. [excluding]을 넘기면 그 값은
/// 다른 후보가 있는 한 제외한다(연속으로 같은 이미지가 나오는 것 방지).
String _pickCatAsset(
  List<String> assets, {
  String? excluding,
  Random? random,
}) {
  final candidates = excluding == null
      ? assets
      : assets.where((asset) => asset != excluding).toList();
  final pool = candidates.isEmpty ? assets : candidates;
  return pool[(random ?? Random()).nextInt(pool.length)];
}

class _HomeScreenState extends State<HomeScreen> {
  static const _catAssets = [
    'assets/images/nyaki_sleeping.png',
    'assets/images/nyaki_grooming.png',
    'assets/images/nyaki_stretching.png',
  ];

  late String _catAsset;

  @override
  void initState() {
    super.initState();
    _catAsset = _pickCatAsset(_catAssets);
  }

  @override
  Widget build(BuildContext context) {
    final width = MediaQuery.sizeOf(context).width;
    final catSize = (width * 0.68).clamp(220.0, 260.0);
    final isLoggedIn = AuthScope.of(context).status == AuthStatus.signedIn;
    final churuBalance = ProgressScope.of(context).snapshot.churuBalance;

    return Stack(
      children: [
        Center(
          child: GestureDetector(
            onTap: _handleCatTap,
            child: SizedBox(
              width: catSize,
              height: catSize,
              child: Image.asset(
                _catAsset,
                fit: BoxFit.contain,
              ),
            ),
          ),
        ),
        // 비로그인이어도 배지는 그대로 보여준다(0으로 표시) — 로그인 동기부여.
        // 탭하면 비로그인일 때만 로그인 화면으로 이동.
        Positioned(
          top: 16,
          right: 20,
          child: GestureDetector(
            onTap: isLoggedIn
                ? null
                : () => Navigator.of(context).push<void>(
                      MaterialPageRoute<void>(
                        builder: (_) => const SignInScreen(),
                      ),
                    ),
            child: Container(
              padding: const EdgeInsets.fromLTRB(10, 7, 15, 7),
              decoration: BoxDecoration(
                color: NyakiColors.cardBg,
                borderRadius: BorderRadius.circular(999),
                boxShadow: [
                  BoxShadow(
                    color: NyakiColors.ink.withValues(alpha: 0.05),
                    blurRadius: 8,
                    offset: const Offset(0, 2),
                  ),
                ],
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Image.asset(
                    'assets/images/churu.png',
                    width: 24,
                    height: 24,
                  ),
                  const SizedBox(width: 7),
                  Text(
                    '$churuBalance',
                    style: const TextStyle(
                      fontFamily: 'Inter',
                      fontSize: 17,
                      fontWeight: FontWeight.w600,
                      letterSpacing: -0.2,
                      color: NyakiColors.ink,
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

  void _handleCatTap() {
    setState(() {
      _catAsset = _pickCatAsset(_catAssets, excluding: _catAsset);
    });

    // 이미지 전환은 로그인 여부와 무관하게 항상 동작. 퀘스트 완료 알림만
    // 로그인 상태일 때 시도한다 — 실패해도 completeQuest()가 조용히
    // 캐시값으로 폴백하므로 여기서 결과를 기다리지 않는다.
    if (AuthScope.of(context).status == AuthStatus.signedIn) {
      ProgressScope.of(context).completeQuest('pet_cat');
    }
  }
}
