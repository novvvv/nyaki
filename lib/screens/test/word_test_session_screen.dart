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

/// 카드 1장을 화면 중앙에 놓고 좌우로 밀어서 채점하는 단어 테스트.
/// ← 왼쪽으로 밀기 = 모름(Again)   → 오른쪽으로 밀기 = 외움(Good)
/// 위/아래 방향은 채점에 쓰이지 않는다.
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
  // 세션 시작 시점에 한 번 고정되는 전체 출제 목록 (진행률/뜻 공개 초기값 계산용).
  late final List<Word> _initialWords =
      widget.options.selectWords(widget.wordBooks);

  // 실제로 화면에 남아있는 큐. 채점될 때마다 앞에서부터 하나씩 사라진다.
  late final List<Word> _queue = List.of(_initialWords);

  late final int _total = _initialWords.length;

  late final Set<String> _revealed = widget.options.hideMeaning
      ? <String>{}
      : _initialWords.map((word) => word.id).toSet();

  int get _completedCount => _total - _queue.length;

  void _toggleReveal(String wordId) {
    setState(() {
      if (!_revealed.add(wordId)) {
        _revealed.remove(wordId);
      }
    });
  }

  // 카드를 큐에서 먼저 낙관적으로 제거한 뒤(드래그 애니메이션과 같은 타이밍),
  // 실제 채점 저장은 별도로(비동기) 진행한다. 화면 전환이 DB 응답을 기다리지
  // 않게 하기 위함 — 로컬 DB 쓰기라 실패 확률은 낮지만, 실패해도 카드는 이미
  // 넘어간 상태로 두고 스낵바로만 알린다.
  void _grade(Word word, ReviewGrade grade) {
    setState(() {
      _queue.removeWhere((w) => w.id == word.id);
      _revealed.remove(word.id);
    });
    _persistGrade(word, grade);
  }

  Future<void> _persistGrade(Word word, ReviewGrade grade) async {
    try {
      await NyakiScope.of(context).gradeWord(
        wordBookId: word.wordBookId,
        wordId: word.id,
        grade: grade,
      );
    } catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(error.toString())),
      );
    }
  }

  Future<void> _toggleBookmark(Word word) async {
    final next = !word.isBookmarked;

    try {
      final updated = await NyakiScope.of(context).updateWord(
        wordBookId: word.wordBookId,
        wordId: word.id,
        input: UpdateWordInput(isBookmarked: next),
      );
      if (!mounted) return;
      setState(() {
        final index = _queue.indexWhere((w) => w.id == word.id);
        if (index != -1) _queue[index] = updated;
      });
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
    final done = _queue.isEmpty;

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
                    done ? '$_total / $_total' : '${_completedCount + 1} / $_total',
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
              child: done ? const _SessionCompleteView() : _buildCardStack(),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildCardStack() {
    return Stack(
      alignment: Alignment.center,
      children: [
        _DraggableCard(
          key: ValueKey(_queue.first.id),
          onSwipeLeft: () => _grade(_queue.first, ReviewGrade.again),
          onSwipeRight: () => _grade(_queue.first, ReviewGrade.good),
          child: Builder(
            builder: (context) {
              final word = _queue.first;
              final revealed = _revealed.contains(word.id);
              final isLast = _queue.length == 1;

              return _WordTestCard(
                word: word,
                revealed: revealed,
                isLast: isLast,
                onTap: () => _toggleReveal(word.id),
                onToggleLike: () => _toggleBookmark(word),
                onOpenComments: () => _openDescriptionSheet(word),
              );
            },
          ),
        ),
      ],
    );
  }
}

/// 좌우로만 드래그해서 채점하는 카드. 왼쪽으로 밀면 [onSwipeLeft](모름),
/// 오른쪽으로 밀면 [onSwipeRight](외움)를 호출하고 그 방향으로 날아가며
/// 사라진다. 위/아래 드래그는 채점에 쓰이지 않고, 기준을 못 채우면 원래
/// 자리로 스냅백된다.
class _DraggableCard extends StatefulWidget {
  const _DraggableCard({
    super.key,
    required this.child,
    required this.onSwipeLeft,
    required this.onSwipeRight,
  });

  final Widget child;
  final VoidCallback onSwipeLeft;
  final VoidCallback onSwipeRight;

  @override
  State<_DraggableCard> createState() => _DraggableCardState();
}

class _DraggableCardState extends State<_DraggableCard>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 260),
  )..addListener(() {
      if (_animation != null) {
        setState(() => _offset = _animation!.value);
      }
    });

  Animation<Offset>? _animation;
  Offset _offset = Offset.zero;

  // 이 거리(또는 이 속도)를 넘으면 채점으로 확정한다. 좌우 판정만 쓰므로
  // 화면 크기와 무관한 고정 픽셀 값 하나면 충분하다.
  static const double _dismissDistance = 120;
  static const double _velocityThreshold = 700;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _onPanStart(DragStartDetails details) {
    _controller.stop();
  }

  void _onPanUpdate(DragUpdateDetails details) {
    setState(() => _offset += details.delta);
  }

  void _onPanEnd(DragEndDetails details) {
    final screen = MediaQuery.sizeOf(context);
    final velocity = details.velocity.pixelsPerSecond;

    // 위/아래로 움직인 거리(_offset.dy)는 채점 판정에 전혀 안 쓴다 —
    // 오직 가로 이동(dx)만 본다. 그래서 세로로 아무리 밀어도 스냅백된다.
    final passedRight = _offset.dx > 0 &&
        (_offset.dx > _dismissDistance || velocity.dx > _velocityThreshold);
    final passedLeft = _offset.dx < 0 &&
        (-_offset.dx > _dismissDistance || -velocity.dx > _velocityThreshold);

    if (passedRight) {
      _flingTo(Offset(screen.width * 1.4, _offset.dy), widget.onSwipeRight);
    } else if (passedLeft) {
      _flingTo(Offset(-screen.width * 1.4, _offset.dy), widget.onSwipeLeft);
    } else {
      _snapBack();
    }
  }

  void _flingTo(Offset target, VoidCallback onComplete) {
    _animation = Tween<Offset>(begin: _offset, end: target).animate(
      CurvedAnimation(parent: _controller, curve: Curves.easeIn),
    );
    _controller.forward(from: 0).whenComplete(onComplete);
  }

  void _snapBack() {
    _animation = Tween<Offset>(begin: _offset, end: Offset.zero).animate(
      CurvedAnimation(parent: _controller, curve: Curves.easeOutCubic),
    );
    _controller.forward(from: 0);
  }

  @override
  Widget build(BuildContext context) {
    // 옆으로 밀수록 카드가 살짝 기울어져서 손으로 넘기는 느낌을 준다.
    // num.clamp()는 num을 반환하므로 Transform.rotate(angle: double)에 맞춰 변환한다.
    final double angle = (_offset.dx / 320).clamp(-0.22, 0.22).toDouble();

    return GestureDetector(
      onPanStart: _onPanStart,
      onPanUpdate: _onPanUpdate,
      onPanEnd: _onPanEnd,
      child: Transform.translate(
        offset: _offset,
        child: Transform.rotate(
          angle: angle,
          child: widget.child,
        ),
      ),
    );
  }
}

/// 세션이 끝났을 때(큐가 비었을 때) 보여주는 화면.
class _SessionCompleteView extends StatelessWidget {
  const _SessionCompleteView();

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(
            Icons.check_circle_outline_rounded,
            size: 40,
            color: NyakiColors.ink,
          ),
          const SizedBox(height: 14),
          const Text(
            '오늘 테스트 끝났어요',
            style: TextStyle(
              fontFamily: 'Inter',
              fontSize: 16,
              fontWeight: FontWeight.w700,
              color: NyakiColors.ink,
            ),
          ),
        ],
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
    required this.onToggleLike,
    required this.onOpenComments,
  });

  final Word word;
  final bool revealed;
  final bool isLast;
  final VoidCallback onTap;
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
                const SizedBox(height: 32),
                // 방향 힌트 — 드래그 중이 아니어도 항상 보이는 작은 안내.
                Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(
                      Icons.arrow_back_rounded,
                      size: 14,
                      color: NyakiColors.taupe,
                    ),
                    const SizedBox(width: 4),
                    Text(
                      '모름',
                      style: TextStyle(
                        fontFamily: 'Inter',
                        fontSize: 11,
                        fontWeight: FontWeight.w600,
                        color: NyakiColors.umber.withValues(alpha: 0.45),
                      ),
                    ),
                    const SizedBox(width: 20),
                    Icon(
                      Icons.arrow_forward_rounded,
                      size: 14,
                      color: NyakiColors.taupe,
                    ),
                    const SizedBox(width: 4),
                    Text(
                      '외움',
                      style: TextStyle(
                        fontFamily: 'Inter',
                        fontSize: 11,
                        fontWeight: FontWeight.w600,
                        color: NyakiColors.umber.withValues(alpha: 0.45),
                      ),
                    ),
                  ],
                ),
                if (isLast) ...[
                  const SizedBox(height: 6),
                  Text(
                    '마지막 단어',
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      fontFamily: 'Inter',
                      fontSize: 11,
                      fontWeight: FontWeight.w500,
                      color: NyakiColors.umber.withValues(alpha: 0.35),
                    ),
                  ),
                ],
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
