import 'package:flutter/material.dart';

class HomeScreen extends StatelessWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final width = MediaQuery.sizeOf(context).width;
    final catSize = (width * 0.68).clamp(220.0, 260.0);

    return Center(
      child: SizedBox(
        width: catSize,
        height: catSize,
        child: Image.asset(
          'assets/images/cat.png',
          fit: BoxFit.contain,
        ),
      ),
    );
  }
}
