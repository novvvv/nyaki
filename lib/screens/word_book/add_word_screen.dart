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
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(28, 20, 20, 0),
              child: Row(
                children: [
                  const Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          '단어 추가',
                          style: TextStyle(
                            fontFamily: 'Inter',
                            fontSize: 24,
                            fontWeight: FontWeight.w600,
                            letterSpacing: -0.3,
                            color: NyakiColors.ink,
                          ),
                        ),
                        SizedBox(height: 4),
                        Text(
                          '새로운 단어와 의미를 기록합니다.',
                          style: TextStyle(
                            fontFamily: 'Inter',
                            fontSize: 14,
                            color: Color(0x731D1D1B),
                          ),
                        ),
                      ],
                    ),
                  ),
                  TextButton(
                    onPressed: _isSubmitting || selectedId == null
                        ? null
                        : _submitWord,
                    style: TextButton.styleFrom(
                      foregroundColor: NyakiColors.ink,
                      padding: const EdgeInsets.symmetric(
                        horizontal: 8,
                        vertical: 8,
                      ),
                    ),
                    child: Text(
                      _isSubmitting ? '저장 중…' : '저장',
                      style: const TextStyle(
                        fontFamily: 'Inter',
                        fontSize: 14,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  ),
                ],
              ),
            ),
            Expanded(
              child: ListView(
                padding: const EdgeInsets.fromLTRB(28, 24, 28, 32),
                keyboardDismissBehavior:
                    ScrollViewKeyboardDismissBehavior.onDrag,
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
                  const SizedBox(height: 8),
                  Divider(
                    height: 1,
                    color: NyakiColors.ink.withValues(alpha: 0.06),
                  ),
                  const _PhotoPicker(),
                  Divider(
                    height: 1,
                    color: NyakiColors.ink.withValues(alpha: 0.06),
                  ),
                  const SizedBox(height: 24),
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
                  const SizedBox(height: 24),
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
                  const SizedBox(height: 24),
                  _BoxTextField(
                    controller: _pronunciationController,
                    label: '발음',
                    hint: '발음을 입력해 주세요.',
                  ),
                  const SizedBox(height: 24),
                  _BoxTextField(
                    controller: _descriptionController,
                    label: '설명',
                    hint: '단어에 대한 설명을 입력해 주세요.',
                    maxLines: 2,
                  ),
                  const SizedBox(height: 24),
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
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: TextStyle(
            fontFamily: 'Inter',
            fontSize: 12,
            fontWeight: FontWeight.w500,
            color: NyakiColors.ink.withValues(alpha: 0.45),
          ),
        ),
        const SizedBox(height: 6),
        TextField(
          controller: controller,
          maxLines: maxLines,
          onChanged: onChanged,
          style: const TextStyle(
            fontFamily: 'Inter',
            fontSize: 15,
            fontWeight: FontWeight.w500,
            color: NyakiColors.ink,
          ),
          decoration: InputDecoration(
            hintText: hint,
            errorText: errorText,
            hintStyle: TextStyle(
              fontFamily: 'Inter',
              fontSize: 14,
              color: NyakiColors.ink.withValues(alpha: 0.28),
            ),
            contentPadding: EdgeInsets.only(
              top: 8,
              right: 4,
              bottom: maxLines > 1 ? 12 : 10,
            ),
            border: UnderlineInputBorder(
              borderSide: BorderSide(
                color: NyakiColors.ink.withValues(alpha: 0.08),
              ),
            ),
            enabledBorder: UnderlineInputBorder(
              borderSide: BorderSide(
                color: NyakiColors.ink.withValues(alpha: 0.08),
              ),
            ),
            focusedBorder: UnderlineInputBorder(
              borderSide: BorderSide(
                color: NyakiColors.ink.withValues(alpha: 0.45),
              ),
            ),
          ),
        ),
      ],
    );
  }
}

class _PhotoPicker extends StatelessWidget {
  const _PhotoPicker();

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: () {},
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 16),
          child: Row(
            children: [
              Icon(
                Icons.add_photo_alternate_outlined,
                size: 20,
                color: NyakiColors.ink.withValues(alpha: 0.45),
              ),
              const SizedBox(width: 10),
              const Expanded(
                child: Text(
                  '사진 선택',
                  style: TextStyle(
                    fontFamily: 'Inter',
                    fontSize: 14,
                    fontWeight: FontWeight.w500,
                    color: NyakiColors.ink,
                  ),
                ),
              ),
              Text(
                '선택 사항',
                style: TextStyle(
                  fontFamily: 'Inter',
                  fontSize: 12,
                  color: NyakiColors.ink.withValues(alpha: 0.3),
                ),
              ),
            ],
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
    return Row(
      children: [
        Text(
          '저장할 단어장',
          style: TextStyle(
            fontFamily: 'Inter',
            fontSize: 14,
            fontWeight: FontWeight.w500,
            color: NyakiColors.ink.withValues(alpha: 0.5),
          ),
        ),
        const Spacer(),
        if (books.isEmpty)
          Text(
            '단어장이 없습니다',
            style: TextStyle(
              fontFamily: 'Inter',
              fontSize: 13,
              color: NyakiColors.ink.withValues(alpha: 0.35),
            ),
          )
        else
          DropdownButtonHideUnderline(
            child: DropdownButton<String>(
              value: selectedId,
              isDense: true,
              alignment: Alignment.centerRight,
              icon: Icon(
                Icons.keyboard_arrow_down_rounded,
                size: 18,
                color: NyakiColors.ink.withValues(alpha: 0.4),
              ),
              style: const TextStyle(
                fontFamily: 'Inter',
                fontSize: 14,
                fontWeight: FontWeight.w500,
                color: NyakiColors.ink,
              ),
              dropdownColor: NyakiColors.cream,
              borderRadius: BorderRadius.circular(8),
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
    );
  }
}
