import 'package:flutter/material.dart';

import '../core/theme/nyaki_colors.dart';

class WordTile extends StatelessWidget {
  const WordTile({
    super.key,
    required this.word,
    required this.meaning,
    this.isMemorized = false,
    this.onTap,
  });

  final String word;
  final String meaning;
  final bool isMemorized;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 14),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(
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
            const SizedBox(width: 12),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
              decoration: BoxDecoration(
                color: NyakiColors.ink.withValues(alpha: 0.04),
                borderRadius: BorderRadius.circular(6),
              ),
              child: Text(
                isMemorized ? '암기' : '미암기',
                style: TextStyle(
                  fontFamily: 'Inter',
                  fontSize: 11,
                  fontWeight: FontWeight.w500,
                  color: NyakiColors.ink.withValues(alpha: 0.5),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
