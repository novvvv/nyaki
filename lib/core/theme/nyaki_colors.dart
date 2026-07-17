import 'package:flutter/material.dart';

/// Pencil `nyangki_vocab.pen` design tokens.
abstract final class NyakiColors {
  /// #FCF9F2 — warm ivory cream background
  static const Color cream = Color(0xFFFCF9F2);

  /// #1D1D1B — primary text / dark surfaces
  static const Color ink = Color(0xFF1D1D1B);

  /// #E7E7DD — dividers, muted buttons
  static const Color muted = Color(0xFFE7E7DD);

  /// #F5F2EB — cards, quest pills
  static const Color cardBg = Color(0xFFF5F2EB);

  /// #CBC5BA — check circles, subtle strokes
  static const Color checkBorder = Color(0xFFCBC5BA);

  /// #D8D3C8 — progress dots (unselected)
  static const Color dotBorder = Color(0xFFD8D3C8);

  static Color inkMuted([double opacity = 0.35]) =>
      ink.withValues(alpha: opacity);
}

abstract final class NyakiSpacing {
  static const double screenHorizontal = 28;
  static const double sectionGap = 16;
  static const double cardRadius = 16;
  static const double actionHeight = 92;
}
