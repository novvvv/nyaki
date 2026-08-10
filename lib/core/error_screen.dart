import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';

import 'theme/nyaki_colors.dart';

// ===============================================
// ✨ error_screen.dart ✨
// - build 중 예외가 발생했을 때(ErrorWidget.builder) 사용자에게 보여줄 화면.
// - Flutter 기본 빨간 화면 대신 노출한다. 실제 에러 내용은 콘솔(FlutterError.onError)로만 남긴다.
// ===============================================

// ⚠️ 테스트용 임시 스위치 ⚠️
// - true로 바꾸면 debug 모드(flutter run)에서도 커스텀 에러 화면이 뜬다.
// - NyakiErrorScreen 디자인/문구를 확인해본 뒤에는 반드시 false로 되돌릴 것.
const bool debugForceNyakiErrorScreen = false;

// [function] installNyakiErrorWidget
// - main()에서 runApp 이전에 한 번 호출한다.
// - debug 모드에서는 기존 빨간 화면(에러 위치를 바로 보기 위함)을 그대로 쓰고,
//   release/profile 모드에서만 사용자용 화면으로 대체한다.
void installNyakiErrorWidget() {
  if (kDebugMode && !debugForceNyakiErrorScreen) return;
  ErrorWidget.builder = (FlutterErrorDetails details) => NyakiErrorScreen(details: details);
}

class NyakiErrorScreen extends StatelessWidget {
  const NyakiErrorScreen({super.key, required this.details});

  final FlutterErrorDetails details;

  @override
  Widget build(BuildContext context) {
    return ColoredBox(
      color: NyakiColors.cream,
      child: Center(
        child: Padding(
          padding: const EdgeInsets.all(28),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(
                Icons.error_outline_rounded,
                size: 40,
                color: NyakiColors.ink.withValues(alpha: 0.45),
              ),
              const SizedBox(height: 12),
              const Text(
                '화면을 표시하는 중 문제가 발생했어요.',
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontFamily: 'Inter',
                  fontSize: 15,
                  fontWeight: FontWeight.w600,
                  color: NyakiColors.ink,
                ),
              ),
              const SizedBox(height: 4),
              Text(
                '잠시 후 다시 시도해 주세요.',
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontFamily: 'Inter',
                  fontSize: 13,
                  color: NyakiColors.ink.withValues(alpha: 0.5),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
