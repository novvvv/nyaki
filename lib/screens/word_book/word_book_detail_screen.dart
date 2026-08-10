import 'package:flutter/material.dart';

import '../../core/error_snackbar.dart';
import '../../core/nyaki_scope.dart';
import '../../core/theme/nyaki_colors.dart';
import '../../models/word.dart';
import '../../models/word_book.dart';
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
            final dividerColor = NyakiColors.softDune;

            return Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Padding(
                  padding: const EdgeInsets.fromLTRB(28, 16, 28, 0),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          IconButton(
                            onPressed: () => Navigator.of(context).pop(),
                            icon: const Icon(Icons.arrow_back_ios_new_rounded),
                            iconSize: 18,
                            color: NyakiColors.ink.withValues(alpha: 0.5),
                            tooltip: '뒤로',
                            padding: EdgeInsets.zero,
                            constraints: const BoxConstraints(
                              minWidth: 32,
                              minHeight: 32,
                            ),
                          ),
                          const Spacer(),

                          // 버튼 -> 누르면 메뉴 펼침 
                          PopupMenuButton<_WordBookMenuAction>(
                            icon: Icon(
                              Icons.more_horiz_rounded,
                              color: NyakiColors.ink.withValues(alpha: 0.5),
                            ),
                            tooltip: '단어장 관리',
                            color: NyakiColors.cream,
                            padding: EdgeInsets.zero,
                            constraints: const BoxConstraints(
                              minWidth: 32,
                              minHeight: 32,
                            ),
                            onSelected: (action) {
                              switch (action) {
                                case _WordBookMenuAction.rename:
                                  _renameWordBook(wordBook);
                                  break;
                                case _WordBookMenuAction.delete:
                                  _deleteWordBook(wordBook);
                                  break;
                              }
                            },
                            itemBuilder: (context) => const [
                              PopupMenuItem(
                                value: _WordBookMenuAction.rename,
                                child: Text('이름 수정'),
                              ),
                              PopupMenuItem(
                                value: _WordBookMenuAction.delete,
                                child: Text('삭제'),
                              ),
                            ],
                          ),
                          const SizedBox(width: 8),
                          TextButton(
                            onPressed: () {
                              Navigator.of(context).push<void>(
                                MaterialPageRoute<void>(
                                  builder: (_) => const AddWordScreen(),
                                ),
                              );
                            },
                            style: TextButton.styleFrom(
                              foregroundColor: NyakiColors.cream,
                              backgroundColor: NyakiColors.ink,
                              padding: const EdgeInsets.symmetric(
                                horizontal: 14,
                                vertical: 8,
                              ),
                              minimumSize: Size.zero,
                              tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(8),
                              ),
                            ),
                            child: const Text(
                              '단어 추가',
                              style: TextStyle(
                                fontFamily: 'Inter',
                                fontSize: 14,
                                fontWeight: FontWeight.w500,
                              ),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 8),
                      Text(
                        wordBook.title,
                        style: const TextStyle(
                          fontFamily: 'Inter',
                          fontSize: 24,
                          fontWeight: FontWeight.w600,
                          letterSpacing: -0.3,
                          color: NyakiColors.ink,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        wordBook.description ?? wordBook.metaLabel,
                        style: TextStyle(
                          fontFamily: 'Inter',
                          fontSize: 14,
                          color: NyakiColors.ink.withValues(alpha: 0.45),
                        ),
                      ),
                    ],
                  ),
                ),
                Expanded(
                  child: _tab == WordBookTab.info
                      ? const _WordBookInfoView()
                      : words.isEmpty
                          ? Center(
                              child: Text(
                                _tab == WordBookTab.all
                                    ? '단어가 없습니다.'
                                    : '북마크한 단어가 없어요.',
                                style: TextStyle(
                                  fontFamily: 'Inter',
                                  fontSize: 14,
                                  color: NyakiColors.ink.withValues(alpha: 0.4),
                                ),
                              ),
                            )
                          : ListView.separated(
                              padding:
                                  const EdgeInsets.fromLTRB(28, 12, 28, 12),
                              itemCount: words.length,
                              separatorBuilder: (_, __) => Divider(
                                height: 1,
                                thickness: 1,
                                color: dividerColor,
                              ),
                              itemBuilder: (context, index) {
                                final entry = words[index];
                                return WordTile(
                                  word: entry.term,
                                  meaning: entry.meaning,
                                  onTap: () => _openEditWord(entry),
                                );
                              },
                            ),
                ),
                Container(
                  decoration: const BoxDecoration(
                    border: Border(top: BorderSide(color: NyakiColors.muted)),
                  ),
                  padding: const EdgeInsets.only(top: 12, bottom: 14),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceAround,
                    children: [
                      _FilterTab(
                        label: '단어장 정보',
                        selected: _tab == WordBookTab.info,
                        onTap: () => setState(() => _tab = WordBookTab.info),
                      ),
                      _FilterTab(
                        label: '전체',
                        selected: _tab == WordBookTab.all,
                        onTap: () => setState(() => _tab = WordBookTab.all),
                      ),
                      _FilterTab(
                        label: '북마크',
                        selected: _tab == WordBookTab.bookmarked,
                        onTap: () =>
                            setState(() => _tab = WordBookTab.bookmarked),
                      ),
                    ],
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

// ✨ WordBookInfoView ✨
// - "단어장 정보" 탭의 내용. 어떤 항목을 넣을지는 아직 정하지 않았다.
class _WordBookInfoView extends StatelessWidget {
  const _WordBookInfoView();

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Text(
        '단어장 정보는 준비 중이에요.',
        style: TextStyle(
          fontFamily: 'Inter',
          fontSize: 14,
          color: NyakiColors.ink.withValues(alpha: 0.4),
        ),
      ),
    );
  }
}

// ✨ FilterTab ✨
// Parameter
// - label : 단어장 정보, 전체, 북마크 (하단 탭 이름)
// - selected : 현재 데이터 선택 여부
// - onTap : 단어 컴포넌트 클릭 시 실행 함수 리스너

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
    final style = TextStyle(
      fontSize: 11,
      fontWeight: selected ? FontWeight.w600 : FontWeight.w500,
      color: NyakiColors.ink.withValues(alpha: selected ? 1 : 0.3),
    );

    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(8),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (selected) ...[
              Container(
                width: 4,
                height: 4,
                decoration: BoxDecoration(
                  color: NyakiColors.ink,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
              const SizedBox(height: 4),
            ] else
              const SizedBox(height: 8),
            Text(label, style: style),
          ],
        ),
      ),
    );
  }
}
