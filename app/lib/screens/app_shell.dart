import 'package:flutter/material.dart';

import '../core/theme/nyaki_colors.dart';
import '../widgets/nyaki_bottom_bar.dart';
import 'home/home_screen.dart';
import 'quest/quest_screen.dart';
import 'settings/settings_screen.dart';
import 'test/word_test_screen.dart';
import 'word_book/word_book_list_screen.dart';

class AppShell extends StatefulWidget {
  const AppShell({super.key});

  @override
  State<AppShell> createState() => _AppShellState();
}

class _AppShellState extends State<AppShell> {
  int _tabIndex = 0;

  /// 홈 탭에 "다시" 들어올 때마다 증가시켜 [HomeScreen]에 새 key로 전달한다.
  /// IndexedStack이 위젯 상태를 계속 살려두기 때문에, 이 값이 바뀌어야만
  /// HomeScreen이 새로 생성되면서 고양이 이미지가 재선택된다.
  int _homeVisitId = 0;

  List<Widget> get _screens => [
        HomeScreen(key: ValueKey(_homeVisitId)),
        const QuestScreen(),
        const WordBookListScreen(),
        const WordTestScreen(),
        const SettingsScreen(),
      ];

  void _handleTabTap(int index) {
    setState(() {
      if (index == 0 && _tabIndex != 0) {
        _homeVisitId++;
      }
      _tabIndex = index;
    });
  }

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
        onTap: _handleTabTap,
      ),
    );
  }
}
