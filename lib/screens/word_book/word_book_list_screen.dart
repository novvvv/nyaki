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

        return Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Expanded(
              child: ListView.separated(
                padding: const EdgeInsets.fromLTRB(28, 20, 28, 12),
                // 목록이 비어있어도 "추가" 카드는 항상 마지막 항목으로 남는다.
                itemCount: books.length + 1,
                separatorBuilder: (_, __) => const SizedBox(height: 10),
                itemBuilder: (context, index) {
                  if (index == books.length) {
                    return _AddWordBookCard(
                      onTap: () => _openAddWordBook(context),
                    );
                  }
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

class _AddWordBookCard extends StatelessWidget {
  const _AddWordBookCard({required this.onTap});

  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(22),
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 14),
        decoration: BoxDecoration(
          border: Border.all(color: NyakiColors.taupe, width: 1.2),
          borderRadius: BorderRadius.circular(22),
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              Icons.add,
              size: 16,
              color: NyakiColors.ink.withValues(alpha: 0.6),
            ),
            const SizedBox(width: 6),
            Text(
              '새 단어장 추가',
              style: TextStyle(
                fontFamily: 'Inter',
                fontSize: 13,
                fontWeight: FontWeight.w600,
                color: NyakiColors.ink.withValues(alpha: 0.6),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
