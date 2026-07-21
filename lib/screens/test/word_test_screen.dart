import 'package:flutter/material.dart';
import '../../core/nyaki_scope.dart';
import '../../core/theme/nyaki_colors.dart';
import '../../models/word_book.dart';
import 'word_test_session_screen.dart';

// ===============================================
// ✨ WordTestScreen ✨
// - 단어장 테스트 시작 전 단어장 설정 및 시작 전 화면 세팅을 담당한다.
// ✨ Flow ✨
// 단어장 선택 -> 테스트 옵션 설정 -> 테스트 화면 이동
// ===============================================

class WordTestScreen extends StatefulWidget {
  const WordTestScreen({super.key});
  @override
  State<WordTestScreen> createState() => _WordTestScreenState();
}

class _WordTestScreenState extends State<WordTestScreen> {
  // _selectedWordBooksIds -> 선택된 단어의 객체 전체가 아닌 ID만 저장
  // ex) _selectedWordBookIds = {'book-1', 'book-3', ...}
  final Set<String> _selectedWordBookIds = <String>{};

  // _reslovedSelected -> ID 목록을 실제 WordBook 객체 목록으로 변환
  // ex) books = [ WordBook(id: 'book-1', title: '기초 영어')]
  List<WordBook> _resolveSelected(List<WordBook> books) {
    return books
        .where((book) => _selectedWordBookIds.contains(book.id))
        .toList(growable: false);
  }

  // _toggleSelection -> 단어장을 누를 때 선택 상태를 반전한다.
  void _toggleSelection(String wordBookId) {
    // 단어장의 상태를 체크하여 selectedWordBooksIds에 단어장 정보를 추가/삭제
    setState(() {
      if (!_selectedWordBookIds.add(wordBookId)) {
        _selectedWordBookIds.remove(wordBookId);
      }
    });
  }

  Future<void> _startTest(List<WordBook> wordBooks) async {
    final options = await showModalBottomSheet<WordTestOptions>(
      context: context,
      backgroundColor: NyakiColors.cream,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (_) => _TestOptionsSheet(wordBooks: wordBooks),
    );
    if (options == null || !mounted) return;

    Navigator.of(context).push<void>(
      MaterialPageRoute<void>(
        builder: (_) => WordTestSessionScreen(
          wordBooks: wordBooks,
          options: options,
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: NyakiScope.of(context),
      builder: (context, _) {
        final books = NyakiScope.of(context).wordBooks;
        final selected = _resolveSelected(books);
        final totalWords =
            selected.fold<int>(0, (sum, book) => sum + book.activeWords.length);
        final canStart = totalWords > 0;

        return Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const Padding(
              padding: EdgeInsets.fromLTRB(28, 20, 28, 4),
              child: Text(
                '테스트',
                style: TextStyle(
                  fontFamily: 'Inter',
                  fontSize: 24,
                  fontWeight: FontWeight.w600,
                  letterSpacing: -0.3,
                  color: NyakiColors.ink,
                ),
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(28, 0, 28, 16),
              child: Text(
                '테스트할 단어장을 선택합니다.',
                style: TextStyle(
                  fontFamily: 'Inter',
                  fontSize: 14,
                  color: NyakiColors.ink.withValues(alpha: 0.45),
                ),
              ),
            ),
            Expanded(
              child: books.isEmpty
                  ? Center(
                      child: Text(
                        '테스트할 단어장이 없어요.',
                        style: TextStyle(
                          fontFamily: 'Inter',
                          fontSize: 14,
                          color: NyakiColors.ink.withValues(alpha: 0.42),
                        ),
                      ),
                    )
                  : ListView.separated(
                      padding: const EdgeInsets.fromLTRB(28, 0, 28, 16),
                      itemCount: books.length,
                      separatorBuilder: (_, __) => Divider(
                        height: 1,
                        thickness: 1,
                        color: NyakiColors.ink.withValues(alpha: 0.06),
                      ),
                      itemBuilder: (context, index) {
                        final book = books[index];
                        return _TestBookTile(
                          title: book.title,
                          meta: book.metaLabel,
                          selected: _selectedWordBookIds.contains(book.id),
                          onTap: () => _toggleSelection(book.id),
                        );
                      },
                    ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(28, 0, 28, 24),
              child: SizedBox(
                height: 52,
                child: FilledButton(
                  onPressed: canStart ? () => _startTest(selected) : null,
                  style: FilledButton.styleFrom(
                    backgroundColor: NyakiColors.ink,
                    foregroundColor: NyakiColors.cream,
                    disabledBackgroundColor:
                        NyakiColors.ink.withValues(alpha: 0.15),
                    disabledForegroundColor:
                        NyakiColors.cream.withValues(alpha: 0.8),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(8),
                    ),
                  ),
                  child: Text(
                    selected.isEmpty
                        ? '단어장을 선택해 주세요'
                        : totalWords == 0
                            ? '단어가 없어요'
                            : selected.length == 1
                                ? '테스트 시작 · $totalWords단어'
                                : '테스트 시작 · ${selected.length}권 $totalWords단어',
                    style: const TextStyle(
                      fontFamily: 'Inter',
                      fontSize: 15,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
              ),
            ),
          ],
        );
      },
    );
  }
}

/// 테스트 시작 전 옵션을 고르는 바텀 시트.
class _TestOptionsSheet extends StatefulWidget {
  const _TestOptionsSheet({required this.wordBooks});

  final List<WordBook> wordBooks;

  @override
  State<_TestOptionsSheet> createState() => _TestOptionsSheetState();
}

class _TestOptionsSheetState extends State<_TestOptionsSheet> {
  WordTestFilter _filter = WordTestFilter.unmemorizedOnly;
  bool _hideMeaning = true;
  bool _shuffle = false;

  int get _targetCount =>
      WordTestOptions(filter: _filter).selectWords(widget.wordBooks).length;

  @override
  Widget build(BuildContext context) {
    final count = _targetCount;

    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(28, 24, 28, 24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const Text(
              '테스트 설정',
              style: TextStyle(
                fontFamily: 'Inter',
                fontSize: 17,
                fontWeight: FontWeight.w700,
                color: NyakiColors.ink,
              ),
            ),
            const SizedBox(height: 20),
            Text(
              '대상 단어',
              style: TextStyle(
                fontFamily: 'Inter',
                fontSize: 12,
                fontWeight: FontWeight.w600,
                color: NyakiColors.ink.withValues(alpha: 0.45),
              ),
            ),
            const SizedBox(height: 10),
            Row(
              children: [
                _FilterChip(
                  label: '전체',
                  selected: _filter == WordTestFilter.all,
                  onTap: () => setState(() => _filter = WordTestFilter.all),
                ),
                const SizedBox(width: 8),
                _FilterChip(
                  label: '모름만',
                  selected: _filter == WordTestFilter.unmemorizedOnly,
                  onTap: () => setState(
                    () => _filter = WordTestFilter.unmemorizedOnly,
                  ),
                ),
                const SizedBox(width: 8),
                _FilterChip(
                  label: '외움만',
                  selected: _filter == WordTestFilter.memorizedOnly,
                  onTap: () => setState(
                    () => _filter = WordTestFilter.memorizedOnly,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 22),
            _OptionToggleRow(
              label: '뜻 가리기',
              description: '단어만 먼저 보여주고 탭하면 공개',
              value: _hideMeaning,
              onChanged: (value) => setState(() => _hideMeaning = value),
            ),
            const SizedBox(height: 6),
            _OptionToggleRow(
              label: '순서 섞기',
              description: '단어를 무작위 순서로 출제',
              value: _shuffle,
              onChanged: (value) => setState(() => _shuffle = value),
            ),
            const SizedBox(height: 22),
            SizedBox(
              height: 50,
              child: FilledButton(
                onPressed: count == 0
                    ? null
                    : () => Navigator.of(context).pop(
                          WordTestOptions(
                            filter: _filter,
                            hideMeaning: _hideMeaning,
                            shuffle: _shuffle,
                          ),
                        ),
                style: FilledButton.styleFrom(
                  backgroundColor: NyakiColors.ink,
                  foregroundColor: NyakiColors.cream,
                  disabledBackgroundColor:
                      NyakiColors.ink.withValues(alpha: 0.15),
                  disabledForegroundColor:
                      NyakiColors.cream.withValues(alpha: 0.8),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(10),
                  ),
                ),
                child: Text(
                  count == 0 ? '해당하는 단어가 없어요' : '시작 · $count단어',
                  style: const TextStyle(
                    fontFamily: 'Inter',
                    fontSize: 15,
                    fontWeight: FontWeight.w600,
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

class _FilterChip extends StatelessWidget {
  const _FilterChip({
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
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 9),
          child: Text(
            label,
            style: TextStyle(
              fontFamily: 'Inter',
              fontSize: 13,
              fontWeight: FontWeight.w600,
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

class _OptionToggleRow extends StatelessWidget {
  const _OptionToggleRow({
    required this.label,
    required this.description,
    required this.value,
    required this.onChanged,
  });

  final String label;
  final String description;
  final bool value;
  final ValueChanged<bool> onChanged;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                label,
                style: const TextStyle(
                  fontFamily: 'Inter',
                  fontSize: 14,
                  fontWeight: FontWeight.w600,
                  color: NyakiColors.ink,
                ),
              ),
              const SizedBox(height: 2),
              Text(
                description,
                style: TextStyle(
                  fontFamily: 'Inter',
                  fontSize: 12,
                  fontWeight: FontWeight.w400,
                  color: NyakiColors.ink.withValues(alpha: 0.42),
                ),
              ),
            ],
          ),
        ),
        Switch(
          value: value,
          onChanged: onChanged,
          activeColor: NyakiColors.cream,
          activeTrackColor: NyakiColors.ink,
          inactiveThumbColor: NyakiColors.ink.withValues(alpha: 0.4),
          inactiveTrackColor: NyakiColors.ink.withValues(alpha: 0.08),
        ),
      ],
    );
  }
}

class _TestBookTile extends StatelessWidget {
  const _TestBookTile({
    required this.title,
    required this.meta,
    required this.selected,
    required this.onTap,
  });

  final String title;
  final String meta;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 14),
        child: Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: const TextStyle(
                      fontFamily: 'Inter',
                      fontSize: 14,
                      fontWeight: FontWeight.w500,
                      color: NyakiColors.ink,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    meta,
                    style: TextStyle(
                      fontFamily: 'Inter',
                      fontSize: 12,
                      color: NyakiColors.ink.withValues(alpha: 0.4),
                    ),
                  ),
                ],
              ),
            ),
            AnimatedContainer(
              duration: const Duration(milliseconds: 140),
              width: 20,
              height: 20,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: selected ? NyakiColors.ink : Colors.transparent,
                border: Border.all(
                  color: NyakiColors.ink.withValues(
                    alpha: selected ? 1 : 0.18,
                  ),
                ),
              ),
              child: selected
                  ? const Icon(
                      Icons.check_rounded,
                      size: 14,
                      color: NyakiColors.cream,
                    )
                  : null,
            ),
          ],
        ),
      ),
    );
  }
}
