import 'package:flutter/material.dart';

import '../core/nyaki_scope.dart';
import '../core/theme/nyaki_colors.dart';
import '../widgets/word_book_tile.dart';
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

        return Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(28, 18, 28, 18),
              child: Row(
                children: [
                  const Text(
                    '단어장',
                    style: TextStyle(
                      fontFamily: 'Inter',
                      fontSize: 22,
                      fontWeight: FontWeight.w700,
                      color: NyakiColors.ink,
                    ),
                  ),
                  const Spacer(),
                  Text(
                    '${books.length}개',
                    style: TextStyle(
                      fontFamily: 'Inter',
                      fontSize: 13,
                      fontWeight: FontWeight.w500,
                      color: NyakiColors.ink.withValues(alpha: 0.42),
                    ),
                  ),
                  const SizedBox(width: 8),
                  IconButton(
                    onPressed: () => _openAddWordBook(context),
                    icon: const Icon(Icons.add_rounded),
                    iconSize: 22,
                    color: NyakiColors.ink,
                    tooltip: '단어장 추가',
                    style: IconButton.styleFrom(
                      minimumSize: const Size(36, 36),
                      padding: EdgeInsets.zero,
                      side: BorderSide(
                        color: NyakiColors.ink.withValues(alpha: 0.16),
                      ),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(10),
                      ),
                    ),
                  ),
                ],
              ),
            ),
            Expanded(
              child: ListView.separated(
                padding: const EdgeInsets.fromLTRB(28, 4, 28, 28),
                itemCount: books.length,
                separatorBuilder: (_, __) => const SizedBox(height: 12),
                itemBuilder: (context, index) {
                  final book = books[index];
                  return WordBookTile(
                    title: book.title,
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
