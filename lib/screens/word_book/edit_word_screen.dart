import 'package:flutter/material.dart';

import '../../core/error_snackbar.dart';
import '../../core/nyaki_scope.dart';
import '../../core/theme/nyaki_colors.dart';
import '../../data/repositories/vocab_repository.dart';
import '../../models/word.dart';
import 'widgets/word_form_field.dart';

// ===============================================
// ✨ edit_word_screen.dart ✨
// - 기존 단어 정보를 입력창에 채워 보여주고, 유저가 해당 단어를 수정/저장/삭제할 수 있게 하는 화면입니다.
// 🔗 Chain 🔗
// word_book_detail_screen.dart (Word word) -> edit_word_screen.dart
// ===============================================

// ✨ EditWordScreen ✨
// word_book_detail_screen.dart 에서 word 객체를 받아온다.
class EditWordScreen extends StatefulWidget {
  const EditWordScreen({super.key, required this.word});
  final Word word;
  @override
  State<EditWordScreen> createState() => _EditWordScreenState();
}

// ✨ EditWordScreenState ✨
class _EditWordScreenState extends State<EditWordScreen> {
  // _termController : 단어
  // _meaningController : 단어 뜻
  // _pronunciationController : 발음 컨트롤러
  // _descriptionController : 주석 컨트롤러
  // _exampleController : 예시 컨트롤러
  late final _termController = TextEditingController(text: widget.word.term);
  late final _meaningController =
      TextEditingController(text: widget.word.meaning);
  late final _pronunciationController =
      TextEditingController(text: widget.word.pronunciation ?? '');
  late final _descriptionController =
      TextEditingController(text: widget.word.description ?? '');
  late final _exampleController =
      TextEditingController(text: widget.word.example ?? '');

  // 화면 상태
  bool _showTermError = false; // 단어 미입력 오류 표시 여부
  bool _showMeaningError = false; // 의미 미입력 오류 표시 여부
  bool _isSubmitting = false; // 현재 저장중 여부 (저장 중에는 버튼을 다시 누르지 못하게 막음)
  late bool _isBookmarked = widget.word.isBookmarked; // 즐겨찾기 여부

  // Controller Destroy
  @override
  void dispose() {
    _termController.dispose();
    _meaningController.dispose();
    _pronunciationController.dispose();
    _descriptionController.dispose();
    _exampleController.dispose();
    super.dispose();
  }

  // _save
  Future<void> _save() async {
    // [exception] 입력값, 의미 앞뒤 공백 제거
    final term = _termController.text.trim();
    final meaning = _meaningController.text.trim();

    // [exception] (required) 단어, 의미에 입력값이 비어있는지 체크
    final hasTermError = term.isEmpty;
    final hasMeaningError = meaning.isEmpty;
    if (hasTermError || hasMeaningError) {
      setState(() {
        _showTermError = hasTermError;
        _showMeaningError = hasMeaningError;
      });
      return;
    }

    // [DB] 단어 저장 로직
    // 단어 편집중 (isSubmitting = True) 상태로 바꿔 저장 버튼을 비활성화
    setState(() => _isSubmitting = true);
    try {
      await NyakiScope.of(context).updateWord(
        wordBookId: widget.word.wordBookId,
        wordId: widget.word.id,
        input: UpdateWordInput(
          term: term,
          meaning: meaning,
          pronunciation: _pronunciationController.text.trim(),
          description: _descriptionController.text.trim(),
          example: _exampleController.text.trim(),
          isBookmarked: _isBookmarked,
        ),
      );
      if (!mounted) return;
      Navigator.of(context).pop();
    } catch (error) {
      if (!mounted) return;
      showErrorSnackBar(context, message: '저장에 실패했어요.', error: error);
    } finally {
      if (mounted) setState(() => _isSubmitting = false);
    }
  }

  Future<void> _delete() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: NyakiColors.cream,
        title: const Text(
          '단어 삭제',
          style: TextStyle(
            fontFamily: 'Inter',
            fontSize: 16,
            fontWeight: FontWeight.w600,
            color: NyakiColors.ink,
          ),
        ),
        content: Text(
          '\'${widget.word.term}\' 단어를 삭제할까요?',
          style: const TextStyle(
            fontFamily: 'Inter',
            fontSize: 14,
            color: NyakiColors.ink,
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            style: TextButton.styleFrom(
              foregroundColor: NyakiColors.ink.withValues(alpha: 0.5),
            ),
            child: const Text('취소'),
          ),
          TextButton(
            onPressed: () => Navigator.of(context).pop(true),
            style: TextButton.styleFrom(foregroundColor: NyakiColors.ink),
            child: const Text('삭제'),
          ),
        ],
      ),
    );
    if (confirmed != true || !mounted) return;

    try {
      await NyakiScope.of(context).deleteWord(
        wordBookId: widget.word.wordBookId,
        wordId: widget.word.id,
      );
      if (!mounted) return;
      Navigator.of(context).pop();
    } catch (error) {
      if (!mounted) return;
      showErrorSnackBar(context, message: '삭제에 실패했어요.', error: error);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: NyakiColors.cream,
      body: SafeArea(
        child: Column(
          children: [
            WordFormTopBar(
              showBack: true,
              actionLabel: _isSubmitting ? '저장 중…' : '저장',
              onAction: _isSubmitting ? null : _save,
              isBookmarked: _isBookmarked,
              onBookmarkChanged: (value) =>
                  setState(() => _isBookmarked = value),
              center: const Text(
                '단어 수정',
                style: TextStyle(
                  fontFamily: 'Inter',
                  fontSize: 14,
                  fontWeight: FontWeight.w600,
                  color: NyakiColors.ink,
                ),
              ),
            ),
            Expanded(
              child: ListView(
                padding: const EdgeInsets.fromLTRB(28, 12, 28, 40),
                keyboardDismissBehavior:
                    ScrollViewKeyboardDismissBehavior.onDrag,
                children: [
                  WordFormField(
                    controller: _termController,
                    label: '단어',
                    hint: '단어를 입력해 주세요.',
                    isRequired: true,
                    errorText: _showTermError ? '단어를 입력해 주세요.' : null,
                    onChanged: (_) {
                      if (_showTermError) {
                        setState(() => _showTermError = false);
                      }
                    },
                  ),
                  WordFormField(
                    controller: _meaningController,
                    label: '의미',
                    hint: '의미를 입력해 주세요.',
                    isRequired: true,
                    errorText: _showMeaningError ? '의미를 입력해 주세요.' : null,
                    onChanged: (_) {
                      if (_showMeaningError) {
                        setState(() => _showMeaningError = false);
                      }
                    },
                  ),
                  WordFormField(
                    controller: _pronunciationController,
                    label: '발음',
                    hint: '발음을 입력해 주세요.',
                  ),
                  WordFormField(
                    controller: _descriptionController,
                    label: '설명',
                    hint: '단어에 대한 설명을 입력해 주세요.',
                    maxLines: 2,
                  ),
                  WordFormField(
                    controller: _exampleController,
                    label: '예문',
                    hint: '예문을 입력해 주세요.',
                    maxLines: 3,
                  ),
                  const SizedBox(height: 20),
                  Center(
                    child: TextButton(
                      onPressed: _delete,
                      style: TextButton.styleFrom(
                        foregroundColor: NyakiColors.ink.withValues(alpha: 0.35),
                        padding: const EdgeInsets.symmetric(
                          horizontal: 12,
                          vertical: 8,
                        ),
                      ),
                      child: const Text(
                        '단어 삭제',
                        style: TextStyle(
                          fontFamily: 'Inter',
                          fontSize: 12,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
