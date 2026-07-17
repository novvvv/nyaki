import 'package:flutter/material.dart';

import '../core/theme/nyaki_colors.dart';
import '../data/mock_vocab_data.dart';

class HomeDateSection extends StatelessWidget {
  const HomeDateSection({super.key});

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Text(
          MockVocabData.selectedMonthLabel,
          style: const TextStyle(
            fontFamily: 'Inter',
            fontSize: 15,
            fontWeight: FontWeight.w600,
            color: NyakiColors.ink,
            height: 1.2,
          ).copyWith(color: NyakiColors.ink.withValues(alpha: 0.75)),
        ),
        const SizedBox(height: 10),
        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            for (var i = 0; i < MockVocabData.scrollDates.length; i++) ...[
              if (i > 0) const SizedBox(width: 12),
              _DateChip(day: MockVocabData.scrollDates[i]),
            ],
          ],
        ),
      ],
    );
  }
}

class _DateChip extends StatelessWidget {
  const _DateChip({required this.day});

  final int day;

  @override
  Widget build(BuildContext context) {
    final selected = day == MockVocabData.selectedDate;

    if (selected) {
      return Container(
        width: 28,
        height: 28,
        alignment: Alignment.center,
        decoration: const BoxDecoration(
          color: NyakiColors.ink,
          shape: BoxShape.circle,
        ),
        child: Text(
          '$day',
          style: const TextStyle(
            fontFamily: 'Inter',
            fontSize: 13,
            fontWeight: FontWeight.w600,
            color: NyakiColors.cream,
          ),
        ),
      );
    }

    return SizedBox(
      width: 28,
      height: 28,
      child: Center(
        child: Text(
          '$day',
          style: TextStyle(
            fontFamily: 'Inter',
            fontSize: 13,
            fontWeight: FontWeight.w500,
            color: NyakiColors.ink.withValues(alpha: 0.35),
          ),
        ),
      ),
    );
  }
}
