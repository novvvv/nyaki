import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import 'nyaki_colors.dart';

ThemeData buildNyakiTheme() {
  const colorScheme = ColorScheme(
    brightness: Brightness.light,
    primary: NyakiColors.ink,
    onPrimary: NyakiColors.cream,
    secondary: NyakiColors.muted,
    onSecondary: NyakiColors.ink,
    error: Color(0xFFB3261E),
    onError: Colors.white,
    surface: NyakiColors.cream,
    onSurface: NyakiColors.ink,
  );

  final base = ThemeData(
    useMaterial3: true,
    brightness: Brightness.light,
    scaffoldBackgroundColor: NyakiColors.cream,
    colorScheme: colorScheme,
    canvasColor: NyakiColors.cream,
  );

  return base.copyWith(
    textTheme: GoogleFonts.interTextTheme(base.textTheme).apply(
      bodyColor: NyakiColors.ink,
      displayColor: NyakiColors.ink,
    ),
    dividerColor: NyakiColors.muted,
    dividerTheme: const DividerThemeData(
      color: NyakiColors.muted,
      thickness: 1,
      space: 1,
    ),
    appBarTheme: const AppBarTheme(
      backgroundColor: NyakiColors.cream,
      surfaceTintColor: Colors.transparent,
      elevation: 0,
      foregroundColor: NyakiColors.ink,
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        backgroundColor: NyakiColors.ink,
        foregroundColor: NyakiColors.cream,
        elevation: 0,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(NyakiSpacing.cardRadius),
        ),
      ),
    ),
  );
}
