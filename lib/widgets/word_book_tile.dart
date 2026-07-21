import 'package:flutter/material.dart';

import '../core/theme/nyaki_colors.dart';

class WordBookTile extends StatelessWidget {
  const WordBookTile({
    super.key,
    required this.title,
    required this.meta,
    this.description,
    required this.onTap,
  });

  final String title;
  final String meta;
  final String? description;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 14),
        child: Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      fontFamily: 'Inter',
                      fontSize: 14,
                      fontWeight: FontWeight.w500,
                      color: NyakiColors.ink,
                    ),
                  ),
                  if (description != null && description!.isNotEmpty) ...[
                    const SizedBox(height: 2),
                    Text(
                      description!,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        fontFamily: 'Inter',
                        fontSize: 12,
                        color: NyakiColors.ink.withValues(alpha: 0.4),
                      ),
                    ),
                  ],
                ],
              ),
            ),
            const SizedBox(width: 12),
            Text(
              meta,
              style: TextStyle(
                fontFamily: 'Inter',
                fontSize: 12,
                color: NyakiColors.ink.withValues(alpha: 0.35),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
