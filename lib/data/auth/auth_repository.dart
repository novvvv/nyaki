/// 로그인된 사용자 정보. Firebase 연동 후 UID 기반으로 채워진다.
class AuthUser {
  const AuthUser({
    required this.uid,
    this.displayName,
    this.email,
    required this.provider,
  });

  final String uid;
  final String? displayName;
  final String? email;
  final AuthProvider provider;
}

enum AuthProvider { apple, google }

/// 사용자가 로그인 창을 직접 닫은 경우.
class AuthCancelledException implements Exception {}

class AuthException implements Exception {
  AuthException(this.message);

  final String message;

  @override
  String toString() => message;
}

/// 인증 계약. Firebase 구현체로 교체 예정.
abstract class AuthRepository {
  /// 앱 시작 시 이전 세션 복원. 없으면 null.
  Future<AuthUser?> restoreSession();

  Future<AuthUser> signInWithApple();

  Future<AuthUser> signInWithGoogle();

  Future<void> signOut();
}

/// Firebase 설정 전까지 사용하는 스텁.
/// 로그인 시도 시 안내 메시지를 던지고, 세션은 항상 없음으로 취급한다.
class UnconfiguredAuthRepository implements AuthRepository {
  static const _message = '로그인 서버 준비 중이에요. 지금은 로그인 없이 시작해 주세요.';

  @override
  Future<AuthUser?> restoreSession() async => null;

  @override
  Future<AuthUser> signInWithApple() async => throw AuthException(_message);

  @override
  Future<AuthUser> signInWithGoogle() async => throw AuthException(_message);

  @override
  Future<void> signOut() async {}
}
