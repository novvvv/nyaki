import 'dart:math';

import 'package:flutter/material.dart';

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
    // TODO(게이미피케이션 2단계): 퀘스트5 "냥키 쓰다듬기" 완료 처리 훅.
    // 퀘스트/streak 로직(UserProgress·QuestCompletion)이 아직 없어서 지금은 이미지 전환만 함.
  }
}
