import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import 'nyaki_colors.dart';

ThemeData buildNyakiTheme() {
  const colorScheme = ColorScheme(
    brightness: Brightness.light,
    primary: NyakiColors.ink,
    onPrimary: NyakiColors.cream,
    secondary: NyakiColors.softDune,
    onSecondary: NyakiColors.ink,
    tertiary: NyakiColors.umber,
    onTertiary: NyakiColors.cream,
    error: Color(0xFFB3261E),
    onError: Colors.white,
    surface: NyakiColors.cream,
    onSurface: NyakiColors.ink,
    outline: NyakiColors.taupe,
    outlineVariant: NyakiColors.softDune,
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
    dividerColor: NyakiColors.softDune,
    dividerTheme: const DividerThemeData(
      color: NyakiColors.softDune,
      thickness: 1,
      space: 1,
    ),
    appBarTheme: const AppBarTheme(
      backgroundColor: NyakiColors.cream,
      surfaceTintColor: Colors.transparent,
      elevation: 0,
      foregroundColor: NyakiColors.ink,
    ),
    cardTheme: CardThemeData(
      color: NyakiColors.cardBg,
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(NyakiSpacing.cardRadius),
        side: const BorderSide(color: NyakiColors.taupe, width: 0.8),
      ),
    ),
    snackBarTheme: SnackBarThemeData(
      backgroundColor: NyakiColors.umber,
      contentTextStyle: const TextStyle(
        fontFamily: 'Inter',
        color: NyakiColors.cream,
      ),
      behavior: SnackBarBehavior.floating,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(10),
      ),
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
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        foregroundColor: NyakiColors.ink,
        side: const BorderSide(color: NyakiColors.taupe),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(NyakiSpacing.cardRadius),
        ),
      ),
    ),
    textButtonTheme: TextButtonThemeData(
      style: TextButton.styleFrom(
        foregroundColor: NyakiColors.umber,
      ),
    ),
    inputDecorationTheme: const InputDecorationTheme(
      filled: false,
      hintStyle: TextStyle(color: Color(0x66252525)),
      enabledBorder: UnderlineInputBorder(
        borderSide: BorderSide(color: NyakiColors.taupe),
      ),
      focusedBorder: UnderlineInputBorder(
        borderSide: BorderSide(color: NyakiColors.ink, width: 1.2),
      ),
    ),
    iconTheme: const IconThemeData(color: NyakiColors.ink),
    listTileTheme: const ListTileThemeData(
      iconColor: NyakiColors.umber,
      textColor: NyakiColors.ink,
    ),
  );
}
