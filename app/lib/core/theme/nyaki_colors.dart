import 'package:flutter/material.dart';

/// Nyaki design tokens — see [Design.md](../../../docs/Design.md).
/// 2026-08-26: Off white / Ivory / Nude / Obsidian 4색으로 고정.
/// 토큰 이름(cream/ink/umber/softDune/taupe/cardBg)은 기존 코드와의
/// 호환을 위해 유지하고, 값만 새 팔레트로 교체했다.
abstract final class NyakiColors {
  /// Ivory #F3F0E9 — page / scaffold background
  static const Color cream = Color(0xFFF3F0E9);

  /// Obsidian #101010 — primary text / filled controls
  static const Color ink = Color(0xFF101010);

  /// Obsidian #101010 — 액센트 컬러 없음, 강조는 ink와 동일한 Obsidian 채움으로 처리
  static const Color umber = Color(0xFF101010);

  /// Nude #E3DBCC — subtle surfaces, soft dividers
  static const Color softDune = Color(0xFFE3DBCC);

  /// Nude #E3DBCC — borders, chips, unselected strokes
  static const Color taupe = Color(0xFFE3DBCC);

  /// Alias: muted surfaces (Nude)
  static const Color muted = softDune;

  /// Off white #FDFCF8 — 카드/떠있는 요소의 표면
  static const Color cardBg = Color(0xFFFDFCF8);

  /// Alias: check / stroke (Nude)
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
