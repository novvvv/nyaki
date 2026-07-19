import 'package:flutter/material.dart';

import '../../core/nyaki_scope.dart';
import '../../core/theme/nyaki_colors.dart';
import '../../data/repositories/vocab_repository.dart';
import '../../models/word_book.dart';

class AddWordScreen extends StatefulWidget {
  const AddWordScreen({super.key});

  @override
  State<AddWordScreen> createState() => _AddWordScreenState();
}

class _AddWordScreenState extends State<AddWordScreen> {
  final _termController = TextEditingController();
  final _meaningController = TextEditingController();
  final _pronunciationController = TextEditingController();
  final _descriptionController = TextEditingController();
  final _exampleController = TextEditingController();

  String? _selectedWordBookId;
  bool _showTermError = false;
  bool _showMeaningError = false;
  bool _isSubmitting = false;

  @override
  void dispose() {
    _termController.dispose();
    _meaningController.dispose();
    _pronunciationController.dispose();
    _descriptionController.dispose();
    _exampleController.dispose();
    super.dispose();
  }

  String? _resolveSelectedId(List<WordBook> books) {
    if (books.isEmpty) return null;
    if (_selectedWordBookId != null &&
        books.any((book) => book.id == _selectedWordBookId)) {
      return _selectedWordBookId;
    }
    return books.first.id;
  }

  Future<void> _submitWord() async {
    final term = _termController.text.trim();
    final meaning = _meaningController.text.trim();
    final hasTermError = term.isEmpty;
    final hasMeaningError = meaning.isEmpty;

    if (hasTermError || hasMeaningError) {
      setState(() {
        _showTermError = hasTermError;
        _showMeaningError = hasMeaningError;
      });
      return;
    }

    final vocab = NyakiScope.of(context);
    final wordBookId = _resolveSelectedId(vocab.wordBooks);
    if (wordBookId == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('단어장을 먼저 만들어 주세요.')),
      );
      return;
    }

    setState(() => _isSubmitting = true);
    try {
      await vocab.createWord(
        CreateWordInput(
          wordBookId: wordBookId,
          term: term,
          meaning: meaning,
          pronunciation: _pronunciationController.text.trim(),
          description: _descriptionController.text.trim(),
          example: _exampleController.text.trim(),
        ),
      );

      if (!mounted) return;
      _termController.clear();
      _meaningController.clear();
      _pronunciationController.clear();
      _descriptionController.clear();
      _exampleController.clear();
      setState(() {
        _showTermError = false;
        _showMeaningError = false;
      });
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('단어가 추가되었습니다.')),
      );
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
    return ListenableBuilder(
      listenable: NyakiScope.of(context),
      builder: (context, _) {
        final vocab = NyakiScope.of(context);
        final books = vocab.wordBooks;
        final selectedId = _resolveSelectedId(books);

        return Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 12, 20, 8),
              child: Stack(
                alignment: Alignment.center,
                children: [
                  _WordBookSelector(
                    books: books,
                    selectedId: selectedId,
                    onChanged: (id) {
                      if (id != null) {
                        setState(() => _selectedWordBookId = id);
                      }
                    },
                  ),
                  Align(
                    alignment: Alignment.centerRight,
                    child: TextButton(
                      onPressed: _isSubmitting || selectedId == null
                          ? null
                          : _submitWord,
                      style: TextButton.styleFrom(
                        foregroundColor: NyakiColors.ink,
                        padding: const EdgeInsets.symmetric(
                          horizontal: 8,
                          vertical: 10,
                        ),
                      ),
                      child: Text(
                        _isSubmitting ? '추가 중…' : '추가',
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
                  const _PhotoPicker(),
                  const SizedBox(height: 30),
                  _BoxTextField(
                    controller: _termController,
                    label: '단어',
                    hint: '단어를 입력해 주세요. (필수)',
                    suffixIcon: Icons.search_rounded,
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
                    suffixIcon: Icons.search_rounded,
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
                ],
              ),
            ),
          ],
        );
      },
    );
  }
}

class _BoxTextField extends StatelessWidget {
  const _BoxTextField({
    required this.controller,
    required this.label,
    required this.hint,
    this.maxLines = 1,
    this.suffixIcon,
    this.errorText,
    this.onChanged,
  });

  final TextEditingController controller;
  final String label;
  final String hint;
  final int maxLines;
  final IconData? suffixIcon;
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
        suffixIcon: suffixIcon == null
            ? null
            : Icon(
                suffixIcon,
                size: 24,
                color: NyakiColors.ink.withValues(alpha: 0.55),
              ),
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

class _PhotoPicker extends StatelessWidget {
  const _PhotoPicker();

  @override
  Widget build(BuildContext context) {
    return Align(
      alignment: Alignment.centerLeft,
      child: Material(
        color: Colors.transparent,
        shape: RoundedRectangleBorder(
          side: BorderSide(
            color: NyakiColors.ink.withValues(alpha: 0.18),
            width: 1.2,
          ),
          borderRadius: BorderRadius.circular(10),
        ),
        child: InkWell(
          onTap: () {},
          borderRadius: BorderRadius.circular(10),
          child: SizedBox(
            width: 76,
            height: 76,
            child: Icon(
              Icons.add_photo_alternate_outlined,
              size: 27,
              color: NyakiColors.ink.withValues(alpha: 0.5),
            ),
          ),
        ),
      ),
    );
  }
}

class _WordBookSelector extends StatelessWidget {
  const _WordBookSelector({
    required this.books,
    required this.selectedId,
    required this.onChanged,
  });

  final List<WordBook> books;
  final String? selectedId;
  final ValueChanged<String?> onChanged;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 220,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            '선택된 단어장',
            style: TextStyle(
              fontFamily: 'Inter',
              fontWeight: FontWeight.w500,
              color: NyakiColors.ink.withValues(alpha: 0.45),
              fontSize: 11,
            ),
          ),
          if (books.isEmpty)
            Text(
              '단어장을 먼저 만들어 주세요',
              style: TextStyle(
                fontFamily: 'Inter',
                fontSize: 15,
                fontWeight: FontWeight.w600,
                color: NyakiColors.ink.withValues(alpha: 0.45),
              ),
            )
          else
            DropdownButtonHideUnderline(
              child: DropdownButton<String>(
                value: selectedId,
                isDense: true,
                alignment: Alignment.center,
                icon: Icon(
                  Icons.keyboard_arrow_down_rounded,
                  size: 18,
                  color: NyakiColors.ink.withValues(alpha: 0.55),
                ),
                style: const TextStyle(
                  fontFamily: 'Inter',
                  fontSize: 20,
                  fontWeight: FontWeight.w700,
                  color: NyakiColors.ink,
                ),
                dropdownColor: NyakiColors.cream,
                borderRadius: BorderRadius.circular(12),
                items: [
                  for (final book in books)
                    DropdownMenuItem<String>(
                      value: book.id,
                      child: Text(book.title),
                    ),
                ],
                onChanged: onChanged,
              ),
            ),
        ],
      ),
    );
  }
}
