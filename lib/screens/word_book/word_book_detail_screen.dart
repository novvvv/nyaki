import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../core/error_snackbar.dart';
import '../../core/nyaki_scope.dart';
import '../../core/theme/nyaki_colors.dart';
import '../../data/repositories/vocab_repository.dart';
import '../../models/word.dart';
import '../../models/word_book.dart';
import '../../widgets/outline_add_card.dart';
import '../../widgets/word_tile.dart';
import 'add_word_screen.dart';
import 'edit_word_screen.dart';

// ===============================================
// ✨ word_book_detail_screen.dart ✨
// - 선택한 단어장 안의 단어 목록 출력 및 필터링 (세부 페이지)

// 🔗 Chain 🔗
// _openEditWord(Word word) -> edit_word_screen.dart
// ===============================================

// WordBookTab : 하단 탭에서 고를 수 있는 화면 종류
// - info : 단어장 정보 (표시할 항목은 추후 결정)
// - all : 단어장의 모든 단어
// - bookmarked : 북마크(좋아요)한 단어만
enum WordBookTab { info, all, bookmarked }

// _WordBookMenuAction : 단어장 관리 팝업 메뉴(⋯)에서 고를 수 있는 동작
// - rename : 단어장 이름 수정
// - delete : 단어장 삭제
enum _WordBookMenuAction { rename, delete }

// ✨ WordBookDetailScreen ✨
// - 단어장 목록에서 선택한 단어장의 ID를 받는다.
// - 해당 아이디를 사용해 현재 화면에 표시할 WordBook Data를 탐색한다.

class WordBookDetailScreen extends StatefulWidget {
  const WordBookDetailScreen({super.key, required this.wordBookId});
  final String wordBookId;
  @override
  State<WordBookDetailScreen> createState() => _WordBookDetailScreenState();
}

// ✨ WordBookDetailScreenState ✨
// - 현재 선택된 탭을 저장한다. (default : all)
class _WordBookDetailScreenState extends State<WordBookDetailScreen> {
  WordBookTab _tab = WordBookTab.all;

  // 이름 수정 다이얼로그 전용 컨트롤러.
  // - showDialog가 닫혀도(pop) 다이얼로그는 exit 애니메이션 동안 몇 프레임 더 컨트롤러를 참조하므로,
  //   다이얼로그가 닫히자마자 dispose하면 "used after being disposed" 에러가 난다.
  // - 화면(State) 자체가 dispose될 때만 함께 정리하도록 필드로 둔다.
  final _renameTitleController = TextEditingController();
  final _renameDescriptionController = TextEditingController();

  @override
  void dispose() {
    _renameTitleController.dispose();
    _renameDescriptionController.dispose();
    super.dispose();
  }

  // [method] _applyFilter
  // - 현재 탭에 맞는 단어만 골라낸다. (info 탭은 목록을 쓰지 않는다)
  List<Word> _applyFilter(List<Word> words) {
    switch (_tab) {
      case WordBookTab.info:
      case WordBookTab.all:
        return words;
      case WordBookTab.bookmarked:
        return words.where((word) => word.isBookmarked).toList();
    }
  }

  // [method] _openEditWord
  // - 사용자가 특정한 단어 컴포넌트를 누르면 해당 word 객체를 EditWordScreen으로 전달한다.
  void _openEditWord(Word word) {
    Navigator.of(context).push<void>(
      MaterialPageRoute<void>(
        builder: (_) => EditWordScreen(word: word),
      ),
    );
  }

  // [method] _openAddWord
  // - 리스트 끝 '단어 추가' 카드에서 호출. 지금 보고 있는 단어장을
  //   AddWordScreen의 기본 선택값으로 넘겨서 다시 고르지 않게 한다.
  void _openAddWord(String wordBookId) {
    Navigator.of(context).push<void>(
      MaterialPageRoute<void>(
        builder: (_) => AddWordScreen(initialWordBookId: wordBookId),
      ),
    );
  }

  // [method] _toggleBookmark
  // - 리스트 오른쪽 끝 북마크 아이콘. isBookmarked만 뒤집어 저장한다.
  Future<void> _toggleBookmark(Word word) async {
    try {
      await NyakiScope.of(context).updateWord(
        wordBookId: word.wordBookId,
        wordId: word.id,
        input: UpdateWordInput(isBookmarked: !word.isBookmarked),
      );
    } catch (error) {
      if (!mounted) return;
      showErrorSnackBar(context, message: '북마크에 실패했어요.', error: error);
    }
  }

  // [method] _renameWordBook
  // 🔗 Chain
  //  - WordBookListScreen (단어장 목록 화면) -> [User] WordBookTitle Tap 
  //    -> WordBookDetailScreen (wordBookId: "...") (widget.wordBookId로 저장)
  //  위치
  //  - ... 메뉴 버튼 "이름 수정"
  // [Logic]
  //  - 1. 현재 단어장의 이름/설명이 채워진 입력창 다이얼로그를 띄운다. 
  //  - 2. 사용자가 "저장"을 누르면 입력값을 받늗나. 
  //  - 3. 해당 값으로 단어장의 이름/설명을 실제로 바꾼다. (로컬DB 갱신 및 화면 즉시 반영)

  Future<void> _renameWordBook(WordBook wordBook) async {

    // 1. 입력창 초기화 - 파라미터로 받은 wordBook의 title과 description을 입력창 컨트롤러 초기값으로 넣는다.
    // (단, description의 경우는 nulld일 수 있기에 ?? ''로 빈 문자열 처리)
    _renameTitleController.text = wordBook.title;
    _renameDescriptionController.text = wordBook.description ?? '';

    // 2. AlertDialog [입력창]]
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: NyakiColors.cream,
        title: const Text(
          '단어장 이름 수정',
          style: TextStyle(
            fontFamily: 'Inter',
            fontSize: 17,
            fontWeight: FontWeight.w700,
            color: NyakiColors.ink,
          ),
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(
              controller: _renameTitleController,
              autofocus: true,
              decoration: const InputDecoration(labelText: '이름'),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _renameDescriptionController,
              decoration: const InputDecoration(labelText: '설명'),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: const Text('취소'),
          ),
          TextButton(
            onPressed: () => Navigator.of(context).pop(true),
            child: const Text('저장'),
          ),
        ],
      ),
    );

    // [Exception] Controller 내부의 텍스트를 꺼내어 .trim()으로 앞뒤 공백을 제거한다. 
    final title = _renameTitleController.text.trim();
    final description = _renameDescriptionController.text.trim();

    // [Exception] 취소를 눌렀거나 다이얼로그를 탭/뒤로가기로 닫아버린 경우 
    if (confirmed != true || !mounted) return;

    // [Exception] Title이 비어있는 경우 
    if (title.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('단어장 이름을 입력해 주세요.')),
      );
      return;
    }

    // 3. [MainLogic] NyakiScope.of(context)로 전역 VocabController를 가져와서 
    // updateWordBook Method를 호출한다. 
    try {
      await NyakiScope.of(context).updateWordBook(
        id: wordBook.id,
        title: title,
        description: description,
      );
    } catch (error) {
      if (!mounted) return;
      showErrorSnackBar(context, message: '저장에 실패했어요.', error: error);
    }
  }

  // [method] _deleteWordBook
  // 🔗 Chain
  //  - WordBookListScreen (단어장 목록 화면) -> [User] WordBookTitle Tap
  //    -> WordBookDetailScreen (wordBookId: "...") (widget.wordBookId로 저장)
  //  위치
  //  - ... 메뉴 버튼 "삭제"
  // [Logic]
  //  - 1. 삭제할지 묻는 확인 다이얼로그를 띄운다. (입력창 없이 텍스트 확인만)
  //  - 2. 사용자가 "삭제"를 누르면 deleteWordBook을 호출해 실제로 지운다. (로컬DB soft delete)
  //  - 3. 성공하면 이 상세 화면을 닫고 단어장 목록 화면으로 돌아간다.

  Future<void> _deleteWordBook(WordBook wordBook) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: NyakiColors.cream,
        title: const Text(
          '단어장 삭제',
          style: TextStyle(
            fontFamily: 'Inter',
            fontSize: 17,
            fontWeight: FontWeight.w700,
            color: NyakiColors.ink,
          ),
        ),
        content: Text(
          "'${wordBook.title}' 단어장을 삭제할까요? 안에 있는 단어도 함께 삭제됩니다.",
          style: const TextStyle(
            fontFamily: 'Inter',
            fontSize: 14,
            color: NyakiColors.ink,
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: const Text('취소'),
          ),
          TextButton(
            onPressed: () => Navigator.of(context).pop(true),
            child: const Text('삭제'),
          ),
        ],
      ),
    );

    // [Exception] 취소 or 뒤로가기로 다이어로그를 닫은 경우 예외처리
    if (confirmed != true || !mounted) return;

    // [API] Delete Call 
    try {
      await NyakiScope.of(context).deleteWordBook(wordBook.id);
      if (!mounted) return;
      Navigator.of(context).pop();
    } catch (error) {
      if (!mounted) return;
      showErrorSnackBar(context, message: '삭제에 실패했어요.', error: error);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: NyakiColors.cream,
      body: SafeArea(
        child: ListenableBuilder(
          listenable: NyakiScope.of(context),
          builder: (context, _) {
            final wordBook =
                NyakiScope.of(context).findWordBook(widget.wordBookId);

            if (wordBook == null) {
              return Center(
                child: Text(
                  '단어장을 찾을 수 없습니다.',
                  style: TextStyle(
                    fontFamily: 'Inter',
                    fontSize: 14,
                    color: NyakiColors.ink.withValues(alpha: 0.45),
                  ),
                ),
              );
            }

            final words = _applyFilter(wordBook.activeWords);
            final isAllTab = _tab == WordBookTab.all;

            return Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                _DetailHeader(
                  wordBook: wordBook,
                  onBack: () => Navigator.of(context).pop(),
                  onRename: () => _renameWordBook(wordBook),
                  onDelete: () => _deleteWordBook(wordBook),
                ),
                Padding(
                  padding: const EdgeInsets.fromLTRB(28, 12, 24, 0),
                  child: Row(
                    children: [
                      Expanded(
                        child: _FilterTabs(
                          current: _tab,
                          onChanged: (tab) => setState(() => _tab = tab),
                        ),
                      ),
                      _AddWordAction(
                        onTap: () => _openAddWord(wordBook.id),
                      ),
                    ],
                  ),
                ),
                Expanded(
                  child: _tab == WordBookTab.info
                      ? _WordBookInfoView(words: wordBook.activeWords)
                      : words.isEmpty
                          ? _EmptyWordList(
                              isAllTab: isAllTab,
                              onAddWord: () => _openAddWord(wordBook.id),
                            )
                          : ListView.separated(
                              padding:
                                  const EdgeInsets.fromLTRB(28, 8, 28, 28),
                              itemCount: words.length,
                              separatorBuilder: (_, __) =>
                                  const SizedBox(height: 6),
                              itemBuilder: (context, index) {
                                final entry = words[index];
                                return WordTile(
                                  word: entry.term,
                                  meaning: entry.meaning,
                                  pronunciation: entry.pronunciation,
                                  isBookmarked: entry.isBookmarked,
                                  onTap: () => _openEditWord(entry),
                                  onBookmarkTap: () => _toggleBookmark(entry),
                                );
                              },
                            ),
                ),
              ],
            );
          },
        ),
      ),
    );
  }
}

// ✨ DetailHeader ✨
// 뒤로가기 / ⋯ 메뉴만 남긴 얇은 상단 바 + 타이틀.
// 타이틀 20pt w600 / 부제 12pt — 한 번 27pt까지 키웠다가 되돌린 값.
class _DetailHeader extends StatelessWidget {
  const _DetailHeader({
    required this.wordBook,
    required this.onBack,
    required this.onRename,
    required this.onDelete,
  });

  final WordBook wordBook;
  final VoidCallback onBack;
  final VoidCallback onRename;
  final VoidCallback onDelete;

  @override
  Widget build(BuildContext context) {
    final description = wordBook.description?.trim();
    final subtitle = (description == null || description.isEmpty)
        ? wordBook.metaLabel
        : description;

    return Padding(
      // 좌우 20 + 안쪽 텍스트 8 = 본문 기준선 28에 맞춘다.
      padding: const EdgeInsets.fromLTRB(20, 2, 20, 0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              _IconAction(
                icon: Icons.arrow_back_ios_new_rounded,
                tooltip: '뒤로',
                onTap: onBack,
              ),
              const Spacer(),
              PopupMenuButton<_WordBookMenuAction>(
                icon: Icon(
                  Icons.more_horiz_rounded,
                  size: 18,
                  color: NyakiColors.ink.withValues(alpha: 0.4),
                ),
                tooltip: '단어장 관리',
                color: NyakiColors.cardBg,
                elevation: 2,
                shadowColor: NyakiColors.ink.withValues(alpha: 0.08),
                surfaceTintColor: Colors.transparent,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                  side: const BorderSide(color: NyakiColors.taupe),
                ),
                padding: const EdgeInsets.all(9),
                constraints: const BoxConstraints(
                  minWidth: 34,
                  minHeight: 34,
                ),
                onSelected: (action) {
                  switch (action) {
                    case _WordBookMenuAction.rename:
                      onRename();
                      break;
                    case _WordBookMenuAction.delete:
                      onDelete();
                      break;
                  }
                },
                itemBuilder: (context) => const [
                  PopupMenuItem(
                    value: _WordBookMenuAction.rename,
                    height: 40,
                    child: Text(
                      '이름 수정',
                      style: TextStyle(
                        fontFamily: 'Inter',
                        fontSize: 13,
                        fontWeight: FontWeight.w500,
                        color: NyakiColors.ink,
                      ),
                    ),
                  ),
                  PopupMenuItem(
                    value: _WordBookMenuAction.delete,
                    height: 40,
                    child: Text(
                      '삭제',
                      style: TextStyle(
                        fontFamily: 'Inter',
                        fontSize: 13,
                        fontWeight: FontWeight.w500,
                        color: NyakiColors.ink,
                      ),
                    ),
                  ),
                ],
              ),
            ],
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(8, 8, 8, 0),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  wordBook.title,
                  style: const TextStyle(
                    fontFamily: 'Inter',
                    fontSize: 20,
                    fontWeight: FontWeight.w600,
                    letterSpacing: -0.4,
                    height: 1.2,
                    color: NyakiColors.ink,
                  ),
                ),
                const SizedBox(height: 3),
                Text(
                  subtitle,
                  style: TextStyle(
                    fontFamily: 'Inter',
                    fontSize: 12,
                    fontWeight: FontWeight.w400,
                    letterSpacing: -0.1,
                    color: NyakiColors.ink.withValues(alpha: 0.38),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// 헤더의 아이콘 하나짜리 액션. 터치 영역은 34x34로 확보하고
/// 시각적으로는 아이콘만 남긴다.
class _IconAction extends StatelessWidget {
  const _IconAction({
    required this.icon,
    required this.tooltip,
    required this.onTap,
  });

  final IconData icon;
  final String tooltip;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Tooltip(
      message: tooltip,
      child: InkResponse(
        onTap: onTap,
        radius: 20,
        containedInkWell: false,
        child: Padding(
          padding: const EdgeInsets.all(9),
          child: Icon(
            icon,
            size: 16,
            color: NyakiColors.ink.withValues(alpha: 0.4),
          ),
        ),
      ),
    );
  }
}

// ✨ FilterTabs ✨
// 하단 탭바를 대체하는 상단 필터. 배경 트랙 없이 텍스트만 두고
// 선택된 것만 Obsidian w600, 나머지는 28%로 죽인다.
// (알약 칩 시안도 만들어 봤지만 기존 텍스트 탭이 낫다고 판단, 2026-08-31)
class _FilterTabs extends StatelessWidget {
  const _FilterTabs({required this.current, required this.onChanged});

  final WordBookTab current;
  final ValueChanged<WordBookTab> onChanged;

  static const Map<WordBookTab, String> _labels = {
    WordBookTab.all: '전체',
    WordBookTab.bookmarked: '북마크',
    WordBookTab.info: '정보',
  };

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        for (final entry in _labels.entries)
          Padding(
            padding: const EdgeInsets.only(right: 18),
            child: _FilterTab(
              label: entry.value,
              selected: current == entry.key,
              onTap: () => onChanged(entry.key),
            ),
          ),
      ],
    );
  }
}

class _FilterTab extends StatelessWidget {
  const _FilterTab({
    required this.label,
    required this.selected,
    required this.onTap,
  });

  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 6),
        child: AnimatedDefaultTextStyle(
          duration: const Duration(milliseconds: 150),
          curve: Curves.easeOut,
          style: TextStyle(
            fontFamily: 'Inter',
            fontSize: 12.5,
            fontWeight: selected ? FontWeight.w600 : FontWeight.w500,
            letterSpacing: -0.1,
            color: selected
                ? NyakiColors.ink
                : NyakiColors.ink.withValues(alpha: 0.28),
          ),
          child: Text(label),
        ),
      ),
    );
  }
}

// ✨ AddWordAction ✨
// 필터 탭과 같은 줄, 맨 오른쪽에 붙는 단어 추가 액션.
// 2026-08-31: 리스트 끝 카드는 단어가 많아지면 스크롤해야 닿아서
// 항상 보이는 이 자리로 옮겼다. (빈 화면에서는 여전히 카드로도 보여준다)
class _AddWordAction extends StatelessWidget {
  const _AddWordAction({required this.onTap});

  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkResponse(
      onTap: onTap,
      radius: 24,
      containedInkWell: false,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(10, 6, 4, 6),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              Icons.add_rounded,
              size: 14,
              color: NyakiColors.ink.withValues(alpha: 0.55),
            ),
            const SizedBox(width: 3),
            Text(
              '단어 추가',
              style: TextStyle(
                fontFamily: 'Inter',
                fontSize: 12,
                fontWeight: FontWeight.w600,
                letterSpacing: -0.1,
                color: NyakiColors.ink.withValues(alpha: 0.55),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ✨ EmptyWordList ✨
// 단어가 하나도 없을 때. '전체' 탭에서는 추가 카드까지 함께 보여준다.
class _EmptyWordList extends StatelessWidget {
  const _EmptyWordList({required this.isAllTab, required this.onAddWord});

  final bool isAllTab;
  final VoidCallback onAddWord;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(28, 0, 28, 72),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            isAllTab ? '아직 단어가 없어요' : '북마크한 단어가 없어요',
            textAlign: TextAlign.center,
            style: TextStyle(
              fontFamily: 'Inter',
              fontSize: 13,
              fontWeight: FontWeight.w500,
              color: NyakiColors.ink.withValues(alpha: 0.38),
            ),
          ),
          const SizedBox(height: 3),
          Text(
            isAllTab ? '첫 단어를 추가해 볼까요?' : '카드 오른쪽 북마크를 눌러 모아 보세요',
            textAlign: TextAlign.center,
            style: TextStyle(
              fontFamily: 'Inter',
              fontSize: 12,
              color: NyakiColors.ink.withValues(alpha: 0.26),
            ),
          ),
          if (isAllTab) ...[
            const SizedBox(height: 18),
            OutlineAddCard(
              label: '단어 추가',
              dense: true,
              onTap: onAddWord,
            ),
          ],
        ],
      ),
    );
  }
}

// ✨ WordBookInfoView ✨
// "정보" 탭 — 단어장 암기율 하나와 분포 곡선.
//
// 2026-08-31 점수 모델:
//  - 단어 1개 점수 = log(1 + srsIntervalDays) / log(1 + 30) × 100.
//    SM-2 간격이 1 → 3 → 8 → 20 → 50일로 지수적으로 늘어나므로 로그로 환산해야
//    단계가 20 / 40 / 64 / 89 / 100으로 고르게 벌어진다. (선형이면 첫 성공 3점)
//  - 단어장 암기율 = 그 점수들의 평균. 이름이 "단어장"이므로 분모는 단어 전체,
//    즉 아직 학습 안 한 단어는 0점으로 포함된다.
//  - 캡션(기준 설명·학습 커버리지)은 넣지 않는다. 숫자 하나와 곡선만 남긴다.
class _WordBookInfoView extends StatelessWidget {
  const _WordBookInfoView({required this.words});

  final List<Word> words;

  /// 이 간격(일)에 도달하면 만점.
  static const _masteryDays = 30;

  /// 단어 1개의 점수(0~100).
  static int _score(Word word) {
    if (word.srsIntervalDays <= 0) return 0;
    final ratio =
        math.log(1 + word.srsIntervalDays) / math.log(1 + _masteryDays);
    return (ratio.clamp(0, 1) * 100).round();
  }

  @override
  Widget build(BuildContext context) {
    if (words.isEmpty) {
      return const _InfoMessage('단어를 추가하면 암기율이 표시돼요.');
    }

    final scores = words.map(_score).toList()..sort();
    final rate = (scores.reduce((a, b) => a + b) / scores.length).round();

    return Padding(
      padding: const EdgeInsets.fromLTRB(28, 24, 28, 24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            '단어장 암기율',
            style: TextStyle(
              fontFamily: 'Inter',
              fontSize: 11.5,
              fontWeight: FontWeight.w600,
              letterSpacing: 0.2,
              color: NyakiColors.ink.withValues(alpha: 0.35),
            ),
          ),
          const SizedBox(height: 4),
          Row(
            crossAxisAlignment: CrossAxisAlignment.baseline,
            textBaseline: TextBaseline.alphabetic,
            children: [
              Text(
                '$rate',
                style: const TextStyle(
                  fontFamily: 'Inter',
                  fontSize: 32,
                  fontWeight: FontWeight.w700,
                  letterSpacing: -1,
                  height: 1.1,
                  color: NyakiColors.ink,
                ),
              ),
              const SizedBox(width: 2),
              Text(
                '%',
                style: TextStyle(
                  fontFamily: 'Inter',
                  fontSize: 15,
                  fontWeight: FontWeight.w600,
                  color: NyakiColors.ink.withValues(alpha: 0.4),
                ),
              ),
            ],
          ),
          const SizedBox(height: 26),
          SizedBox(
            height: 132,
            width: double.infinity,
            child: CustomPaint(
              painter: _ScoreCurvePainter(scores: scores),
            ),
          ),
        ],
      ),
    );
  }
}

/// 정보 탭에서 점수를 못 그리는 상황의 안내 문구.
class _InfoMessage extends StatelessWidget {
  const _InfoMessage(this.text);

  final String text;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(28, 0, 28, 72),
      child: Center(
        child: Text(
          text,
          textAlign: TextAlign.center,
          style: TextStyle(
            fontFamily: 'Inter',
            fontSize: 12.5,
            height: 1.5,
            color: NyakiColors.ink.withValues(alpha: 0.38),
          ),
        ),
      ),
    );
  }
}

/// 낮은 점수부터 정렬한 단어 점수(0~100)를 부드러운 곡선으로 그린다.
///
/// 2026-08-31: 격자선·축 라벨·평균 점선을 모두 걷어냈다. 남긴 것은
/// 바닥 헤어라인 하나, 곡선, 그 아래 옅은 그라데이션 면뿐이다.
/// 점이 적을 때(<=12)만 각 단어 위치에 작은 점을 찍어 개수를 읽게 한다.
class _ScoreCurvePainter extends CustomPainter {
  _ScoreCurvePainter({required this.scores});

  /// 오름차순 정렬된 0~100 점수.
  final List<int> scores;

  /// 점을 찍어 줄 최대 개수. 이보다 많으면 곡선만 남긴다.
  static const _dotLimit = 12;

  @override
  void paint(Canvas canvas, Size size) {
    if (scores.isEmpty) return;

    // 곡선이 위아래로 잘리지 않게 상하 여백을 둔다.
    const topPad = 10.0;
    const bottomPad = 6.0;
    final chart = Rect.fromLTWH(
      2,
      topPad,
      size.width - 4,
      size.height - topPad - bottomPad,
    );

    // 바닥 헤어라인 — 0점 기준선 역할만 한다.
    canvas.drawLine(
      Offset(0, chart.bottom),
      Offset(size.width, chart.bottom),
      Paint()
        ..color = NyakiColors.taupe
        ..strokeWidth = 1,
    );

    double yFor(int score) => chart.bottom - (score / 100) * chart.height;

    final points = <Offset>[
      for (var i = 0; i < scores.length; i++)
        Offset(
          scores.length == 1
              ? chart.center.dx
              : chart.left + chart.width * (i / (scores.length - 1)),
          yFor(scores[i]),
        ),
    ];

    final linePath = scores.length == 1
        ? (Path()
          ..moveTo(chart.left, points.first.dy)
          ..lineTo(chart.right, points.first.dy))
        : _smoothPath(points, chart.top, chart.bottom);

    // 곡선 아래 면 — Obsidian 10% → 0% 그라데이션.
    final fillPath = Path.from(linePath)
      ..lineTo(scores.length == 1 ? chart.right : points.last.dx, chart.bottom)
      ..lineTo(scores.length == 1 ? chart.left : points.first.dx, chart.bottom)
      ..close();
    canvas.drawPath(
      fillPath,
      Paint()
        ..shader = LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [
            NyakiColors.ink.withValues(alpha: 0.10),
            NyakiColors.ink.withValues(alpha: 0),
          ],
        ).createShader(chart),
    );

    canvas.drawPath(
      linePath,
      Paint()
        ..color = NyakiColors.ink
        ..style = PaintingStyle.stroke
        ..strokeWidth = 2
        ..strokeCap = StrokeCap.round
        ..strokeJoin = StrokeJoin.round,
    );

    if (scores.length <= _dotLimit) {
      final dot = Paint()..color = NyakiColors.ink;
      for (final point in points) {
        canvas.drawCircle(point, 2.5, dot);
      }
    }
  }

  /// Catmull-Rom 스플라인을 3차 베지어로 옮긴다. 제어점의 y는 차트
  /// 위아래로 튀지 않게 잘라낸다. (점수 0/100 근처에서 곡선이 넘치는 것 방지)
  Path _smoothPath(List<Offset> pts, double top, double bottom) {
    final path = Path()..moveTo(pts.first.dx, pts.first.dy);
    for (var i = 0; i < pts.length - 1; i++) {
      final p0 = i == 0 ? pts[i] : pts[i - 1];
      final p1 = pts[i];
      final p2 = pts[i + 1];
      final p3 = i + 2 < pts.length ? pts[i + 2] : p2;

      final c1 = Offset(
        p1.dx + (p2.dx - p0.dx) / 6,
        // num.clamp는 num을 돌려주므로 Offset에 넣기 전 toDouble()이 필요하다.
        (p1.dy + (p2.dy - p0.dy) / 6).clamp(top, bottom).toDouble(),
      );
      final c2 = Offset(
        p2.dx - (p3.dx - p1.dx) / 6,
        (p2.dy - (p3.dy - p1.dy) / 6).clamp(top, bottom).toDouble(),
      );
      path.cubicTo(c1.dx, c1.dy, c2.dx, c2.dy, p2.dx, p2.dy);
    }
    return path;
  }

  // listEquals는 foundation.dart 소속이라 material.dart만으로는 안 잡힌다.
  // import를 늘리는 대신 직접 비교한다.
  @override
  bool shouldRepaint(covariant _ScoreCurvePainter oldDelegate) {
    final old = oldDelegate.scores;
    if (old.length != scores.length) return true;
    for (var i = 0; i < scores.length; i++) {
      if (old[i] != scores[i]) return true;
    }
    return false;
  }
}
