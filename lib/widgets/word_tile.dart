import 'package:flutter/material.dart';

import '../core/theme/nyaki_colors.dart';

// ===================== ✨ WordTitle ✨ ===================== //

class WordTile extends StatelessWidget {
  const WordTile({
    super.key,
    required this.word,
    required this.meaning,
    this.onTap,
  });

  // ✨ Variable ✨ 
  // 

  final String word;
  final String meaning;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              word,
              style: const TextStyle(
                fontFamily: 'Inter',
                fontSize: 14,
                fontWeight: FontWeight.w500,
                color: NyakiColors.ink,
              ),
            ),
            const SizedBox(height: 2),
            Text(
              meaning,
              style: TextStyle(
                fontFamily: 'Inter',
                fontSize: 14,
                color: NyakiColors.ink.withValues(alpha: 0.5),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
