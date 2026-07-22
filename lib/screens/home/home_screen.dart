import 'package:flutter/material.dart';

import '../../core/theme/nyaki_colors.dart';
import '../quest/quest_screen.dart';

class HomeScreen extends StatelessWidget {
  const HomeScreen({super.key});

  void _openQuest(BuildContext context) {
    Navigator.of(context).push<void>(
      MaterialPageRoute<void>(
        builder: (_) => const QuestScreen(),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final width = MediaQuery.sizeOf(context).width;
    final catSize = (width * 0.68).clamp(220.0, 260.0);

    return Stack(
      children: [
        Center(
          child: SizedBox(
            width: catSize,
            height: catSize,
            child: Image.asset(
              'assets/images/cat.png',
              fit: BoxFit.contain,
            ),
          ),
        ),
        Positioned(
          right: 24,
          bottom: 28,
          child: SafeArea(
            child: Material(
              color: Colors.white,
              shape: CircleBorder(
                side: BorderSide(
                  color: NyakiColors.ink.withValues(alpha: 0.12),
                ),
              ),
              elevation: 0,
              child: InkWell(
                onTap: () => _openQuest(context),
                customBorder: const CircleBorder(),
                child: SizedBox(
                  width: 52,
                  height: 52,
                  child: Center(
                    child: Image.asset(
                      'assets/icon/quest.png',
                      width: 24,
                      height: 24,
                      fit: BoxFit.contain,
                    ),
                  ),
                ),
              ),
            ),
          ),
        ),
      ],
    );
  }
}
