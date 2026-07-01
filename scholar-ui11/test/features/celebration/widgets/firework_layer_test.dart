import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:iskonnectttt/features/celebration/widgets/firework_layer.dart';

void main() {
  testWidgets('FireworkLayer builds and paints across a full burst cycle without throwing', (tester) async {
    await tester.pumpWidget(
      const MaterialApp(
        home: Scaffold(body: FireworkLayer()),
      ),
    );

    expect(tester.takeException(), isNull);

    // Step through an entire 3.6s cycle in 600ms increments.
    for (var i = 0; i < 6; i++) {
      await tester.pump(const Duration(milliseconds: 600));
      expect(tester.takeException(), isNull);
    }
  });
}
