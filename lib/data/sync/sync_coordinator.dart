import 'dart:async';
import 'dart:convert';

import 'package:drift/drift.dart';
import 'package:http/http.dart' as http;

import '../auth/auth_controller.dart';
import '../local/app_database.dart';
import '../repositories/drift_vocab_repository.dart';
import '../vocab_controller.dart';

/// Drift의 outbox를 Hub에 올리고, cursor 이후 변경분을 내려받는다.
class SyncCoordinator {
  SyncCoordinator({
    required DriftVocabRepository repository,
    required AuthController auth,
    required VocabController vocab,
    http.Client? client,
    String? apiBaseUrl,
  })  : _db = repository.database,
        _vocabRepository = repository,
        _auth = auth,
        _vocab = vocab,
        _client = client ?? http.Client(),
        _apiBaseUrl = apiBaseUrl ??
            const String.fromEnvironment(
              'NYAKI_API_BASE_URL',
              defaultValue: 'http://localhost:8000',
            );

  final AppDatabase _db;
  final DriftVocabRepository _vocabRepository;
  final AuthController _auth;
  final VocabController _vocab;
  final http.Client _client;
  final String _apiBaseUrl;

  bool _running = false;
  Timer? _timer;

  /// 로그인 상태 변화와 앱 foreground 동기화는 호출자가 연결한다.
  void start() {
    _auth.addListener(sync);
    _timer ??= Timer.periodic(const Duration(seconds: 20), (_) => sync());
    sync();
  }

  void dispose() {
    _auth.removeListener(sync);
    _timer?.cancel();
    _client.close();
  }

  Future<void> sync() async {
    if (_running || _auth.status != AuthStatus.signedIn) return;
    final userId = _auth.userId;
    final token = await _auth.getIdToken();
    if (userId == null || token == null) return;

    _running = true;
    try {
      if (!await _vocabRepository.isLocalBootstrapDone()) {
        await _vocabRepository.bootstrapLocalEntitiesForSync();
        await _vocabRepository.markLocalBootstrapDone();
      }
      await _push(token);
      final changed = await _pull(userId, token);
      if (changed) await _vocab.reload();
    } catch (_) {
      // 오프라인/서버 오류는 outbox를 유지한 채 다음 주기에 재시도한다.
    } finally {
      _running = false;
    }
  }

  Future<void> _push(String token) async {
    final rows = await (_db.select(_db.syncOutbox)
          ..orderBy([(outbox) => OrderingTerm.asc(outbox.id)])
          ..limit(100))
        .get();
    if (rows.isEmpty) return;

    final response = await _client.post(
      Uri.parse('$_apiBaseUrl/v1/sync/push'),
      headers: _headers(token),
      body: jsonEncode({
        'changes': rows
            .map(
              (row) => {
                'entity_type': row.entityType,
                'action': row.operation,
                row.entityType == 'word_book' ? 'word_book' : 'word':
                    jsonDecode(row.payloadJson),
              },
            )
            .toList(),
      }),
    );
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw SyncException('변경사항 업로드에 실패했습니다.');
    }

    await (_db.delete(_db.syncOutbox)
          ..where((outbox) => outbox.id.isIn(rows.map((row) => row.id))))
        .go();
  }

  Future<bool> _pull(String userId, String token) async {
    final state = await (_db.select(_db.syncState)
          ..where((row) => row.userId.equals(userId)))
        .getSingleOrNull();
    final cursor = state?.cursor ?? 0;
    final response = await _client.get(
      Uri.parse('$_apiBaseUrl/v1/sync/pull?cursor=$cursor'),
      headers: _headers(token),
    );
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw SyncException('변경사항을 불러오지 못했습니다.');
    }

    final payload = jsonDecode(response.body) as Map<String, dynamic>;
    final changes =
        (payload['changes'] as List<dynamic>).cast<Map<String, dynamic>>();
    if (changes.isEmpty) return false;

    await _db.transaction(() async {
      for (final change in changes) {
        if (change['entity_type'] == 'word_book') {
          await _mergeWordBook(
            (change['word_book'] as Map<String, dynamic>),
          );
        } else {
          await _mergeWord((change['word'] as Map<String, dynamic>));
        }
      }
      await _db.into(_db.syncState).insertOnConflictUpdate(
            SyncStateCompanion.insert(
              userId: userId,
              cursor: Value(payload['cursor'] as int),
            ),
          );
    });
    return true;
  }

  Future<void> _mergeWordBook(Map<String, dynamic> json) async {
    final id = json['id'] as String;
    final remoteUpdatedAt = DateTime.parse(json['updated_at'] as String);
    final local = await (_db.select(_db.wordBooks)
          ..where((book) => book.id.equals(id)))
        .getSingleOrNull();
    if (local != null && !remoteUpdatedAt.isAfter(local.updatedAt)) return;

    await _db.into(_db.wordBooks).insertOnConflictUpdate(
          WordBooksCompanion.insert(
            id: id,
            title: json['title'] as String,
            description: Value(json['description'] as String?),
            createdAt: DateTime.parse(json['created_at'] as String),
            updatedAt: remoteUpdatedAt,
            isDeleted: Value(json['is_deleted'] as bool),
          ),
        );
  }

  Future<void> _mergeWord(Map<String, dynamic> json) async {
    final id = json['id'] as String;
    final remoteUpdatedAt = DateTime.parse(json['updated_at'] as String);
    final local = await (_db.select(_db.wordEntries)
          ..where((word) => word.id.equals(id)))
        .getSingleOrNull();
    if (local != null && !remoteUpdatedAt.isAfter(local.updatedAt)) return;

    await _db.into(_db.wordEntries).insertOnConflictUpdate(
          WordEntriesCompanion.insert(
            id: id,
            wordBookId: json['word_book_id'] as String,
            term: json['term'] as String,
            meaning: json['meaning'] as String,
            pronunciation: Value(json['pronunciation'] as String?),
            description: Value(json['description'] as String?),
            example: Value(json['example'] as String?),
            imagePath: Value(json['image_path'] as String?),
            memorizationStatus: json['memorization_status'] as String,
            createdAt: DateTime.parse(json['created_at'] as String),
            updatedAt: remoteUpdatedAt,
            isDeleted: Value(json['is_deleted'] as bool),
          ),
        );
  }

  Map<String, String> _headers(String token) => {
        'Authorization': 'Bearer $token',
        'Content-Type': 'application/json',
      };
}

class SyncException implements Exception {
  SyncException(this.message);
  final String message;
}
