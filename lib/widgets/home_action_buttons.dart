import 'package:flutter/material.dart';

import '../core/theme/nyaki_colors.dart';

class HomeActionButtons extends StatelessWidget {
  const HomeActionButtons({super.key});

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: NyakiSpacing.actionHeight,
      child: Row(
        children: [
          Expanded(
            child: _ActionCard(
              label: '단어 복습',
              background: NyakiColors.muted,
              foreground: NyakiColors.ink,
              onTap: () {},
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: _ActionCard(
              label: '단어 시험',
              background: NyakiColors.ink,
              foreground: NyakiColors.cream,
              onTap: () {},
            ),
          ),
        ],
      ),
    );
  }
}

class _ActionCard extends StatelessWidget {
  const _ActionCard({
    required this.label,
    required this.background,
    required this.foreground,
    required this.onTap,
  });

  final String label;
  final Color background;
  final Color foreground;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: background,
      borderRadius: BorderRadius.circular(NyakiSpacing.cardRadius),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(NyakiSpacing.cardRadius),
        child: Center(
          child: Text(
            label,
            style: TextStyle(
              fontFamily: 'Inter',
              fontSize: 16,
              fontWeight: FontWeight.w700,
              color: foreground,
            ),
          ),
        ),
      ),
    );
  }
}
