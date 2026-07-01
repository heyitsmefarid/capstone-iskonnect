import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:iskonnectttt/features/celebration/widgets/score_ring.dart';

void main() {
  testWidgets('ScoreRing animates fill and count-up to the target value', (tester) async {
    await tester.pumpWidget(
      const MaterialApp(
        home: Scaffold(
          body: ScoreRing(value: 18, max: 20, label: 'REQUIREMENTS'),
        ),
      ),
    );

    // At the very start of the fill animation it hasn't reached the target.
    await tester.pump();
    expect(find.text('18/20'), findsNothing);

    // After the default fill duration it settles on the target value.
    await tester.pump(const Duration(milliseconds: 1100));
    expect(find.text('18/20'), findsOneWidget);
    expect(find.text('REQUIREMENTS'), findsOneWidget);
  });
}
