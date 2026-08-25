import 'dart:math';

import 'package:flutter/material.dart';

import '../../core/auth_scope.dart';
import '../../core/progress_scope.dart';
import '../../data/auth/auth_controller.dart';

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

    return Center(
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
