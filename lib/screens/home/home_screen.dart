import 'package:flutter/material.dart';

import '../../core/theme/nyaki_colors.dart';

class HomeScreen extends StatelessWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final width = MediaQuery.sizeOf(context).width;
    final catSize = (width * 0.68).clamp(220.0, 260.0);

    return Center(
      child: SingleChildScrollView(
        padding: const EdgeInsets.symmetric(horizontal: 28, vertical: 24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              '오늘도 천천히, 한 단어씩.',
              style: TextStyle(
                fontFamily: 'Inter',
                fontSize: 14,
                fontWeight: FontWeight.w500,
                color: NyakiColors.ink.withValues(alpha: 0.5),
              ),
            ),
            const SizedBox(height: 14),
            SizedBox(
              width: catSize,
              height: catSize,
              child: Image.asset(
                'assets/images/cat.png',
                fit: BoxFit.contain,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
