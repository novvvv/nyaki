import 'package:flutter/material.dart';

import '../core/theme/nyaki_colors.dart';

class WordBookTile extends StatelessWidget {
  const WordBookTile({
    super.key,
    required this.title,
    required this.meta,
    required this.onTap,
  });

  final String title;
  final String meta;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: NyakiColors.cream,
      shape: RoundedRectangleBorder(
        side: BorderSide(
          color: NyakiColors.ink.withValues(alpha: 0.14),
          width: 1.1,
        ),
        borderRadius: BorderRadius.circular(12),
      ),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 17),
          child: Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      style: const TextStyle(
                        fontFamily: 'Inter',
                        fontSize: 16,
                        fontWeight: FontWeight.w600,
                        color: NyakiColors.ink,
                      ),
                    ),
                    const SizedBox(height: 5),
                    Text(
                      meta,
                      style: TextStyle(
                        fontFamily: 'Inter',
                        fontSize: 12,
                        fontWeight: FontWeight.w400,
                        color: NyakiColors.ink.withValues(alpha: 0.45),
                      ),
                    ),
                  ],
                ),
              ),
              Icon(
                Icons.chevron_right_rounded,
                size: 21,
                color: NyakiColors.ink.withValues(alpha: 0.32),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
