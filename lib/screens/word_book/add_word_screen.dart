import 'package:flutter/material.dart';

import '../../core/error_snackbar.dart';
import '../../core/nyaki_scope.dart';
import '../../core/theme/nyaki_colors.dart';
import '../../data/repositories/vocab_repository.dart';
import '../../models/word_book.dart';

class AddWordScreen extends StatefulWidget {
  const AddWordScreen({super.key, this.embedded = false});

  /// true면 AppShell 탭 안에 들어가 있는 상태 — 바깥 Scaffold/SafeArea를 그대로 쓴다.
  /// false면 단독 화면으로 push된 상태라 자기 Scaffold와 뒤로가기 버튼을 직접 갖는다.
  /// (Scaffold가 없으면 DropdownButton이 Material 조상을 못 찾아 에러가 난다)
  final bool embedded;

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
      showErrorSnackBar(context, message: '단어 추가에 실패했어요.', error: error);
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

        final content = Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(28, 20, 20, 0),
              child: Row(
                children: [
                  if (!widget.embedded) ...[
                    IconButton(
                      onPressed: () => Navigator.of(context).pop(),
                      icon: const Icon(Icons.arrow_back_ios_new_rounded),
                      iconSize: 18,
                      color: NyakiColors.ink.withValues(alpha: 0.5),
                      tooltip: '뒤로',
                      padding: EdgeInsets.zero,
                      constraints: const BoxConstraints(
                        minWidth: 32,
                        minHeight: 32,
                      ),
                    ),
                    const SizedBox(width: 8),
                  ],
                  const Expanded(
                    child: Text(
                      '단어 추가',
                      style: TextStyle(
                        fontFamily: 'Inter',
                        fontSize: 24,
                        fontWeight: FontWeight.w600,
                        letterSpacing: -0.3,
                        color: NyakiColors.ink,
                      ),
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
                    color: NyakiColors.softDune,
                  ),
                  const _PhotoPicker(),
                  Divider(
                    height: 1,
                    color: NyakiColors.softDune,
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

        if (widget.embedded) return content;

        return Scaffold(
          backgroundColor: NyakiColors.cream,
          body: SafeArea(child: content),
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
                color: NyakiColors.softDune,
              ),
            ),
            enabledBorder: UnderlineInputBorder(
              borderSide: BorderSide(
                color: NyakiColors.softDune,
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
