import 'package:flutter/material.dart';

import '../core/theme/nyaki_colors.dart';
import '../models/word.dart';
import '../models/word_book.dart';

/// 세로 스와이프(릴스 스타일) 단어 테스트.
/// 기본은 단어만 표시, 탭하면 발음·뜻 공개.
class WordTestSessionScreen extends StatefulWidget {
  const WordTestSessionScreen({super.key, required this.wordBook});

  final WordBook wordBook;

  @override
  State<WordTestSessionScreen> createState() => _WordTestSessionScreenState();
}

class _WordTestSessionScreenState extends State<WordTestSessionScreen> {
  late final List<Word> _words = widget.wordBook.activeWords;
  final _pageController = PageController();
  final _revealed = <String>{};
  int _currentPage = 0;

  @override
  void dispose() {
    _pageController.dispose();
    super.dispose();
  }

  void _toggleReveal(String wordId) {
    setState(() {
      if (!_revealed.add(wordId)) {
        _revealed.remove(wordId);
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: NyakiColors.cream,
      body: SafeArea(
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 12, 20, 0),
              child: Row(
                children: [
                  IconButton(
                    onPressed: () => Navigator.of(context).pop(),
                    icon: const Icon(Icons.close_rounded),
                    iconSize: 22,
                    color: NyakiColors.ink,
                    tooltip: '닫기',
                  ),
                  const Spacer(),
                  Text(
                    '${_currentPage + 1} / ${_words.length}',
                    style: TextStyle(
                      fontFamily: 'Inter',
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                      color: NyakiColors.ink.withValues(alpha: 0.5),
                    ),
                  ),
                  const Spacer(),
                  const SizedBox(width: 48),
                ],
              ),
            ),
            Expanded(
              child: PageView.builder(
                controller: _pageController,
                scrollDirection: Axis.vertical,
                itemCount: _words.length,
                onPageChanged: (page) => setState(() => _currentPage = page),
                itemBuilder: (context, index) {
                  final word = _words[index];
                  final revealed = _revealed.contains(word.id);
                  final isLast = index == _words.length - 1;

                  return _WordTestCard(
                    word: word,
                    revealed: revealed,
                    isLast: isLast,
                    onTap: () => _toggleReveal(word.id),
                  );
                },
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _WordTestCard extends StatelessWidget {
  const _WordTestCard({
    required this.word,
    required this.revealed,
    required this.isLast,
    required this.onTap,
  });

  final Word word;
  final bool revealed;
  final bool isLast;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 36),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              word.term,
              textAlign: TextAlign.center,
              style: const TextStyle(
                fontFamily: 'Inter',
                fontSize: 34,
                fontWeight: FontWeight.w700,
                color: NyakiColors.ink,
                height: 1.25,
              ),
            ),
            const SizedBox(height: 26),
            AnimatedSwitcher(
              duration: const Duration(milliseconds: 180),
              child: revealed
                  ? Column(
                      key: const ValueKey('revealed'),
                      children: [
                        if (word.pronunciation != null) ...[
                          Text(
                            word.pronunciation!,
                            textAlign: TextAlign.center,
                            style: TextStyle(
                              fontFamily: 'Inter',
                              fontSize: 16,
                              fontWeight: FontWeight.w500,
                              color: NyakiColors.ink.withValues(alpha: 0.55),
                            ),
                          ),
                          const SizedBox(height: 14),
                        ],
                        Text(
                          word.meaning,
                          textAlign: TextAlign.center,
                          style: const TextStyle(
                            fontFamily: 'Inter',
                            fontSize: 20,
                            fontWeight: FontWeight.w600,
                            color: NyakiColors.ink,
                            height: 1.4,
                          ),
                        ),
                      ],
                    )
                  : Text(
                      '화면을 탭하면 뜻이 보여요',
                      key: const ValueKey('hidden'),
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        fontFamily: 'Inter',
                        fontSize: 13,
                        fontWeight: FontWeight.w500,
                        color: NyakiColors.ink.withValues(alpha: 0.35),
                      ),
                    ),
            ),
            const SizedBox(height: 70),
            Icon(
              isLast
                  ? Icons.check_circle_outline_rounded
                  : Icons.keyboard_arrow_up_rounded,
              size: 22,
              color: NyakiColors.ink.withValues(alpha: 0.3),
            ),
            const SizedBox(height: 6),
            Text(
              isLast ? '마지막 단어예요' : '위로 밀면 다음 단어',
              textAlign: TextAlign.center,
              style: TextStyle(
                fontFamily: 'Inter',
                fontSize: 12,
                fontWeight: FontWeight.w500,
                color: NyakiColors.ink.withValues(alpha: 0.3),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
