import 'dart:io';

import 'package:flutter/material.dart';

import '../../core/nyaki_scope.dart';
import '../../core/theme/nyaki_colors.dart';
import '../../data/repositories/vocab_repository.dart';
import '../../models/word.dart';
import '../../models/word_book.dart';

/// 테스트 표시 방식을 정하는 옵션.
///
/// 대상 단어를 고르는 기준은 옵션이 아니라 SM-2가 정한다 — `srs_due_at`이 지난
/// 단어(= `Word.isDue`)만 출제된다. 예전의 전체/모름만/외움만 필터는
/// `memorization_status`만 보고 복습 주기를 무시했기 때문에 제거했다.
class WordTestOptions {
  const WordTestOptions({
    this.hideMeaning = true,
    this.shuffle = false,
  });

  /// true면 단어만 먼저 보여주고 탭해야 뜻이 보인다.
  final bool hideMeaning;

  /// 단어 순서 섞기.
  final bool shuffle;

  /// 선택한 단어장들에서 "오늘 복습할 단어"만 모아 하나의 출제 목록으로 합친다.
  ///
  /// 주의: 이 목록은 세션을 시작할 때 한 번만 계산되고 그 뒤로 고정된다.
  /// 그래서 세션 도중 "모름"을 눌러 즉시 due가 된 단어도 그 판에서는 다시
  /// 나오지 않고, 다음 번 테스트에 들어갈 때 다시 출제된다. (docs/SRS.md 참고)
  List<Word> selectWords(List<WordBook> wordBooks) {
    final words = wordBooks
        .expand((book) => book.activeWords)
        .where((word) => word.isDue)
        .toList();
    if (shuffle) words.shuffle();
    return words;
  }
}

/// 세로 스와이프(릴스 스타일) 단어 테스트.
/// 기본은 단어만 표시, 탭하면 발음·뜻 공개.
class WordTestSessionScreen extends StatefulWidget {
  const WordTestSessionScreen({
    super.key,
    required this.wordBooks,
    this.options = const WordTestOptions(),
  });

  /// 테스트 대상 단어장 목록. 여러 개를 합쳐 출제한다.
  final List<WordBook> wordBooks;
  final WordTestOptions options;

  @override
  State<WordTestSessionScreen> createState() => _WordTestSessionScreenState();
}

class _WordTestSessionScreenState extends State<WordTestSessionScreen> {
  late final List<Word> _words = widget.options.selectWords(widget.wordBooks);
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

  // 모름/외움을 누르면 SM-2로 채점한다.
  // 예전에는 updateWord로 memorizationStatus만 뒤집었지만, 이제는 gradeWord가
  // ease/interval/반복횟수/다음 복습일(srs_due_at)까지 함께 계산해서 저장한다.
  // 계산 규칙: docs/SRS.md · 구현: lib/data/srs/sm2.dart
  Future<void> _grade(int index, ReviewGrade grade) async {
    final word = _words[index];

    try {
      final updated = await NyakiScope.of(context).gradeWord(
        wordBookId: word.wordBookId,
        wordId: word.id,
        grade: grade,
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

  Future<void> _toggleBookmark(int index) async {
    final word = _words[index];
    final next = !word.isBookmarked;

    try {
      final updated = await NyakiScope.of(context).updateWord(
        wordBookId: word.wordBookId,
        wordId: word.id,
        input: UpdateWordInput(isBookmarked: next),
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

  void _openDescriptionSheet(Word word) {
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      isDismissible: true,
      enableDrag: true,
      backgroundColor: Colors.transparent,
      barrierColor: NyakiColors.ink.withValues(alpha: 0.28),
      builder: (_) => _DescriptionSheet(word: word),
    );
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
                      color: NyakiColors.umber.withValues(alpha: 0.55),
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
                    onMarkUnmemorized: () => _grade(index, ReviewGrade.again),
                    onMarkMemorized: () => _grade(index, ReviewGrade.good),
                    onToggleLike: () => _toggleBookmark(index),
                    onOpenComments: () => _openDescriptionSheet(word),
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
    required this.onToggleLike,
    required this.onOpenComments,
  });

  final Word word;
  final bool revealed;
  final bool isLast;
  final VoidCallback onTap;
  final VoidCallback onMarkUnmemorized;
  final VoidCallback onMarkMemorized;
  final VoidCallback onToggleLike;
  final VoidCallback onOpenComments;

  @override
  Widget build(BuildContext context) {
    return Stack(
      children: [
        GestureDetector(
          behavior: HitTestBehavior.opaque,
          onTap: onTap,
          child: Padding(
            padding: const EdgeInsets.fromLTRB(36, 0, 64, 0),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                if (word.imagePath != null) ...[
                  Center(
                    child: ClipRRect(
                      borderRadius: BorderRadius.circular(4),
                      child: SizedBox(
                        width: 160,
                        height: 160,
                        child: _WordImage(path: word.imagePath!),
                      ),
                    ),
                  ),
                  const SizedBox(height: 20),
                ],
                Text(
                  word.term,
                  textAlign: TextAlign.center,
                  style: const TextStyle(
                    fontFamily: 'Inter',
                    fontSize: 26,
                    fontWeight: FontWeight.w600,
                    letterSpacing: -0.3,
                    color: NyakiColors.ink,
                    height: 1.3,
                  ),
                ),
                const SizedBox(height: 16),
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
                                  fontSize: 13,
                                  fontWeight: FontWeight.w500,
                                  color: NyakiColors.umber.withValues(
                                    alpha: 0.55,
                                  ),
                                ),
                              ),
                              const SizedBox(height: 8),
                            ],
                            Text(
                              word.meaning,
                              textAlign: TextAlign.center,
                              style: TextStyle(
                                fontFamily: 'Inter',
                                fontSize: 16,
                                fontWeight: FontWeight.w500,
                                color: NyakiColors.ink.withValues(alpha: 0.88),
                                height: 1.4,
                              ),
                            ),
                          ],
                        )
                      : Text(
                          '탭하여 뜻 보기',
                          key: const ValueKey('hidden'),
                          textAlign: TextAlign.center,
                          style: TextStyle(
                            fontFamily: 'Inter',
                            fontSize: 12,
                            fontWeight: FontWeight.w500,
                            color: NyakiColors.taupe,
                          ),
                        ),
                ),
                const SizedBox(height: 28),
                Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    _MemorizationButton(
                      label: '모름',
                      selected: !word.isMemorized,
                      onTap: onMarkUnmemorized,
                    ),
                    const SizedBox(width: 8),
                    _MemorizationButton(
                      label: '외움',
                      selected: word.isMemorized,
                      onTap: onMarkMemorized,
                    ),
                  ],
                ),
                const SizedBox(height: 28),
                Icon(
                  isLast
                      ? Icons.check_circle_outline_rounded
                      : Icons.keyboard_arrow_up_rounded,
                  size: 18,
                  color: NyakiColors.taupe.withValues(alpha: 0.8),
                ),
                const SizedBox(height: 4),
                Text(
                  isLast ? '마지막' : '위로 밀기',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    fontFamily: 'Inter',
                    fontSize: 11,
                    fontWeight: FontWeight.w500,
                    color: NyakiColors.umber.withValues(alpha: 0.35),
                  ),
                ),
              ],
            ),
          ),
        ),
        Positioned(
          right: 20,
          bottom: 96,
          child: _ReelActionRail(
            liked: word.isBookmarked,
            onLike: onToggleLike,
            onComment: onOpenComments,
            onExport: () {},
          ),
        ),
      ],
    );
  }
}

/// 인스타 릴스 스타일 우측 플로팅 액션.
class _ReelActionRail extends StatelessWidget {
  const _ReelActionRail({
    required this.liked,
    required this.onLike,
    required this.onComment,
    required this.onExport,
  });

  final bool liked;
  final VoidCallback onLike;
  final VoidCallback onComment;
  final VoidCallback onExport;

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        _ReelAction(
          icon: liked ? Icons.favorite_rounded : Icons.favorite_border_rounded,
          active: liked,
          activeColor: NyakiColors.ink,
          onTap: onLike,
        ),
        const SizedBox(height: 22),
        _ReelAction(
          icon: Icons.mode_comment_outlined,
          onTap: onComment,
        ),
        const SizedBox(height: 22),
        _ReelAction(
          icon: Icons.send_rounded,
          onTap: onExport,
        ),
      ],
    );
  }
}

class _ReelAction extends StatelessWidget {
  const _ReelAction({
    required this.icon,
    required this.onTap,
    this.active = false,
    this.activeColor,
  });

  final IconData icon;
  final VoidCallback onTap;
  final bool active;
  final Color? activeColor;

  @override
  Widget build(BuildContext context) {
    final color = active
        ? (activeColor ?? NyakiColors.ink)
        : NyakiColors.ink.withValues(alpha: 0.75);

    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.all(6),
        child: Icon(
          icon,
          size: 26,
          color: color,
        ),
      ),
    );
  }
}

class _DescriptionSheet extends StatelessWidget {
  const _DescriptionSheet({required this.word});

  final Word word;

  static String _formatCreatedAt(DateTime date) {
    final local = date.toLocal();
    final y = local.year.toString().padLeft(4, '0');
    final m = local.month.toString().padLeft(2, '0');
    final d = local.day.toString().padLeft(2, '0');
    return '$y.$m.$d';
  }

  @override
  Widget build(BuildContext context) {
    final description = word.description?.trim() ?? '';
    final example = word.example?.trim() ?? '';
    final createdLabel = _formatCreatedAt(word.createdAt);
    final comments = <String>[
      if (description.isNotEmpty) description,
      if (example.isNotEmpty) example,
    ];
    final sheetHeight = MediaQuery.sizeOf(context).height * 0.5;

    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: () => Navigator.of(context).pop(),
      child: SizedBox.expand(
        child: Align(
          alignment: Alignment.bottomCenter,
          child: GestureDetector(
            // 시트 안 탭은 닫히지 않게 흡수
            onTap: () {},
            child: SizedBox(
              height: sheetHeight,
              width: double.infinity,
              child: Material(
                color: NyakiColors.cream,
                borderRadius:
                    const BorderRadius.vertical(top: Radius.circular(16)),
                clipBehavior: Clip.antiAlias,
                child: SafeArea(
                  top: false,
                  child: Column(
                    children: [
                      const SizedBox(height: 10),
                      Container(
                        width: 40,
                        height: 4,
                        decoration: BoxDecoration(
                          color: NyakiColors.taupe.withValues(alpha: 0.7),
                          borderRadius: BorderRadius.circular(2),
                        ),
                      ),
                      const SizedBox(height: 14),
                      const Text(
                        '메모',
                        style: TextStyle(
                          fontFamily: 'Inter',
                          fontSize: 15,
                          fontWeight: FontWeight.w700,
                          color: NyakiColors.ink,
                        ),
                      ),
                      const SizedBox(height: 12),
                      const Divider(height: 1, color: NyakiColors.softDune),
                      Expanded(
                        child: comments.isEmpty
                            ? Center(
                                child: Text(
                                  '아직 메모가 없어요',
                                  style: TextStyle(
                                    fontFamily: 'Inter',
                                    fontSize: 14,
                                    color: NyakiColors.umber.withValues(
                                      alpha: 0.45,
                                    ),
                                  ),
                                ),
                              )
                            : ListView.separated(
                                padding:
                                    const EdgeInsets.fromLTRB(20, 18, 20, 28),
                                itemCount: comments.length,
                                separatorBuilder: (_, __) =>
                                    const SizedBox(height: 18),
                                itemBuilder: (context, index) {
                                  return _InstagramCommentRow(
                                    createdLabel: createdLabel,
                                    body: comments[index],
                                  );
                                },
                              ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _InstagramCommentRow extends StatelessWidget {
  const _InstagramCommentRow({
    required this.createdLabel,
    required this.body,
  });

  final String createdLabel;
  final String body;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          createdLabel,
          style: const TextStyle(
            fontFamily: 'Inter',
            fontSize: 13,
            fontWeight: FontWeight.w700,
            color: NyakiColors.ink,
          ),
        ),
        const SizedBox(height: 6),
        Text(
          body,
          style: TextStyle(
            fontFamily: 'Inter',
            fontSize: 14,
            height: 1.45,
            color: NyakiColors.ink.withValues(alpha: 0.92),
          ),
        ),
      ],
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
          color: selected ? NyakiColors.ink : NyakiColors.taupe,
        ),
        borderRadius: BorderRadius.circular(6),
      ),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(6),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 8),
          child: Text(
            label,
            style: TextStyle(
              fontFamily: 'Inter',
              fontSize: 12,
              fontWeight: FontWeight.w600,
              letterSpacing: 0.1,
              color: selected
                  ? NyakiColors.cream
                  : NyakiColors.ink.withValues(alpha: 0.45),
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
      color: NyakiColors.softDune,
      child: image,
    );
  }
}
