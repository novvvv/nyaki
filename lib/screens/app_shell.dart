import 'package:flutter/material.dart';

import '../core/theme/nyaki_colors.dart';
import '../widgets/nyaki_bottom_bar.dart';
import 'home/home_screen.dart';
import 'quest/quest_screen.dart';
import 'settings/settings_screen.dart';
import 'test/word_test_screen.dart';
import 'word_book/add_word_screen.dart';
import 'word_book/word_book_list_screen.dart';

class AppShell extends StatefulWidget {
  const AppShell({super.key});

  @override
  State<AppShell> createState() => _AppShellState();
}

class _AppShellState extends State<AppShell> {
  int _tabIndex = 0;

  static const _screens = [
    HomeScreen(),
    QuestScreen(),
    WordBookListScreen(),
    AddWordScreen(),
    WordTestScreen(),
    SettingsScreen(),
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: NyakiColors.cream,
      body: SafeArea(
        bottom: false,
        child: IndexedStack(
          index: _tabIndex,
          children: _screens,
        ),
      ),
      bottomNavigationBar: NyakiBottomBar(
        currentIndex: _tabIndex,
        onTap: (index) => setState(() => _tabIndex = index),
      ),
    );
  }
}
