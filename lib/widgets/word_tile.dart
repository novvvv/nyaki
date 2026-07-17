import 'package:flutter/material.dart';

import '../core/theme/nyaki_colors.dart';

class WordTile extends StatelessWidget {
  const WordTile({
    super.key,
    required this.word,
    required this.meaning,
    this.isMemorized = false,
  });

  final String word;
  final String meaning;
  final bool isMemorized;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 15),
      decoration: BoxDecoration(
        color: NyakiColors.cream,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(
          color: NyakiColors.ink.withValues(alpha: 0.13),
          width: 1.1,
        ),
      ),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  word,
                  style: const TextStyle(
                    fontFamily: 'Inter',
                    fontSize: 16,
                    fontWeight: FontWeight.w700,
                    color: NyakiColors.ink,
                  ),
                ),
                const SizedBox(height: 6),
                Text(
                  meaning,
                  style: TextStyle(
                    fontFamily: 'Inter',
                    fontSize: 13,
                    fontWeight: FontWeight.w400,
                    color: NyakiColors.ink.withValues(alpha: 0.5),
                  ),
                ),
              ],
            ),
          ),
          Text(
            isMemorized ? '암기' : '미암기',
            style: TextStyle(
              fontFamily: 'Inter',
              fontSize: 11,
              fontWeight: FontWeight.w600,
              color:
                  NyakiColors.ink.withValues(alpha: isMemorized ? 0.7 : 0.35),
            ),
          ),
        ],
      ),
    );
  }
}
