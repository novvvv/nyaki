import 'package:flutter/material.dart';

import '../core/theme/nyaki_colors.dart';
import '../data/mock_vocab_data.dart';

class WordAddChartCard extends StatelessWidget {
  const WordAddChartCard({super.key});

  static const _barHeights = [16.0, 24.0, 18.0, 28.0, 32.0, 36.0, 40.0];
  static const _barOpacities = [0.10, 0.12, 0.10, 0.15, 0.16, 0.18, 1.0];

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(
          '단어 추가',
          style: TextStyle(
            fontFamily: 'Inter',
            fontSize: 13,
            fontWeight: FontWeight.w600,
            color: NyakiColors.ink.withValues(alpha: 0.45),
          ),
        ),
        const SizedBox(height: 8),
        Expanded(
          child: Container(
            padding: const EdgeInsets.fromLTRB(18, 16, 18, 14),
            decoration: BoxDecoration(
              color: NyakiColors.cardBg,
              borderRadius: BorderRadius.circular(NyakiSpacing.cardRadius),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text(
                  '최근 7일 추이',
                  style: TextStyle(
                    fontFamily: 'Inter',
                    fontSize: 11,
                    fontWeight: FontWeight.w500,
                    color: NyakiColors.ink.withValues(alpha: 0.35),
                  ),
                ),
                const SizedBox(height: 12),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      '오늘 ${MockVocabData.todayAddCount}개 추가',
                      style: const TextStyle(
                        fontFamily: 'Inter',
                        fontSize: 16,
                        fontWeight: FontWeight.w700,
                        color: NyakiColors.ink,
                      ),
                    ),
                    Text(
                      '이번 주 ${MockVocabData.weekAddCount}개',
                      style: TextStyle(
                        fontFamily: 'Inter',
                        fontSize: 12,
                        fontWeight: FontWeight.w500,
                        color: NyakiColors.ink.withValues(alpha: 0.4),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                Expanded(
                  child: Align(
                    alignment: Alignment.bottomCenter,
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.end,
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        for (var i = 0; i < _barHeights.length; i++)
                          Container(
                            width: 12,
                            height: _barHeights[i],
                            decoration: BoxDecoration(
                              color: NyakiColors.ink.withValues(
                                alpha: _barOpacities[i],
                              ),
                              borderRadius: BorderRadius.circular(4),
                            ),
                          ),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 8),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    for (var i = 0; i < MockVocabData.dayLabels.length; i++)
                      Text(
                        MockVocabData.dayLabels[i],
                        style: TextStyle(
                          fontFamily: 'Inter',
                          fontSize: 10,
                          fontWeight: i == MockVocabData.dayLabels.length - 1
                              ? FontWeight.w700
                              : FontWeight.w500,
                          color: NyakiColors.ink.withValues(
                            alpha: i == MockVocabData.dayLabels.length - 1
                                ? 0.8
                                : 0.25 + (i * 0.03),
                          ),
                        ),
                      ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }
}
