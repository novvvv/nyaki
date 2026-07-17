import 'package:flutter/material.dart';

import '../core/nyaki_scope.dart';
import '../core/theme/nyaki_colors.dart';
import '../widgets/word_tile.dart';

class WordBookDetailScreen extends StatelessWidget {
  const WordBookDetailScreen({super.key, required this.wordBookId});

  final String wordBookId;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: NyakiColors.cream,
      body: SafeArea(
        child: ListenableBuilder(
          listenable: NyakiScope.of(context),
          builder: (context, _) {
            final wordBook = NyakiScope.of(context).findWordBook(wordBookId);

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

            final words = wordBook.activeWords;

            return Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Padding(
                  padding: const EdgeInsets.fromLTRB(20, 12, 20, 14),
                  child: Stack(
                    alignment: Alignment.center,
                    children: [
                      Align(
                        alignment: Alignment.centerLeft,
                        child: IconButton(
                          onPressed: () => Navigator.of(context).pop(),
                          icon: const Icon(Icons.arrow_back_ios_new_rounded),
                          iconSize: 18,
                          color: NyakiColors.ink,
                          tooltip: '뒤로',
                        ),
                      ),
                      Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text(
                            wordBook.title,
                            style: const TextStyle(
                              fontFamily: 'Inter',
                              fontSize: 18,
                              fontWeight: FontWeight.w700,
                              color: NyakiColors.ink,
                            ),
                          ),
                          const SizedBox(height: 3),
                          Text(
                            wordBook.metaLabel,
                            style: TextStyle(
                              fontFamily: 'Inter',
                              fontSize: 11,
                              fontWeight: FontWeight.w500,
                              color: NyakiColors.ink.withValues(alpha: 0.42),
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
                Expanded(
                  child: words.isEmpty
                      ? Center(
                          child: Text(
                            '아직 저장된 단어가 없어요.',
                            style: TextStyle(
                              fontFamily: 'Inter',
                              fontSize: 14,
                              fontWeight: FontWeight.w400,
                              color: NyakiColors.ink.withValues(alpha: 0.42),
                            ),
                          ),
                        )
                      : ListView.separated(
                          padding: const EdgeInsets.fromLTRB(28, 8, 28, 28),
                          itemCount: words.length,
                          separatorBuilder: (_, __) =>
                              const SizedBox(height: 10),
                          itemBuilder: (context, index) {
                            final entry = words[index];
                            return WordTile(
                              word: entry.term,
                              meaning: entry.meaning,
                              isMemorized: entry.isMemorized,
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
