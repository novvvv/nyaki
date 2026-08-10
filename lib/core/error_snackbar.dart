import 'package:flutter/material.dart';

// ===============================================
// ✨ error_snackbar.dart ✨
// - 동작(저장/삭제/로그인 등) 실패 시 여러 화면에서 공통으로 쓰는 에러 스낵바.
// - Dart 예외의 toString()을 사용자에게 그대로 보여주지 않기 위한 용도.
//   실제 원인은 콘솔에만 남기고, 사용자에게는 상황에 맞는 짧은 문구만 보여준다.
// ===============================================

// [function] showErrorSnackBar
// - context가 이미 unmounted면 아무것도 하지 않는다 (호출부에서 mounted 체크를 또 안 해도 됨).
// - message를 안 주면 범용 문구를 쓴다. error를 같이 넘기면 콘솔에 원인을 남긴다(디버깅용, 사용자 노출 아님).
void showErrorSnackBar(
  BuildContext context, {
  String message = '문제가 발생했어요. 잠시 후 다시 시도해 주세요.',
  Object? error,
}) {
  if (!context.mounted) return;
  if (error != null) debugPrint('[Nyaki] $message ($error)');
  ScaffoldMessenger.of(context).showSnackBar(
    SnackBar(content: Text(message)),
  );
}
