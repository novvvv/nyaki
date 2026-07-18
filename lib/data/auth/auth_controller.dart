import 'package:flutter/foundation.dart';

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
  AuthController(this._repository);

  final AuthRepository _repository;

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

  Future<void> initialize() async {
    final restored = await _repository.restoreSession();
    _user = restored;
    _status = restored == null ? AuthStatus.signedOut : AuthStatus.signedIn;
    notifyListeners();
  }

  /// 로그인 없이 로컬 전용 모드로 진입.
  void skipSignIn() {
    _skipped = true;
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
    } finally {
      _busy = false;
      notifyListeners();
    }
  }

  Future<void> signOut() async {
    await _repository.signOut();
    _user = null;
    _status = AuthStatus.signedOut;
    _skipped = false;
    notifyListeners();
  }
}
