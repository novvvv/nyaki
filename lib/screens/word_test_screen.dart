import 'package:flutter/material.dart';

import '../core/nyaki_scope.dart';
import '../core/theme/nyaki_colors.dart';
import '../models/word_book.dart';
import 'word_test_session_screen.dart';

class WordTestScreen extends StatefulWidget {
  const WordTestScreen({super.key});

  @override
  State<WordTestScreen> createState() => _WordTestScreenState();
}

class _WordTestScreenState extends State<WordTestScreen> {
  String? _selectedWordBookId;

  WordBook? _resolveSelected(List<WordBook> books) {
    if (books.isEmpty) return null;
    for (final book in books) {
      if (book.id == _selectedWordBookId) return book;
    }
    return books.first;
  }

  void _startTest(WordBook wordBook) {
    Navigator.of(context).push<void>(
      MaterialPageRoute<void>(
        builder: (_) => WordTestSessionScreen(wordBook: wordBook),
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
        final canStart = selected != null && selected.activeWords.isNotEmpty;

        return Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const Padding(
              padding: EdgeInsets.fromLTRB(28, 18, 28, 6),
              child: Text(
                '단어 테스트',
                style: TextStyle(
                  fontFamily: 'Inter',
                  fontSize: 22,
                  fontWeight: FontWeight.w700,
                  color: NyakiColors.ink,
                ),
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(28, 0, 28, 24),
              child: Text(
                '테스트할 단어장을 선택해 주세요.',
                style: TextStyle(
                  fontFamily: 'Inter',
                  fontSize: 13,
                  fontWeight: FontWeight.w400,
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
                      separatorBuilder: (_, __) => const SizedBox(height: 12),
                      itemBuilder: (context, index) {
                        final book = books[index];
                        final isSelected = book.id == selected?.id;
                        return _TestBookTile(
                          title: book.title,
                          meta: book.metaLabel,
                          selected: isSelected,
                          onTap: () {
                            setState(() => _selectedWordBookId = book.id);
                          },
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
                      borderRadius: BorderRadius.circular(12),
                    ),
                  ),
                  child: Text(
                    selected == null
                        ? '테스트 시작'
                        : selected.activeWords.isEmpty
                            ? '단어가 없어요'
                            : '테스트 시작 · ${selected.activeWords.length}단어',
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
    return Material(
      color: NyakiColors.cream,
      shape: RoundedRectangleBorder(
        side: BorderSide(
          color: NyakiColors.ink.withValues(alpha: selected ? 0.75 : 0.14),
          width: selected ? 1.4 : 1.1,
        ),
        borderRadius: BorderRadius.circular(12),
      ),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 17),
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
                        fontSize: 16,
                        fontWeight: FontWeight.w600,
                        color: NyakiColors.ink,
                      ),
                    ),
                    const SizedBox(height: 5),
                    Text(
                      meta,
                      style: TextStyle(
                        fontFamily: 'Inter',
                        fontSize: 12,
                        fontWeight: FontWeight.w400,
                        color: NyakiColors.ink.withValues(alpha: 0.45),
                      ),
                    ),
                  ],
                ),
              ),
              if (selected)
                const Icon(
                  Icons.check_rounded,
                  size: 20,
                  color: NyakiColors.ink,
                ),
            ],
          ),
        ),
      ),
    );
  }
}
