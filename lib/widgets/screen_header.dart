import 'package:flutter/material.dart';

import '../core/theme/nyaki_colors.dart';

class ScreenHeader extends StatelessWidget {
  const ScreenHeader({
    super.key,
    required this.title,
    this.trailing,
    this.padding = const EdgeInsets.fromLTRB(28, 16, 28, 20),
  });

  final String title;
  final Widget? trailing;
  final EdgeInsets padding;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: padding,
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.baseline,
        textBaseline: TextBaseline.alphabetic,
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            title,
            style: const TextStyle(
              fontFamily: 'Inter',
              fontSize: 26,
              fontWeight: FontWeight.w700,
              color: NyakiColors.ink,
            ),
          ),
          if (trailing != null) trailing!,
        ],
      ),
    );
  }
}

class ScreenHeaderCount extends StatelessWidget {
  const ScreenHeaderCount({super.key, required this.count});

  final int count;

  @override
  Widget build(BuildContext context) {
    return Text(
      '$count개',
      style: TextStyle(
        fontFamily: 'Inter',
        fontSize: 14,
        fontWeight: FontWeight.w400,
        color: NyakiColors.ink.withValues(alpha: 0.35),
      ),
    );
  }
}

class CatnipBadge extends StatelessWidget {
  const CatnipBadge({super.key});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      decoration: BoxDecoration(
        color: NyakiColors.muted,
        borderRadius: BorderRadius.circular(14),
      ),
      child: const Text(
        '+1 🌿',
        style: TextStyle(
          fontFamily: 'Inter',
          fontSize: 13,
          fontWeight: FontWeight.w500,
          color: NyakiColors.ink,
        ),
      ),
    );
  }
}
