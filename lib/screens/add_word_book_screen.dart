import 'package:flutter/material.dart';

import '../core/nyaki_scope.dart';
import '../core/theme/nyaki_colors.dart';

class AddWordBookScreen extends StatefulWidget {
  const AddWordBookScreen({super.key});

  @override
  State<AddWordBookScreen> createState() => _AddWordBookScreenState();
}

class _AddWordBookScreenState extends State<AddWordBookScreen> {
  final _titleController = TextEditingController();
  final _descriptionController = TextEditingController();
  bool _showTitleError = false;
  bool _isSubmitting = false;

  @override
  void dispose() {
    _titleController.dispose();
    _descriptionController.dispose();
    super.dispose();
  }

  Future<void> _createWordBook() async {
    final title = _titleController.text.trim();
    if (title.isEmpty) {
      setState(() => _showTitleError = true);
      return;
    }

    setState(() => _isSubmitting = true);
    try {
      await NyakiScope.of(context).createWordBook(
        title: title,
        description: _descriptionController.text.trim(),
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

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: NyakiColors.cream,
      body: SafeArea(
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 12, 20, 10),
              child: Stack(
                alignment: Alignment.center,
                children: [
                  const Text(
                    '새 단어장',
                    style: TextStyle(
                      fontFamily: 'Inter',
                      fontSize: 18,
                      fontWeight: FontWeight.w700,
                      color: NyakiColors.ink,
                    ),
                  ),
                  Align(
                    alignment: Alignment.centerLeft,
                    child: TextButton(
                      onPressed: _isSubmitting
                          ? null
                          : () => Navigator.of(context).pop(),
                      style: TextButton.styleFrom(
                        foregroundColor:
                            NyakiColors.ink.withValues(alpha: 0.55),
                      ),
                      child: const Text('취소'),
                    ),
                  ),
                  Align(
                    alignment: Alignment.centerRight,
                    child: TextButton(
                      onPressed: _isSubmitting ? null : _createWordBook,
                      style: TextButton.styleFrom(
                        foregroundColor: NyakiColors.ink,
                      ),
                      child: Text(
                        _isSubmitting ? '생성 중…' : '생성',
                        style: const TextStyle(fontWeight: FontWeight.w700),
                      ),
                    ),
                  ),
                ],
              ),
            ),
            Expanded(
              child: ListView(
                padding: const EdgeInsets.fromLTRB(28, 28, 28, 32),
                keyboardDismissBehavior:
                    ScrollViewKeyboardDismissBehavior.onDrag,
                children: [
                  _WordBookTextField(
                    controller: _titleController,
                    label: '이름',
                    hint: '단어장 이름을 입력해 주세요.',
                    autofocus: true,
                    errorText: _showTitleError ? '단어장 이름을 입력해 주세요.' : null,
                    onChanged: (_) {
                      if (_showTitleError) {
                        setState(() => _showTitleError = false);
                      }
                    },
                    onSubmitted: _createWordBook,
                  ),
                  const SizedBox(height: 22),
                  _WordBookTextField(
                    controller: _descriptionController,
                    label: '설명',
                    hint: '어떤 단어를 모을지 간단히 적어 주세요. (선택)',
                    maxLines: 3,
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

class _WordBookTextField extends StatelessWidget {
  const _WordBookTextField({
    required this.controller,
    required this.label,
    required this.hint,
    this.maxLines = 1,
    this.autofocus = false,
    this.errorText,
    this.onChanged,
    this.onSubmitted,
  });

  final TextEditingController controller;
  final String label;
  final String hint;
  final int maxLines;
  final bool autofocus;
  final String? errorText;
  final ValueChanged<String>? onChanged;
  final VoidCallback? onSubmitted;

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
      autofocus: autofocus,
      onChanged: onChanged,
      textInputAction:
          maxLines == 1 ? TextInputAction.done : TextInputAction.newline,
      onSubmitted:
          maxLines == 1 && onSubmitted != null ? (_) => onSubmitted!() : null,
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
          color: NyakiColors.ink.withValues(alpha: 0.4),
        ),
        filled: true,
        fillColor: NyakiColors.cream,
        contentPadding: const EdgeInsets.fromLTRB(14, 18, 14, 18),
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
