import 'package:flutter/foundation.dart';

import 'auth/auth_controller.dart';
import 'repositories/progress_repository.dart';

/// UI가 구독하는 게이미피케이션(츄르/퀘스트) 상태 레이어.
class ProgressController extends ChangeNotifier {
  ProgressController({
    required ProgressRepository repository,
    required AuthController auth,
  })  : _repository = repository,
        _auth = auth {
    _auth.addListener(refresh);
  }

  final ProgressRepository _repository;
  final AuthController _auth;

  ProgressSnapshot snapshot = ProgressSnapshot.empty;
  bool isReady = false;

  // initialize 
  Future<void> initialize() async {
    // ① Network 없이 LocalDB만 읽어 snapshot에 담는다. 
    snapshot = await _repository.loadCached(); 
    isReady = true;  
    notifyListeners();
    await refresh();
  }

  Future<void> refresh() async {
    snapshot = await _repository.refresh();
    notifyListeners();
  }

  Future<void> completeQuest(String questId) async {
    snapshot = await _repository.completeQuest(questId);
    notifyListeners();
  }

  @override
  void dispose() {
    _auth.removeListener(refresh);
    super.dispose();
  }
}
