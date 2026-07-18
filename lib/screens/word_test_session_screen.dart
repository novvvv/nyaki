import 'dart:io';

import 'package:flutter/material.dart';

import '../core/nyaki_scope.dart';
import '../core/theme/nyaki_colors.dart';
import '../data/repositories/vocab_repository.dart';
import '../models/word.dart';
import '../models/word_book.dart';

/// 테스트 대상/표시 방식을 정하는 옵션.
class WordTestOptions {
  const WordTestOptions({
    this.filter = WordTestFilter.unmemorizedOnly,
    this.hideMeaning = true,
    this.shuffle = false,
  });

  /// 대상 단어 필터.
  final WordTestFilter filter;

  /// true면 단어만 먼저 보여주고 탭해야 뜻이 보인다.
  final bool hideMeaning;

  /// 단어 순서 섞기.
  final bool shuffle;

  List<Word> selectWords(WordBook wordBook) {
    final words = wordBook.activeWords.where((word) {
      switch (filter) {
        case WordTestFilter.all:
          return true;
        case WordTestFilter.unmemorizedOnly:
          return !word.isMemorized;
        case WordTestFilter.memorizedOnly:
          return word.isMemorized;
      }
    }).toList();
    if (shuffle) words.shuffle();
    return words;
  }
}

enum WordTestFilter {
  all,
  unmemorizedOnly,
  memorizedOnly,
}

/// 세로 스와이프(릴스 스타일) 단어 테스트.
/// 기본은 단어만 표시, 탭하면 발음·뜻 공개.
class WordTestSessionScreen extends StatefulWidget {
  const WordTestSessionScreen({
    super.key,
    required this.wordBook,
    this.options = const WordTestOptions(),
  });

  final WordBook wordBook;
  final WordTestOptions options;

  @override
  State<WordTestSessionScreen> createState() => _WordTestSessionScreenState();
}

class _WordTestSessionScreenState extends State<WordTestSessionScreen> {
  late final List<Word> _words = widget.options.selectWords(widget.wordBook);
  final _pageController = PageController();
  late final Set<String> _revealed = widget.options.hideMeaning
      ? <String>{}
      : _words.map((word) => word.id).toSet();
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

  Future<void> _setMemorization(
    int index,
    WordMemorizationStatus status,
  ) async {
    final word = _words[index];
    if (word.memorizationStatus == status) return;

    try {
      final updated = await NyakiScope.of(context).updateWord(
        wordBookId: word.wordBookId,
        wordId: word.id,
        input: UpdateWordInput(memorizationStatus: status),
      );
      if (!mounted) return;
      setState(() => _words[index] = updated);
    } catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(error.toString())),
      );
    }
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
                    onMarkUnmemorized: () => _setMemorization(
                      index,
                      WordMemorizationStatus.unmemorized,
                    ),
                    onMarkMemorized: () => _setMemorization(
                      index,
                      WordMemorizationStatus.memorized,
                    ),
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
    required this.onMarkUnmemorized,
    required this.onMarkMemorized,
  });

  final Word word;
  final bool revealed;
  final bool isLast;
  final VoidCallback onTap;
  final VoidCallback onMarkUnmemorized;
  final VoidCallback onMarkMemorized;

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
            if (word.imagePath != null) ...[
              Center(
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(4),
                  child: SizedBox(
                    width: 240,
                    height: 240,
                    child: _WordImage(path: word.imagePath!),
                  ),
                ),
              ),
              const SizedBox(height: 28),
            ],
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
            const SizedBox(height: 44),
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                _MemorizationButton(
                  label: '모름',
                  selected: !word.isMemorized,
                  onTap: onMarkUnmemorized,
                ),
                const SizedBox(width: 10),
                _MemorizationButton(
                  label: '외움',
                  selected: word.isMemorized,
                  onTap: onMarkMemorized,
                ),
              ],
            ),
            const SizedBox(height: 44),
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

class _MemorizationButton extends StatelessWidget {
  const _MemorizationButton({
    required this.label,
    required this.selected,
    required this.onTap,
  });

  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: selected ? NyakiColors.ink : Colors.transparent,
      shape: RoundedRectangleBorder(
        side: BorderSide(
          color: NyakiColors.ink.withValues(alpha: selected ? 1 : 0.2),
        ),
        borderRadius: BorderRadius.circular(4),
      ),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(4),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 26, vertical: 10),
          child: Text(
            label,
            style: TextStyle(
              fontFamily: 'Inter',
              fontSize: 13,
              fontWeight: FontWeight.w600,
              letterSpacing: 0.2,
              color: selected
                  ? NyakiColors.cream
                  : NyakiColors.ink.withValues(alpha: 0.5),
            ),
          ),
        ),
      ),
    );
  }
}

class _WordImage extends StatelessWidget {
  const _WordImage({required this.path});

  final String path;

  @override
  Widget build(BuildContext context) {
    final image = path.startsWith('assets/')
        ? Image.asset(path, fit: BoxFit.cover)
        : Image.file(File(path), fit: BoxFit.cover);

    return ColoredBox(
      color: NyakiColors.ink.withValues(alpha: 0.06),
      child: image,
    );
  }
}
