import 'package:flutter/material.dart';

/// Google Drive 브랜드 마크 (에셋 없이 단순 삼각형).
class GoogleDriveMark extends StatelessWidget {
  const GoogleDriveMark({super.key, this.size = 36});

  final double size;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: size,
      height: size,
      child: CustomPaint(
        painter: _GoogleDriveMarkPainter(),
      ),
    );
  }
}

class _GoogleDriveMarkPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final w = size.width;
    final h = size.height;
    final centerX = w / 2;

    final green = Paint()..color = const Color(0xFF0F9D58);
    final yellow = Paint()..color = const Color(0xFFF4B400);
    final blue = Paint()..color = const Color(0xFF4285F4);

    final top = Path()
      ..moveTo(centerX, h * 0.08)
      ..lineTo(w * 0.92, h * 0.55)
      ..lineTo(w * 0.08, h * 0.55)
      ..close();
    canvas.drawPath(top, yellow);

    final left = Path()
      ..moveTo(w * 0.08, h * 0.55)
      ..lineTo(centerX, h * 0.92)
      ..lineTo(centerX, h * 0.55)
      ..close();
    canvas.drawPath(left, green);

    final right = Path()
      ..moveTo(w * 0.92, h * 0.55)
      ..lineTo(centerX, h * 0.92)
      ..lineTo(centerX, h * 0.55)
      ..close();
    canvas.drawPath(right, blue);
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}
