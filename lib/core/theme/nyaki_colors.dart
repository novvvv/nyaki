import 'package:flutter/material.dart';

/// Nyaki design tokens — see [Design.md](../../../docs/Design.md).
abstract final class NyakiColors {
  /// Vanilla #F8F4EE — page / scaffold background
  static const Color cream = Color(0xFFF8F4EE);

  /// Black #252525 — primary text / filled controls
  static const Color ink = Color(0xFF252525);

  /// Umber #443A35 — warm dark accent / secondary emphasis
  static const Color umber = Color(0xFF443A35);

  /// Soft Dune #E4DDCC — subtle surfaces, soft dividers
  static const Color softDune = Color(0xFFE4DDCC);

  /// Classic Taupe #C5B49D — borders, chips, unselected strokes
  static const Color taupe = Color(0xFFC5B49D);

  /// Alias: muted surfaces (Soft Dune)
  static const Color muted = softDune;

  /// Alias: card / elevated cream-tint on Soft Dune blend
  static const Color cardBg = Color(0xFFF3EEE6);

  /// Alias: check / stroke (Classic Taupe)
  static const Color checkBorder = taupe;

  /// Alias: progress dots
  static const Color dotBorder = taupe;

  static Color inkMuted([double opacity = 0.35]) =>
      ink.withValues(alpha: opacity);

  static Color umberMuted([double opacity = 0.55]) =>
      umber.withValues(alpha: opacity);
}

abstract final class NyakiSpacing {
  static const double screenHorizontal = 28;
  static const double sectionGap = 16;
  static const double cardRadius = 16;
  static const double actionHeight = 92;
}
