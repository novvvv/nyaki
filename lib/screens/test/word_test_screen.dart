import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

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
  static const _selectedIdsKey = 'test_selected_word_book_ids';

  // _selectedWordBooksIds -> 선택된 단어의 객체 전체가 아닌 ID만 저장
  // ex) _selectedWordBookIds = {'book-1', 'book-3', ...}
  final Set<String> _selectedWordBookIds = <String>{};
  bool _selectionLoaded = false;

  @override
  void initState() {
    super.initState();
    _restoreSelection();
  }

  Future<void> _restoreSelection() async {
    final prefs = await SharedPreferences.getInstance();
    final saved = prefs.getStringList(_selectedIdsKey) ?? const <String>[];
    if (!mounted) return;
    setState(() {
      _selectedWordBookIds
        ..clear()
        ..addAll(saved);
      _selectionLoaded = true;
    });
  }

  Future<void> _persistSelection() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setStringList(
      _selectedIdsKey,
      _selectedWordBookIds.toList(growable: false),
    );
  }

  // _reslovedSelected -> ID 목록을 실제 WordBook 객체 목록으로 변환
  // ex) books = [ WordBook(id: 'book-1', title: '기초 영어')]
  List<WordBook> _resolveSelected(List<WordBook> books) {
    return books
        .where((book) => _selectedWordBookIds.contains(book.id))
        .toList(growable: false);
  }

  void _pruneMissingBooks(List<WordBook> books) {
    if (!_selectionLoaded || _selectedWordBookIds.isEmpty) return;
    final existing = books.map((book) => book.id).toSet();
    final removed = _selectedWordBookIds.difference(existing);
    if (removed.isEmpty) return;

    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      setState(() => _selectedWordBookIds.removeAll(removed));
      _persistSelection();
    });
  }

  // _toggleSelection -> 단어장을 누를 때 선택 상태를 반전한다.
  void _toggleSelection(String wordBookId) {
    setState(() {
      if (!_selectedWordBookIds.add(wordBookId)) {
        _selectedWordBookIds.remove(wordBookId);
      }
    });
    _persistSelection();
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
        _pruneMissingBooks(books);
        final selected = _resolveSelected(books);
        // 시작 버튼의 숫자는 "가진 단어 수"가 아니라 "오늘 복습할 단어 수"다.
        final dueWords = selected.fold<int>(0, (sum, book) => sum + book.dueCount);
        final canStart = dueWords > 0;

        return ColoredBox(
          color: NyakiColors.cream,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Expanded(
                child: books.isEmpty
                    ? Center(
                        child: Text(
                          '단어장이 없습니다.',
                          style: TextStyle(
                            fontFamily: 'Inter',
                            fontSize: 14,
                            color: NyakiColors.ink.withValues(alpha: 0.4),
                          ),
                        ),
                      )
                    : ListView.separated(
                        padding: const EdgeInsets.fromLTRB(28, 20, 28, 16),
                        itemCount: books.length,
                        separatorBuilder: (_, __) => const Divider(
                          height: 1,
                          thickness: 1,
                          color: NyakiColors.softDune,
                        ),
                        itemBuilder: (context, index) {
                          final book = books[index];
                          return _TestBookTile(
                            title: book.title,
                            meta: '${book.metaLabel} · 오늘 ${book.dueCount}개',
                            selected: _selectedWordBookIds.contains(book.id),
                            onTap: () => _toggleSelection(book.id),
                          );
                        },
                      ),
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(28, 8, 28, 20),
                child: SizedBox(
                  height: 44,
                  width: double.infinity,
                  child: FilledButton(
                    onPressed: canStart ? () => _startTest(selected) : null,
                    style: FilledButton.styleFrom(
                      backgroundColor: NyakiColors.ink,
                      foregroundColor: NyakiColors.cream,
                      disabledBackgroundColor:
                          NyakiColors.ink.withValues(alpha: 0.12),
                      disabledForegroundColor:
                          NyakiColors.ink.withValues(alpha: 0.35),
                      elevation: 0,
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(8),
                      ),
                    ),
                    child: Text(
                      selected.isEmpty
                          ? '단어장을 선택하세요'
                          : canStart
                              ? '시작 · $dueWords'
                              : '오늘 복습할 단어가 없어요',
                      style: const TextStyle(
                        fontFamily: 'Inter',
                        fontSize: 14,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                ),
              ),
            ],
          ),
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
  static const _dailyLimitKey = 'test_daily_limit';

  bool _hideMeaning = true;
  bool _shuffle = false;
  int _limit = 1;
  bool _limitLoaded = false;
  late final TextEditingController _limitController;

  // 대상 단어는 SM-2가 정한다 (srs_due_at이 지난 단어). 사용자가 고르는 건
  // "그중 몇 개를 오늘 풀지"뿐이다.
  int get _dueCount =>
      const WordTestOptions().selectWords(widget.wordBooks).length;

  @override
  void initState() {
    super.initState();
    _limitController = TextEditingController();
    _restoreLimit();
  }

  @override
  void dispose() {
    _limitController.dispose();
    super.dispose();
  }

  // 마지막으로 고른 개수를 기억해뒀다가 다음에 열 때 그대로 보여준다.
  // (오늘 due 개수가 그때보다 줄었으면 줄어든 개수로 clamp)
  Future<void> _restoreLimit() async {
    final prefs = await SharedPreferences.getInstance();
    final saved = prefs.getInt(_dailyLimitKey);
    final count = _dueCount;
    if (!mounted) return;
    setState(() {
      _limit = count == 0 ? 0 : (saved ?? count).clamp(1, count).toInt();
      _limitController.text = '$_limit';
      _limitLoaded = true;
    });
  }

  Future<void> _persistLimit(int value) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setInt(_dailyLimitKey, value);
  }

  void _setLimit(int value) {
    final count = _dueCount;
    if (count == 0) return;
    final clamped = value.clamp(1, count).toInt();
    setState(() {
      _limit = clamped;
      _limitController.text = '$_limit';
    });
    _persistLimit(clamped);
  }

  @override
  Widget build(BuildContext context) {
    final count = _dueCount;

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
                color: NyakiColors.umber.withValues(alpha: 0.65),
              ),
            ),
            const SizedBox(height: 6),
            Text(
              count == 0
                  ? '오늘 복습할 단어가 없어요'
                  : '복습 주기가 돌아온 $count단어',
              style: TextStyle(
                fontFamily: 'Inter',
                fontSize: 13,
                fontWeight: FontWeight.w500,
                color: NyakiColors.ink.withValues(alpha: 0.7),
              ),
            ),
            if (count > 1 && _limitLoaded) ...[
              const SizedBox(height: 16),
              _DailyLimitSlider(
                count: count,
                value: _limit,
                controller: _limitController,
                onChanged: _setLimit,
              ),
            ],
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
                onPressed: count == 0 || !_limitLoaded
                    ? null
                    : () => Navigator.of(context).pop(
                          WordTestOptions(
                            hideMeaning: _hideMeaning,
                            shuffle: _shuffle,
                            dailyLimit: _limit,
                          ),
                        ),
                style: FilledButton.styleFrom(
                  backgroundColor: NyakiColors.ink,
                  foregroundColor: NyakiColors.cream,
                  disabledBackgroundColor: NyakiColors.softDune,
                  disabledForegroundColor:
                      NyakiColors.umber.withValues(alpha: 0.45),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(10),
                  ),
                ),
                child: Text(
                  count == 0 ? '해당하는 단어가 없어요' : '시작 · $_limit단어',
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

/// 한 번에 진행할 단어 개수를 고르는 슬라이더. 오른쪽 숫자 칸은 직접 입력도 된다.
class _DailyLimitSlider extends StatelessWidget {
  const _DailyLimitSlider({
    required this.count,
    required this.value,
    required this.controller,
    required this.onChanged,
  });

  final int count;
  final int value;
  final TextEditingController controller;
  final ValueChanged<int> onChanged;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Text(
              '한 번에 진행할 개수',
              style: TextStyle(
                fontFamily: 'Inter',
                fontSize: 12,
                fontWeight: FontWeight.w600,
                color: NyakiColors.umber.withValues(alpha: 0.65),
              ),
            ),
            const Spacer(),
            SizedBox(
              width: 48,
              height: 30,
              child: TextField(
                controller: controller,
                textAlign: TextAlign.center,
                keyboardType: TextInputType.number,
                textInputAction: TextInputAction.done,
                style: const TextStyle(
                  fontFamily: 'Inter',
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                  color: NyakiColors.ink,
                ),
                decoration: InputDecoration(
                  isDense: true,
                  contentPadding: const EdgeInsets.symmetric(vertical: 6),
                  filled: true,
                  fillColor: NyakiColors.softDune,
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(8),
                    borderSide: BorderSide.none,
                  ),
                ),
                onSubmitted: (text) =>
                    onChanged(int.tryParse(text) ?? value),
              ),
            ),
          ],
        ),
        SliderTheme(
          data: SliderTheme.of(context).copyWith(
            trackHeight: 3,
            thumbShape: const RoundSliderThumbShape(enabledThumbRadius: 8),
            overlayShape: const RoundSliderOverlayShape(overlayRadius: 16),
          ),
          child: Slider(
            value: value.toDouble().clamp(1, count.toDouble()).toDouble(),
            min: 1,
            max: count.toDouble(),
            divisions: count - 1,
            activeColor: NyakiColors.umber,
            inactiveColor: NyakiColors.softDune,
            onChanged: (v) => onChanged(v.round()),
          ),
        ),
      ],
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
                  color: NyakiColors.umber.withValues(alpha: 0.55),
                ),
              ),
            ],
          ),
        ),
        Switch(
          value: value,
          onChanged: onChanged,
          activeColor: NyakiColors.cream,
          activeTrackColor: NyakiColors.umber,
          inactiveThumbColor: NyakiColors.taupe,
          inactiveTrackColor: NyakiColors.softDune,
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
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      fontFamily: 'Inter',
                      fontSize: 14,
                      fontWeight: selected ? FontWeight.w600 : FontWeight.w500,
                      color: NyakiColors.ink,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    meta,
                    style: TextStyle(
                      fontFamily: 'Inter',
                      fontSize: 12,
                      color: NyakiColors.ink.withValues(alpha: 0.35),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(width: 12),
            Icon(
              selected
                  ? Icons.check_circle_rounded
                  : Icons.circle_outlined,
              size: 20,
              color: selected
                  ? NyakiColors.ink
                  : NyakiColors.taupe,
            ),
          ],
        ),
      ),
    );
  }
}
