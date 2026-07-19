import 'package:flutter/material.dart';
import '../core/theme/nyaki_colors.dart';


// ===============================================  
// ✨ word_title.dart ✨ 
// - 단어장의 개별 단어 컴포넌트를 관리합니다. 
// Component 
// - word : 단어
// - meaning : 뜻 
// - isMemorized : 암기 여부 (True/False)
// - onTap : 카드를 눌렀을 때 실행할 함수 
// ===============================================  

class WordTile extends StatelessWidget {
  const WordTile({
    super.key,
    required this.word,
    required this.meaning,
    this.isMemorized = false,
    this.onTap,
  });

  final String word;
  final String meaning;
  final bool isMemorized;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: NyakiColors.cream,
      shape: RoundedRectangleBorder(
        side: BorderSide(
          color: NyakiColors.ink.withValues(alpha: 0.13),
          width: 1.1,
        ),
        borderRadius: BorderRadius.circular(10),
      ),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(10),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 15),
          child: Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      word,
                      style: const TextStyle(
                        fontFamily: 'Inter',
                        fontSize: 16,
                        fontWeight: FontWeight.w700,
                        color: NyakiColors.ink,
                      ),
                    ),
                    const SizedBox(height: 6),
                    Text(
                      meaning,
                      style: TextStyle(
                        fontFamily: 'Inter',
                        fontSize: 13,
                        fontWeight: FontWeight.w400,
                        color: NyakiColors.ink.withValues(alpha: 0.5),
                      ),
                    ),
                  ],
                ),
              ),
              Text(
                isMemorized ? '암기' : '미암기',
                style: TextStyle(
                  fontFamily: 'Inter',
                  fontSize: 11,
                  fontWeight: FontWeight.w600,
                  color: NyakiColors.ink
                      .withValues(alpha: isMemorized ? 0.7 : 0.35),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
