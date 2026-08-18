import 'package:flutter/material.dart';

import '../../core/error_snackbar.dart';
import '../../core/nyaki_scope.dart';
import '../../core/theme/nyaki_colors.dart';
import '../../data/repositories/vocab_repository.dart';
import '../../models/word_book.dart';
import 'widgets/word_form_field.dart';

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
  bool _isBookmarked = false;

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
          isBookmarked: _isBookmarked,
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
        _isBookmarked = false;
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
            WordFormTopBar(
              showBack: !widget.embedded,
              actionLabel: _isSubmitting ? '추가 중…' : '추가',
              onAction: _isSubmitting || selectedId == null ? null : _submitWord,
              isBookmarked: _isBookmarked,
              onBookmarkChanged: (value) =>
                  setState(() => _isBookmarked = value),
              center: _WordBookSelector(
                books: books,
                selectedId: selectedId,
                onChanged: (id) {
                  if (id != null) {
                    setState(() => _selectedWordBookId = id);
                  }
                },
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
                  const SizedBox(height: 12),
                  const _PhotoPicker(),
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

class _PhotoPicker extends StatelessWidget {
  const _PhotoPicker();

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        borderRadius: BorderRadius.circular(8),
        onTap: () {},
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 12),
          child: Row(
            children: [
              Icon(
                Icons.add_photo_alternate_outlined,
                size: 18,
                color: NyakiColors.ink.withValues(alpha: 0.35),
              ),
              const SizedBox(width: 8),
              Text(
                '사진 추가',
                style: TextStyle(
                  fontFamily: 'Inter',
                  fontSize: 13,
                  fontWeight: FontWeight.w500,
                  color: NyakiColors.ink.withValues(alpha: 0.45),
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
    if (books.isEmpty) {
      return Text(
        '단어장 없음',
        style: TextStyle(
          fontFamily: 'Inter',
          fontSize: 14,
          color: NyakiColors.ink.withValues(alpha: 0.35),
        ),
      );
    }

    return DropdownButtonHideUnderline(
      child: DropdownButton<String>(
        value: selectedId,
        isDense: true,
        alignment: Alignment.center,
        icon: Icon(
          Icons.keyboard_arrow_down_rounded,
          size: 17,
          color: NyakiColors.ink.withValues(alpha: 0.4),
        ),
        style: const TextStyle(
          fontFamily: 'Inter',
          fontSize: 14,
          fontWeight: FontWeight.w600,
          color: NyakiColors.ink,
        ),
        dropdownColor: NyakiColors.cream,
        borderRadius: BorderRadius.circular(10),
        // 닫힌 상태에서 긴 제목이 상단 바를 밀어내지 않도록 폭을 제한한다.
        selectedItemBuilder: (context) => [
          for (final book in books)
            ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 150),
              child: Center(
                child: Text(
                  book.title,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    fontFamily: 'Inter',
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                    color: NyakiColors.ink,
                  ),
                ),
              ),
            ),
        ],
        items: [
          for (final book in books)
            DropdownMenuItem<String>(
              value: book.id,
              child: Text(book.title, overflow: TextOverflow.ellipsis),
            ),
        ],
        onChanged: onChanged,
      ),
    );
  }
}
