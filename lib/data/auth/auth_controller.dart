import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'auth_repository.dart';

enum AuthStatus {
  /// 세션 복원 확인 중.
  initializing,

  /// 로그인 안 됨 (건너뛰기 포함, 로컬 전용 모드).
  signedOut,

  /// 로그인 완료.
  signedIn,
}

class AuthController extends ChangeNotifier {
  AuthController(this._repository, {SharedPreferences? preferences})
      : _preferences = preferences;

  static const _skipKey = 'auth_skipped_local_mode';

  final AuthRepository _repository;
  SharedPreferences? _preferences;

  AuthStatus _status = AuthStatus.initializing;
  AuthUser? _user;
  bool _skipped = false;
  bool _busy = false;

  AuthStatus get status => _status;
  AuthUser? get user => _user;

  /// 로그인 없이 시작을 선택했는지.
  bool get skipped => _skipped;

  /// 로그인 진행 중 여부 (버튼 중복 탭 방지용).
  bool get busy => _busy;

  /// Firebase UID. 후속 동기화 식별자로 사용. 비로그인이면 null.
  String? get userId => _user?.uid;

  Future<String?> getIdToken() => _repository.getIdToken();

  Future<void> initialize() async {
    _preferences ??= await SharedPreferences.getInstance();
    final restored = await _repository.restoreSession();
    _user = restored;
    if (restored != null) {
      _status = AuthStatus.signedIn;
      _skipped = false;
      await _preferences!.setBool(_skipKey, false);
    } else {
      _status = AuthStatus.signedOut;
      _skipped = _preferences!.getBool(_skipKey) ?? false;
    }
    notifyListeners();
  }

  /// 로그인 없이 로컬 전용 모드로 진입.
  Future<void> skipSignIn() async {
    _preferences ??= await SharedPreferences.getInstance();
    _skipped = true;
    await _preferences!.setBool(_skipKey, true);
    notifyListeners();
  }

  Future<void> signInWithApple() =>
      _signIn(() => _repository.signInWithApple());

  Future<void> signInWithGoogle() =>
      _signIn(() => _repository.signInWithGoogle());

  Future<void> _signIn(Future<AuthUser> Function() run) async {
    if (_busy) return;
    _busy = true;
    notifyListeners();
    try {
      _user = await run();
      _status = AuthStatus.signedIn;
      _skipped = false;
      _preferences ??= await SharedPreferences.getInstance();
      await _preferences!.setBool(_skipKey, false);
    } finally {
      _busy = false;
      notifyListeners();
    }
  }

  Future<void> signOut() async {
    await _repository.signOut();
    _user = null;
    _status = AuthStatus.signedOut;
    // 로그아웃 후에도 로컬 단어장은 유지하고 앱 본체를 계속 쓴다.
    _skipped = true;
    _preferences ??= await SharedPreferences.getInstance();
    await _preferences!.setBool(_skipKey, true);
    notifyListeners();
  }
}
