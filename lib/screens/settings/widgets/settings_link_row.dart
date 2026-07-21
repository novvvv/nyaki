import 'package:flutter/material.dart';

import '../../../core/theme/nyaki_colors.dart';

class SettingsLinkRow extends StatelessWidget {
  const SettingsLinkRow({
    super.key,
    required this.label,
    this.value,
    this.muted = false,
    this.enabled = true,
    this.onTap,
  });

  final String label;
  final String? value;
  final bool muted;
  final bool enabled;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final valueColor = muted
        ? NyakiColors.ink.withValues(alpha: 0.35)
        : NyakiColors.ink.withValues(alpha: 0.55);

    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: enabled ? onTap : null,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 16),
          child: Row(
            children: [
              Expanded(
                child: Text(
                  label,
                  style: TextStyle(
                    fontFamily: 'Inter',
                    fontSize: 15,
                    fontWeight: FontWeight.w600,
                    color: enabled
                        ? NyakiColors.ink
                        : NyakiColors.ink.withValues(alpha: 0.35),
                  ),
                ),
              ),
              if (value != null && value!.isNotEmpty)
                Text(
                  value!,
                  style: TextStyle(
                    fontFamily: 'Inter',
                    fontSize: 13,
                    fontWeight: FontWeight.w500,
                    color: valueColor,
                  ),
                ),
              const SizedBox(width: 4),
              Icon(
                Icons.chevron_right_rounded,
                size: 20,
                color: NyakiColors.ink.withValues(alpha: 0.28),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
