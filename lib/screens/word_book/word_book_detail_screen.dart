import 'package:flutter/material.dart';

import '../../core/nyaki_scope.dart';
import '../../core/theme/nyaki_colors.dart';
import '../../models/word.dart';
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
