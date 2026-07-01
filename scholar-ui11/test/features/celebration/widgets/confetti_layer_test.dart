import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:iskonnectttt/features/celebration/widgets/confetti_layer.dart';

void main() {
  testWidgets('ConfettiLayer builds and animates continuously without throwing', (tester) async {
    await tester.pumpWidget(
      const MaterialApp(
        home: Scaffold(body: ConfettiLayer()),
      ),
    );

    expect(find.byType(ConfettiLayer), findsOneWidget);
    expect(tester.takeException(), isNull);

    await tester.pump(const Duration(seconds: 2));
    expect(tester.takeException(), isNull);

    // Crosses the loop boundary (default cycle is 5s) — should wrap cleanly.
    await tester.pump(const Duration(seconds: 4));
    expect(tester.takeException(), isNull);
  });
}
