/// 로그인된 사용자 정보. Firebase UID 기반으로 채워진다.
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
  final SignInProvider provider;
}

enum SignInProvider { apple, google }

/// 사용자가 로그인 창을 직접 닫은 경우.
class AuthCancelledException implements Exception {}

class AuthException implements Exception {
  AuthException(this.message);

  final String message;

  @override
  String toString() => message;
}

/// 인증 계약. Firebase 구현체로 교체 가능.
abstract class AuthRepository {
  /// 앱 시작 시 이전 세션 복원. 없으면 null.
  Future<AuthUser?> restoreSession();

  Future<AuthUser> signInWithApple();

  Future<AuthUser> signInWithGoogle();

  Future<void> signOut();
}
