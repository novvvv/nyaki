import 'package:flutter/material.dart';

class HomeScreen extends StatelessWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final width = MediaQuery.sizeOf(context).width;
    final catSize = (width * 0.44).clamp(144.0, 192.0);

    return Center(
      child: SizedBox(
        width: catSize,
        height: catSize,
        child: Image.asset(
          'assets/images/nyangki_sleeping.png',
          fit: BoxFit.contain,
        ),
      ),
    );
  }
}
