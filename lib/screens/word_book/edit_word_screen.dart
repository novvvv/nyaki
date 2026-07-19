import 'package:flutter/material.dart';

import '../../core/nyaki_scope.dart';
import '../../core/theme/nyaki_colors.dart';
import '../../data/repositories/vocab_repository.dart';
import '../../models/word.dart';

// ===============================================  
// ✨ edit_word_screen.dart ✨ 
// - 기존 단어 정보를 입력찬에 채워 보여주고, 유저가 해당 단어를 수정/저장/삭제할 수 있게 하는 화면입니다. 
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
      // VocabController? 이게 뭐지 << 내가 지정한건가. 
      // Word Model에서 사용되는,, 머 그런 메서드? 비슷한건가. 
      // NyakiScope.of(context).updateWord << 이게 먼데 
      await NyakiScope.of(context).updateWord(
        wordBookId: widget.word.wordBookId,
        wordId: widget.word.id,
        input: UpdateWordInput(
          term: term,
          meaning: meaning,
          pronunciation: _pronunciationController.text.trim(),
          description: _descriptionController.text.trim(),
          example: _exampleController.text.trim(),
        ),
      );
      if (!mounted) return;
      Navigator.of(context).pop();
    } catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(error.toString())),
      );
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
            fontSize: 17,
            fontWeight: FontWeight.w700,
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
            child: const Text('취소'),
          ),
          TextButton(
            onPressed: () => Navigator.of(context).pop(true),
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
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(error.toString())),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: NyakiColors.cream,
      body: SafeArea(
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 12, 20, 8),
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
                  const Text(
                    '단어 수정',
                    style: TextStyle(
                      fontFamily: 'Inter',
                      fontSize: 17,
                      fontWeight: FontWeight.w700,
                      color: NyakiColors.ink,
                    ),
                  ),
                  Align(
                    alignment: Alignment.centerRight,
                    child: TextButton(
                      onPressed: _isSubmitting ? null : _save,
                      style: TextButton.styleFrom(
                        foregroundColor: NyakiColors.ink,
                        padding: const EdgeInsets.symmetric(
                          horizontal: 8,
                          vertical: 10,
                        ),
                      ),
                      child: Text(
                        _isSubmitting ? '저장 중…' : '저장',
                        style: const TextStyle(
                          fontFamily: 'Inter',
                          fontSize: 15,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
            Expanded(
              child: ListView(
                padding: const EdgeInsets.fromLTRB(28, 14, 28, 32),
                keyboardDismissBehavior:
                    ScrollViewKeyboardDismissBehavior.onDrag,
                children: [
                  _BoxTextField(
                    controller: _termController,
                    label: '단어',
                    hint: '단어를 입력해 주세요. (필수)',
                    errorText: _showTermError ? '단어를 입력해 주세요.' : null,
                    onChanged: (_) {
                      if (_showTermError) {
                        setState(() => _showTermError = false);
                      }
                    },
                  ),
                  const SizedBox(height: 20),
                  _BoxTextField(
                    controller: _meaningController,
                    label: '의미',
                    hint: '의미를 입력해 주세요. (필수)',
                    errorText: _showMeaningError ? '의미를 입력해 주세요.' : null,
                    onChanged: (_) {
                      if (_showMeaningError) {
                        setState(() => _showMeaningError = false);
                      }
                    },
                  ),
                  const SizedBox(height: 20),
                  _BoxTextField(
                    controller: _pronunciationController,
                    label: '발음',
                    hint: '발음을 입력해 주세요.',
                  ),
                  const SizedBox(height: 20),
                  _BoxTextField(
                    controller: _descriptionController,
                    label: '설명',
                    hint: '단어에 대한 설명을 입력해 주세요.',
                    maxLines: 2,
                  ),
                  const SizedBox(height: 20),
                  _BoxTextField(
                    controller: _exampleController,
                    label: '예문',
                    hint: '예문을 입력해 주세요.',
                    maxLines: 3,
                  ),
                  const SizedBox(height: 32),
                  Center(
                    child: TextButton(
                      onPressed: _delete,
                      style: TextButton.styleFrom(
                        foregroundColor: NyakiColors.ink.withValues(alpha: 0.4),
                      ),
                      child: const Text(
                        '단어 삭제',
                        style: TextStyle(
                          fontFamily: 'Inter',
                          fontSize: 13,
                          fontWeight: FontWeight.w600,
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

class _BoxTextField extends StatelessWidget {
  const _BoxTextField({
    required this.controller,
    required this.label,
    required this.hint,
    this.maxLines = 1,
    this.errorText,
    this.onChanged,
  });

  final TextEditingController controller;
  final String label;
  final String hint;
  final int maxLines;
  final String? errorText;
  final ValueChanged<String>? onChanged;

  @override
  Widget build(BuildContext context) {
    final border = OutlineInputBorder(
      borderRadius: BorderRadius.circular(10),
      borderSide: BorderSide(
        color: NyakiColors.ink.withValues(alpha: 0.18),
        width: 1.2,
      ),
    );

    return TextField(
      controller: controller,
      maxLines: maxLines,
      onChanged: onChanged,
      style: const TextStyle(
        fontFamily: 'Inter',
        fontSize: 16,
        fontWeight: FontWeight.w500,
        color: NyakiColors.ink,
      ),
      decoration: InputDecoration(
        labelText: label,
        hintText: hint,
        errorText: errorText,
        floatingLabelBehavior: FloatingLabelBehavior.always,
        labelStyle: const TextStyle(
          fontFamily: 'Inter',
          fontSize: 14,
          fontWeight: FontWeight.w700,
          color: NyakiColors.ink,
        ),
        hintStyle: TextStyle(
          fontFamily: 'Inter',
          fontSize: 14,
          fontWeight: FontWeight.w400,
          color: NyakiColors.ink.withValues(alpha: 0.4),
        ),
        filled: true,
        fillColor: NyakiColors.cream,
        contentPadding: EdgeInsets.fromLTRB(
          14,
          maxLines > 1 ? 18 : 16,
          14,
          maxLines > 1 ? 18 : 16,
        ),
        border: border,
        enabledBorder: border,
        focusedBorder: border.copyWith(
          borderSide: BorderSide(
            color: NyakiColors.ink.withValues(alpha: 0.45),
            width: 1.3,
          ),
        ),
      ),
    );
  }
}
