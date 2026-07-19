import 'package:firebase_auth/firebase_auth.dart' as firebase;
import 'package:google_sign_in/google_sign_in.dart';

import 'auth_repository.dart';

/// Firebase Authentication + Google Sign-In 구현.
class FirebaseAuthRepository implements AuthRepository {
  FirebaseAuthRepository({
    firebase.FirebaseAuth? auth,
    GoogleSignIn? googleSignIn,
  })  : _auth = auth ?? firebase.FirebaseAuth.instance,
        _googleSignIn = googleSignIn ?? GoogleSignIn(scopes: const ['email']);

  final firebase.FirebaseAuth _auth;
  final GoogleSignIn _googleSignIn;

  @override
  Future<AuthUser?> restoreSession() async {
    final user = _auth.currentUser;
    if (user == null) return null;
    return _mapUser(user);
  }

  @override
  Future<AuthUser> signInWithApple() async {
    throw AuthException('Apple 로그인은 아직 준비 중이에요.');
  }

  @override
  Future<AuthUser> signInWithGoogle() async {
    try {
      final googleUser = await _googleSignIn.signIn();
      if (googleUser == null) {
        throw AuthCancelledException();
      }

      final googleAuth = await googleUser.authentication;
      final credential = firebase.GoogleAuthProvider.credential(
        accessToken: googleAuth.accessToken,
        idToken: googleAuth.idToken,
      );

      final result = await _auth.signInWithCredential(credential);
      final user = result.user;
      if (user == null) {
        throw AuthException('Google 로그인에 실패했어요. 다시 시도해 주세요.');
      }
      return _mapUser(user, preferredProvider: SignInProvider.google);
    } on AuthCancelledException {
      rethrow;
    } on firebase.FirebaseAuthException catch (error) {
      throw AuthException(_firebaseMessage(error));
    } catch (error) {
      if (error is AuthException) rethrow;
      throw AuthException('Google 로그인에 실패했어요. 다시 시도해 주세요.');
    }
  }

  @override
  Future<void> signOut() async {
    await Future.wait([
      _auth.signOut(),
      _googleSignIn.signOut(),
    ]);
  }

  AuthUser _mapUser(
    firebase.User user, {
    SignInProvider? preferredProvider,
  }) {
    final provider = preferredProvider ??
        (user.providerData.any((info) => info.providerId == 'apple.com')
            ? SignInProvider.apple
            : SignInProvider.google);

    return AuthUser(
      uid: user.uid,
      displayName: user.displayName,
      email: user.email,
      provider: provider,
    );
  }

  String _firebaseMessage(firebase.FirebaseAuthException error) {
    switch (error.code) {
      case 'network-request-failed':
        return '네트워크 연결을 확인해 주세요.';
      case 'account-exists-with-different-credential':
        return '이미 다른 로그인 방식으로 가입된 계정이에요.';
      case 'user-disabled':
        return '비활성화된 계정이에요.';
      default:
        return '로그인에 실패했어요. 다시 시도해 주세요.';
    }
  }
}
