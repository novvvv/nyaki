import 'package:flutter/material.dart';

import '../core/theme/nyaki_colors.dart';

class UnderlineTextField extends StatelessWidget {
  const UnderlineTextField({
    super.key,
    required this.label,
    required this.hint,
    this.maxLines = 1,
  });

  final String label;
  final String hint;
  final int maxLines;

  static const _underline = UnderlineInputBorder(
    borderSide: BorderSide(color: NyakiColors.muted),
  );

  @override
  Widget build(BuildContext context) {
    final labelStyle = TextStyle(
      fontFamily: 'Inter',
      letterSpacing: 1,
      fontWeight: FontWeight.w600,
      color: NyakiColors.ink.withValues(alpha: 0.35),
      fontSize: 12,
    );
    final hintStyle = TextStyle(
      fontFamily: 'Inter',
      color: NyakiColors.ink.withValues(alpha: 0.2),
      fontWeight: FontWeight.w400,
      fontSize: 17,
    );
    final inputStyle = const TextStyle(
      fontFamily: 'Inter',
      fontSize: 17,
      color: NyakiColors.ink,
    );

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: labelStyle),
        const SizedBox(height: 10),
        TextField(
          maxLines: maxLines,
          style: inputStyle,
          decoration: InputDecoration(
            hintText: hint,
            hintStyle: hintStyle,
            border: _underline,
            enabledBorder: _underline,
            focusedBorder: _underline,
            contentPadding: const EdgeInsets.only(bottom: 12),
            isDense: true,
          ),
        ),
      ],
    );
  }
}
