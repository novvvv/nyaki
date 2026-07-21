import 'package:flutter/material.dart';

import '../../core/nyaki_scope.dart';
import '../../core/theme/nyaki_colors.dart';
import '../../widgets/word_book_tile.dart';
import 'add_word_book_screen.dart';
import 'word_book_detail_screen.dart';

class WordBookListScreen extends StatelessWidget {
  const WordBookListScreen({super.key});

  Future<void> _openAddWordBook(BuildContext context) async {
    await Navigator.of(context).push<void>(
      MaterialPageRoute<void>(
        builder: (_) => const AddWordBookScreen(),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: NyakiScope.of(context),
      builder: (context, _) {
        final books = NyakiScope.of(context).wordBooks;
        final dividerColor = NyakiColors.ink.withValues(alpha: 0.06);

        return Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(28, 20, 28, 0),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      const Expanded(
                        child: Text(
                          '단어장',
                          style: TextStyle(
                            fontFamily: 'Inter',
                            fontSize: 24,
                            fontWeight: FontWeight.w600,
                            letterSpacing: -0.3,
                            color: NyakiColors.ink,
                          ),
                        ),
                      ),
                      TextButton(
                        onPressed: () => _openAddWordBook(context),
                        style: TextButton.styleFrom(
                          foregroundColor:
                              NyakiColors.ink.withValues(alpha: 0.55),
                          padding: const EdgeInsets.symmetric(
                            horizontal: 8,
                            vertical: 4,
                          ),
                          minimumSize: Size.zero,
                          tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                        ),
                        child: const Text(
                          '+ 추가',
                          style: TextStyle(
                            fontFamily: 'Inter',
                            fontSize: 14,
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 4),
                  Text(
                    '모바일과 동기화되는 단어장을 관리합니다.',
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
                      padding: const EdgeInsets.fromLTRB(28, 16, 28, 28),
                      itemCount: books.length,
                      separatorBuilder: (_, __) => Divider(
                        height: 1,
                        thickness: 1,
                        color: dividerColor,
                      ),
                      itemBuilder: (context, index) {
                        final book = books[index];
                        return WordBookTile(
                          title: book.title,
                          description: book.description,
                          meta: book.metaLabel,
                          onTap: () {
                            Navigator.of(context).push<void>(
                              MaterialPageRoute<void>(
                                builder: (_) => WordBookDetailScreen(
                                  wordBookId: book.id,
                                ),
                              ),
                            );
                          },
                        );
                      },
                    ),
            ),
          ],
        );
      },
    );
  }
}
