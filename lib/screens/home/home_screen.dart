import 'dart:math';

import 'package:flutter/material.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  static const _catAssets = [
    'assets/images/nyaki_sleeping.png',
    'assets/images/nyaki_grooming.png',
    'assets/images/nyaki_stretching.png',
  ];

  late final String _catAsset =
      _catAssets[Random().nextInt(_catAssets.length)];

  @override
  Widget build(BuildContext context) {
    final width = MediaQuery.sizeOf(context).width;
    final catSize = (width * 0.68).clamp(220.0, 260.0);

    return Center(
      child: SizedBox(
        width: catSize,
        height: catSize,
        child: Image.asset(
          _catAsset,
          fit: BoxFit.contain,
        ),
      ),
    );
  }
}
