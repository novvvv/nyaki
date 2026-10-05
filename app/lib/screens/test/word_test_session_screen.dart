import 'dart:io';

import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../core/auth_scope.dart';
import '../../core/error_snackbar.dart';
import '../../core/nyaki_scope.dart';
import '../../core/progress_scope.dart';
import '../../core/theme/nyaki_colors.dart';
import '../../data/auth/auth_controller.dart';
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
    this.showWordMeaning = false,
    this.showPronunciation = false,
    this.showExample = true,
    this.showExampleMeaning = false,
    this.shuffle = false,
    this.dailyLimit,
  });

  /// true면 단어 뜻을 탭 없이 처음부터 보여준다.
  final bool showWordMeaning;

  /// true면 발음을 탭 없이 처음부터 보여준다.
  final bool showPronunciation;

  /// true면 예문을 탭 없이 처음부터 보여준다.
  final bool showExample;

  /// true면 예문 뜻을 탭 없이 처음부터 보여준다.
  final bool showExampleMeaning;

  /// 단어 순서 섞기.
  final bool shuffle;

  /// 한 세션에서 진행할 최대 단어 수. null이면 오늘 due인 단어 전부.
  final int? dailyLimit;

  /// 선택한 단어장들에서 "오늘 복습할 단어"만 모아 하나의 출제 목록으로 합친다.
  ///
  /// due 단어가 dailyLimit보다 많으면 srsDueAt이 가장 오래된(많이 밀린) 단어부터
  /// dailyLimit개만 자른다 — 나머지는 그날 세션에서 빠지고 다음 테스트에서 다시 계산된다.
  ///
  /// 주의: 이 목록은 세션을 시작할 때 한 번만 계산되고 그 뒤로 고정된다.
  /// 그래서 세션 도중 "모름"을 눌러 즉시 due가 된 단어도 그 판에서는 다시
  /// 나오지 않고, 다음 번 테스트에 들어가면 다시 출제된다. (docs/SRS.md 참고)
  List<Word> selectWords(List<WordBook> wordBooks) {
    final words = wordBooks
        .expand((book) => book.activeWords)
        .where((word) => word.isDue)
        .toList()
      ..sort((a, b) => a.srsDueAt.compareTo(b.srsDueAt));

    final limit = dailyLimit;
    final limited =
        (limit != null && limit < words.length) ? words.sublist(0, limit) : words;

    if (shuffle) limited.shuffle();
    return limited;
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

  // 탭으로 "가려진 채 시작한 항목"을 마저 공개하는 상태. 단어 뜻·발음·예문 뜻을
  // 한꺼번에 여닫는다 — 어느 항목이 이미 옵션으로 처음부터 보이고 있었는지는
  // _WordTestCard에서 options와 OR로 합쳐서 계산한다.
  final Set<String> _revealed = <String>{};

  int get _completedCount => _total - _queue.length;

  // 스와이프 채점 방법 안내 오버레이. "다시 보지 않기"를 누르기 전까진
  // 세션 시작 때마다 다시 보여준다(그냥 X로 닫으면 이번 세션에서만 숨김).
  static const _tutorialDismissedKey = 'test_swipe_tutorial_dismissed';
  bool _showTutorial = false;

  @override
  void initState() {
    super.initState();
    _loadTutorialVisibility();
  }

  Future<void> _loadTutorialVisibility() async {
    final prefs = await SharedPreferences.getInstance();
    final dismissed = prefs.getBool(_tutorialDismissedKey) ?? false;
    if (!mounted || dismissed) return;
    setState(() => _showTutorial = true);
  }

  void _closeTutorial() {
    setState(() => _showTutorial = false);
  }

  Future<void> _dismissTutorialForever() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(_tutorialDismissedKey, true);
    if (!mounted) return;
    setState(() => _showTutorial = false);
  }

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

    // 마지막 카드를 넘겨 세션이 끝나는 순간이 곧 복습 퀘스트 완료다.
    // 종료 화면(_SessionCompleteView) 쪽이 아니라 여기서 부르는 이유는
    // build()가 리빌드마다 다시 불리기 때문 — 여기는 카드를 넘긴 순간 1회다.
    if (_queue.isEmpty) {
      _completeReviewQuest();
    }
  }

 
  // [Method] 복습 세션을 끝냈을 때 완료 여부를 서버에 알리는 메서드 
  void _completeReviewQuest() {

    // 로그인하지 않은 경우엔는 API Call 자체를 하지 않는다. - 서버 부하 최소화 
    if (AuthScope.of(context).status != AuthStatus.signedIn) return;

    // ✨ 시간대 판별 로직 ✨
    // 기기 시간대 기준으로 현재 시각을 파싱한다. 
    final hour = DateTime.now().hour;
    final String questId;
    if (hour >= 6 && hour < 14) {
      questId = 'morning_review'; // 아침 퀘스트
    } else if (hour >= 18) {
      questId = 'evening_review'; // 저녁 퀘스트
    } else {
      return; // 호출 x
    }

    ProgressScope.of(context).completeQuest(questId);

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
      showErrorSnackBar(context, message: '채점 저장에 실패했어요.', error: error);
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
      showErrorSnackBar(context, message: '북마크 변경에 실패했어요.', error: error);
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
      builder: (_) => _DescriptionSheet(
        word: word,
        onSaved: (updated) {
          setState(() {
            final index = _queue.indexWhere((w) => w.id == updated.id);
            if (index != -1) _queue[index] = updated;
          });
        },
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final done = _queue.isEmpty;

    return Scaffold(
      backgroundColor: NyakiColors.cream,
      body: SafeArea(
        child: Stack(
          children: [
            Column(
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
                        done
                            ? '$_total / $_total'
                            : '${_completedCount + 1} / $_total',
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
            if (_showTutorial)
              _SwipeTutorialOverlay(
                onClose: _closeTutorial,
                onDismissForever: _dismissTutorialForever,
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
                // 탭으로 마저 공개했거나, 옵션이 애초에 처음부터 보여주기로
                // 되어 있으면 보인다.
                wordMeaningVisible: revealed || widget.options.showWordMeaning,
                pronunciationVisible:
                    revealed || widget.options.showPronunciation,
                exampleVisible: revealed || widget.options.showExample,
                exampleMeaningVisible:
                    revealed || widget.options.showExampleMeaning,
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

/// 세션 진입 시 뜨는 스와이프 채점법 안내 오버레이 — 반투명 검정 배경 위에
/// 바로 냐키 이미지+안내 문구, 우측 상단 닫기(X), 하단 "다시 보지 않기".
class _SwipeTutorialOverlay extends StatelessWidget {
  const _SwipeTutorialOverlay({
    required this.onClose,
    required this.onDismissForever,
  });

  final VoidCallback onClose;
  final VoidCallback onDismissForever;

  @override
  Widget build(BuildContext context) {
    return Positioned.fill(
      child: Container(
        color: Colors.black.withValues(alpha: 0.72),
        child: Stack(
          children: [
            Positioned(
              top: 4,
              right: 4,
              child: IconButton(
                onPressed: onClose,
                icon: const Icon(Icons.close_rounded),
                iconSize: 22,
                color: Colors.white,
                tooltip: '닫기',
              ),
            ),
            Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Image.asset(
                    'assets/images/nyaki_grooming.png',
                    width: 110,
                    height: 110,
                    fit: BoxFit.contain,
                  ),
                  const SizedBox(height: 10),
                  const Text(
                    '슥 밀면 채점 끝이다냥!',
                    style: TextStyle(
                      fontFamily: 'Inter',
                      fontSize: 16,
                      fontWeight: FontWeight.w700,
                      color: Colors.white,
                    ),
                  ),
                  const SizedBox(height: 6),
                  const Text(
                    '다음 복습 시간은 냐키가 알아서 챙겨준다냥',
                    style: TextStyle(
                      fontFamily: 'Inter',
                      fontSize: 12.5,
                      fontWeight: FontWeight.w500,
                      color: Colors.white70,
                    ),
                  ),
                  const SizedBox(height: 28),
                  Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      _TutorialHint(
                        icon: Icons.arrow_back_rounded,
                        label: '모름',
                      ),
                      Container(
                        width: 1,
                        height: 44,
                        margin: const EdgeInsets.symmetric(horizontal: 32),
                        color: Colors.white24,
                      ),
                      _TutorialHint(
                        icon: Icons.arrow_forward_rounded,
                        label: '외움',
                      ),
                    ],
                  ),
                ],
              ),
            ),
            Positioned(
              left: 0,
              right: 0,
              bottom: 28,
              child: Center(
                child: TextButton(
                  onPressed: onDismissForever,
                  child: const Text(
                    '다시 보지 않기',
                    style: TextStyle(
                      fontFamily: 'Inter',
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                      color: Colors.white70,
                      decoration: TextDecoration.underline,
                      decorationColor: Colors.white70,
                    ),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _TutorialHint extends StatelessWidget {
  const _TutorialHint({required this.icon, required this.label});

  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, size: 30, color: Colors.white),
        const SizedBox(height: 8),
        Text(
          label,
          style: const TextStyle(
            fontFamily: 'Inter',
            fontSize: 15,
            fontWeight: FontWeight.w700,
            color: Colors.white,
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
    required this.wordMeaningVisible,
    required this.pronunciationVisible,
    required this.exampleVisible,
    required this.exampleMeaningVisible,
    required this.isLast,
    required this.onTap,
    required this.onToggleLike,
    required this.onOpenComments,
  });

  final Word word;
  final bool wordMeaningVisible;
  final bool pronunciationVisible;
  final bool exampleVisible;
  final bool exampleMeaningVisible;
  final bool isLast;
  final VoidCallback onTap;
  final VoidCallback onToggleLike;
  final VoidCallback onOpenComments;

  @override
  Widget build(BuildContext context) {
    final example = word.example?.trim() ?? '';
    final exampleMeaning = word.exampleMeaning?.trim() ?? '';

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
                if (word.pronunciation != null) ...[
                  AnimatedSwitcher(
                    duration: const Duration(milliseconds: 180),
                    child: pronunciationVisible
                        ? Text(
                            word.pronunciation!,
                            key: const ValueKey('pron-visible'),
                            textAlign: TextAlign.center,
                            style: TextStyle(
                              fontFamily: 'Inter',
                              fontSize: 13,
                              fontWeight: FontWeight.w500,
                              color: NyakiColors.umber.withValues(alpha: 0.55),
                            ),
                          )
                        : Text(
                            '탭하여 발음 보기',
                            key: const ValueKey('pron-hidden'),
                            textAlign: TextAlign.center,
                            style: TextStyle(
                              fontFamily: 'Inter',
                              fontSize: 12,
                              fontWeight: FontWeight.w500,
                              color: NyakiColors.taupe,
                            ),
                          ),
                  ),
                  const SizedBox(height: 8),
                ],
                AnimatedSwitcher(
                  duration: const Duration(milliseconds: 180),
                  child: wordMeaningVisible
                      ? Text(
                          word.meaning,
                          key: const ValueKey('meaning-visible'),
                          textAlign: TextAlign.center,
                          style: TextStyle(
                            fontFamily: 'Inter',
                            fontSize: 16,
                            fontWeight: FontWeight.w500,
                            color: NyakiColors.ink.withValues(alpha: 0.88),
                            height: 1.4,
                          ),
                        )
                      : Text(
                          '탭하여 뜻 보기',
                          key: const ValueKey('meaning-hidden'),
                          textAlign: TextAlign.center,
                          style: TextStyle(
                            fontFamily: 'Inter',
                            fontSize: 12,
                            fontWeight: FontWeight.w500,
                            color: NyakiColors.taupe,
                          ),
                        ),
                ),
                if (example.isNotEmpty) ...[
                  const SizedBox(height: 18),
                  _ExampleBlock(
                    example: example,
                    exampleMeaning: exampleMeaning,
                    exampleVisible: exampleVisible,
                    meaningVisible: exampleMeaningVisible,
                  ),
                ],
                const SizedBox(height: 32),
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

/// 예문 카드. [exampleVisible]이 false면 예문 자체를 힌트로 가려두고,
/// true여도 예문 뜻은 [meaningVisible]이 따로 켜져야 보인다. 둘 다 카드
/// 전체 탭(옵션으로 처음부터 켜져 있지 않은 항목만)으로 함께 공개된다.
class _ExampleBlock extends StatelessWidget {
  const _ExampleBlock({
    required this.example,
    required this.exampleMeaning,
    required this.exampleVisible,
    required this.meaningVisible,
  });

  final String example;
  final String exampleMeaning;
  final bool exampleVisible;
  final bool meaningVisible;

  @override
  Widget build(BuildContext context) {
    final hasMeaning = exampleMeaning.isNotEmpty;

    return AnimatedSwitcher(
      duration: const Duration(milliseconds: 150),
      child: !exampleVisible
          ? Text(
              '탭하여 예문 보기',
              key: const ValueKey('example-hint'),
              textAlign: TextAlign.center,
              style: TextStyle(
                fontFamily: 'Inter',
                fontSize: 12,
                fontWeight: FontWeight.w500,
                color: NyakiColors.taupe,
              ),
            )
          : Column(
              key: const ValueKey('example-visible'),
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.center,
              children: [
                Text(
                  example,
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    fontFamily: 'Inter',
                    fontSize: 15,
                    height: 1.45,
                    color: NyakiColors.ink.withValues(alpha: 0.85),
                  ),
                ),
                if (hasMeaning)
                  Padding(
                    padding: const EdgeInsets.only(top: 6),
                    // 발음·단어 뜻처럼 가려졌을 땐 힌트 문구를 보여준다 —
                    // 예전엔 여기가 통째로 안 그려져서, 예문(위)과 예문 뜻
                    // 자리(여기) 사이에 아무 표시가 없어 순서가 헷갈렸음
                    // (2026-08-31).
                    child: meaningVisible
                        ? Text(
                            exampleMeaning,
                            textAlign: TextAlign.center,
                            style: TextStyle(
                              fontFamily: 'Inter',
                              fontSize: 14,
                              height: 1.4,
                              color: NyakiColors.ink.withValues(alpha: 0.5),
                            ),
                          )
                        : Text(
                            '탭하여 예문 뜻 보기',
                            textAlign: TextAlign.center,
                            style: TextStyle(
                              fontFamily: 'Inter',
                              fontSize: 12,
                              fontWeight: FontWeight.w500,
                              color: NyakiColors.taupe,
                            ),
                          ),
                  ),
              ],
            ),
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

/// 메모(설명) 보기·작성 시트. [word_tile.dart]처럼 배지·타임스탬프 없이
/// 텍스트만 깔끔하게 보여주고, 바로 그 자리에서 수정해서 저장할 수 있다.
/// (2026-08-30) 기존엔 읽기 전용 "댓글" 스타일이었는데, 시트 안에서 바로
/// 쓰고 저장하도록 바꿈 — 예문은 카드에 직접 보이므로(`_ExampleBlock`)
/// 여기는 "설명" 필드 전용.
class _DescriptionSheet extends StatefulWidget {
  const _DescriptionSheet({required this.word, required this.onSaved});

  final Word word;
  final ValueChanged<Word> onSaved;

  @override
  State<_DescriptionSheet> createState() => _DescriptionSheetState();
}

class _DescriptionSheetState extends State<_DescriptionSheet> {
  final _controller = TextEditingController();
  // 저장된 메모(카드로 표시). 입력창(_controller)이랑 분리해서, 저장하기
  // 전까진 위 카드가 그대로 유지되게 한다(2026-08-30, 댓글 스레드 느낌).
  late String _savedDescription = widget.word.description ?? '';
  bool _saving = false;
  String? _error;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    final text = _controller.text.trim();
    if (text.isEmpty) return;

    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      final updated = await NyakiScope.of(context).updateWord(
        wordBookId: widget.word.wordBookId,
        wordId: widget.word.id,
        input: UpdateWordInput(description: text),
      );
      if (!mounted) return;
      widget.onSaved(updated);
      setState(() {
        _savedDescription = text;
        _controller.clear();
      });
    } catch (error) {
      if (!mounted) return;
      setState(() => _error = '저장에 실패했어요.');
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final sheetHeight = MediaQuery.sizeOf(context).height * (2 / 3);

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
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      const SizedBox(height: 10),
                      Center(
                        child: Container(
                          width: 40,
                          height: 4,
                          decoration: BoxDecoration(
                            color: NyakiColors.taupe.withValues(alpha: 0.7),
                            borderRadius: BorderRadius.circular(2),
                          ),
                        ),
                      ),
                      const SizedBox(height: 14),
                      const Padding(
                        padding: EdgeInsets.symmetric(horizontal: 20),
                        child: Text(
                          '메모',
                          style: TextStyle(
                            fontFamily: 'Inter',
                            fontSize: 15,
                            fontWeight: FontWeight.w700,
                            color: NyakiColors.ink,
                          ),
                        ),
                      ),
                      const SizedBox(height: 14),
                      // 저장된 메모 — 댓글처럼 흰 카드로 구분해서 보여준다.
                      Expanded(
                        child: _savedDescription.isEmpty
                            ? Center(
                                child: Text(
                                  '아직 메모가 없어요',
                                  style: TextStyle(
                                    fontFamily: 'Inter',
                                    fontSize: 14,
                                    color: NyakiColors.ink.withValues(
                                      alpha: 0.35,
                                    ),
                                  ),
                                ),
                              )
                            : SingleChildScrollView(
                                padding: const EdgeInsets.symmetric(
                                  horizontal: 20,
                                ),
                                child: Container(
                                  width: double.infinity,
                                  padding: const EdgeInsets.symmetric(
                                    horizontal: 16,
                                    vertical: 15,
                                  ),
                                  decoration: BoxDecoration(
                                    color: NyakiColors.cardBg,
                                    borderRadius: BorderRadius.circular(22),
                                  ),
                                  child: Text(
                                    _savedDescription,
                                    style: const TextStyle(
                                      fontFamily: 'Inter',
                                      fontSize: 14,
                                      height: 1.5,
                                      color: NyakiColors.ink,
                                    ),
                                  ),
                                ),
                              ),
                      ),
                      if (_error != null)
                        Padding(
                          padding: const EdgeInsets.fromLTRB(20, 8, 20, 0),
                          child: Text(
                            _error!,
                            style: const TextStyle(
                              fontFamily: 'Inter',
                              fontSize: 12,
                              color: Colors.redAccent,
                            ),
                          ),
                        ),
                      // 댓글 쓰는 란 — 항상 맨 아래 고정.
                      Padding(
                        padding: const EdgeInsets.fromLTRB(20, 10, 20, 4),
                        child: Row(
                          crossAxisAlignment: CrossAxisAlignment.end,
                          children: [
                            Expanded(
                              child: Container(
                                padding: const EdgeInsets.symmetric(
                                  horizontal: 14,
                                  vertical: 10,
                                ),
                                decoration: BoxDecoration(
                                  color: NyakiColors.cardBg,
                                  borderRadius: BorderRadius.circular(20),
                                ),
                                child: TextField(
                                  controller: _controller,
                                  maxLines: 4,
                                  minLines: 1,
                                  style: const TextStyle(
                                    fontFamily: 'Inter',
                                    fontSize: 14,
                                    height: 1.4,
                                    color: NyakiColors.ink,
                                  ),
                                  decoration: InputDecoration(
                                    border: InputBorder.none,
                                    isCollapsed: true,
                                    hintText: '메모를 남겨보세요',
                                    hintStyle: TextStyle(
                                      fontFamily: 'Inter',
                                      fontSize: 14,
                                      color: NyakiColors.ink.withValues(
                                        alpha: 0.35,
                                      ),
                                    ),
                                  ),
                                ),
                              ),
                            ),
                            const SizedBox(width: 8),
                            IconButton(
                              onPressed: _saving ? null : _save,
                              icon: _saving
                                  ? const SizedBox(
                                      width: 18,
                                      height: 18,
                                      child: CircularProgressIndicator(
                                        strokeWidth: 2,
                                      ),
                                    )
                                  : const Icon(Icons.arrow_upward_rounded),
                              style: IconButton.styleFrom(
                                backgroundColor: NyakiColors.ink,
                                foregroundColor: NyakiColors.cardBg,
                                shape: const CircleBorder(),
                              ),
                            ),
                          ],
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
