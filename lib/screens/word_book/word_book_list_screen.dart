import 'package:flutter/material.dart';

import '../../core/nyaki_scope.dart';
import '../../widgets/outline_add_card.dart';
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
                    return OutlineAddCard(
                      label: '새 단어장 추가',
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
