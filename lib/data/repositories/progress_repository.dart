import 'dart:convert';

import 'package:drift/drift.dart';
import 'package:http/http.dart' as http;

import '../auth/auth_controller.dart';
import '../local/app_database.dart';

/// 게이미피케이션 현재 상태 스냅샷.

// ProgressSnapshot : 전달용 불변 객체
class ProgressSnapshot {

  // Constructor 
  const ProgressSnapshot({
    required this.churuBalance,
    required this.completedQuestIds,
  });

  // Default State Value 
  static const empty = ProgressSnapshot(
    churuBalance: 0,
    completedQuestIds: {},
  );

  // field
  final int churuBalance;
  final Set<String> completedQuestIds;

}

// Progress Repository 
class ProgressRepository {
  ProgressRepository({
    required AppDatabase database,
    required AuthController auth,
    http.Client? client,
    String? apiBaseUrl,
  })  : _db = database,
        _auth = auth,
        _client = client ?? http.Client(),
        _apiBaseUrl = apiBaseUrl ??
            const String.fromEnvironment(
              'NYAKI_API_BASE_URL',
              defaultValue: 'http://localhost:8000',
            );

  final AppDatabase _db;
  final AuthController _auth;
  final http.Client _client;
  final String _apiBaseUrl;

  // [Helper Method] _todayLocal
  //    - feat : 현재 시각을 년/월/일로 뽑아서 DateTime 객체로 만들어 반환
  DateTime _todayLocal() {
    final now = DateTime.now();
    return DateTime(now.year, now.month, now.day);
  }

  // [Helper Method] _headers
  //    - feat : Hub 요청에 실어보낼 인증 헤더 (SyncCoordinator와 동일 패턴)
  Map<String, String> _headers(String token) => {
        'Authorization': 'Bearer $token',
        'Content-Type': 'application/json',
      };

  // [Helper Method] _writeCache
  Future<void> _writeCache(String userId, Map<String, dynamic> payload) async {

    // feat : ProgressResponse DTO {churu_balance, completed_today}를 Dart Map에서 캐스팅한다. 
    final churuBalance = payload['churu_balance'] as int;
    final completedQuestIds =
        (payload['completed_today'] as List<dynamic>).cast<String>();
    final today = _todayLocal();

    // 🔑 transaction 🔑
    // - 잔액 + 퀘스트 상태 갱신을 하나의 트랜잭션으로 처리한다. 
    await _db.transaction(() async {
      // balance Upsert 
      await _db.into(_db.userProgress).insertOnConflictUpdate(
            UserProgressCompanion.insert(
              userId: userId,
              churuBalance: Value(churuBalance),
            ),
          );
      // quest Upsert
      for (final questId in completedQuestIds) {
        await _db.into(_db.questState).insertOnConflictUpdate(
              QuestStateCompanion.insert(
                userId: userId,
                questId: questId,
                lastCompletedDate: today,
              ),
            );
      }
    });
  }

  // [Method] loadCached
  // Feat. local db 조회 메서드. 화면 진입 직후와 같이 네트워크 없이 화면에 즉시 값을 보여줄 때 사용한다. 
  Future<ProgressSnapshot> loadCached() async {

    // [Exception] 로그인 검증 
    final userId = _auth.userId;
    if (userId == null) return ProgressSnapshot.empty;

    // 잔액조회
    //  - UserProgress Table에서 유저의 "row"를 찾는다. 
    final progress = await (_db.select(_db.userProgress)
          ..where((row) => row.userId.equals(userId)))
        .getSingleOrNull();

    // 완료 퀘스트 조회 
    //  - QuestState table에서 유저의 날짜가 오늘인 row를 모두 탐색한다.
    final today = _todayLocal();
    final completedRows = await (_db.select(_db.questState)
          ..where(
            (row) =>
                row.userId.equals(userId) &
                row.lastCompletedDate.equals(today),
          ))
        .get();

    // Snapshot 형태로 잔액과, 완료 목록을 반환
    return ProgressSnapshot(
      churuBalance: progress?.churuBalance ?? 0,
      completedQuestIds: completedRows.map((row) => row.questId).toSet(),
    );
  }

  // [Method] refresh
  // Feat. 서버에서 최신 상태를 받아와 _writeCache로 저장하고, loadCache로 다시 읽어 반환하는 동기화 메서드 
  Future<ProgressSnapshot> refresh() async {

    // [Exception] 로그인 검증
    if (_auth.status != AuthStatus.signedIn) return loadCached();
    final userId = _auth.userId;
    final token = await _auth.getIdToken();
    if (userId == null || token == null) return loadCached();

    try {

      // Http get - Authorization header 
      final response = await _client.get(
        Uri.parse('$_apiBaseUrl/v1/progress'),
        headers: _headers(token),
      );

      // Http get fail -> loadCached
      if (response.statusCode < 200 || response.statusCode >= 300) {
        return loadCached();
      }

      final payload = jsonDecode(response.body) as Map<String, dynamic>;
      await _writeCache(userId, payload);
    } catch (_) {
      // 오프라인/서버 오류는 조용히 무시하고 캐시값을 반환한다.
      // 메서드가 실패해도 앱이 죽지 않고 기존 캐시값을 보여주는 원칙 통일 
    }

    return loadCached();
  }


  // [Method] ✨ completeQuest ✨
  // - feat : 특정 퀘스트 (questId)를 완료했다고 Hub 서버에 알리고, 서버가 계산해준 최신 잔액/완료 상태를 받아 로컬 캐시에 반영한다.
  Future<ProgressSnapshot> completeQuest(String questId) async {

    // [Exception] 로그인 검증
    if (_auth.status != AuthStatus.signedIn) return loadCached();
    final userId = _auth.userId;
    final token = await _auth.getIdToken();
    if (userId == null || token == null) return loadCached();

    try {
      final response = await _client.post(
        Uri.parse('$_apiBaseUrl/v1/progress/quests/$questId/complete'),
        headers: _headers(token),
      );
      if (response.statusCode < 200 || response.statusCode >= 300) {
        return loadCached();
      }

      final payload = jsonDecode(response.body) as Map<String, dynamic>;
      await _writeCache(userId, payload);
    } catch (_) {
      // 오프라인/서버 오류는 조용히 무시하고 캐시값을 반환한다.
    }

    return loadCached();
  }
}
