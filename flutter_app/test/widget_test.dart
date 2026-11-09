import 'package:flutter_test/flutter_test.dart';

import 'package:bawaal_flutter/main.dart';
import 'package:bawaal_flutter/screens/registration_page.dart';

void main() {
  testWidgets('BAWAAL app opens registration screen', (tester) async {
    await tester.pumpWidget(const BawaalApp());
    await tester.pump();

    expect(find.byType(RegistrationPage), findsOneWidget);
    expect(find.text('CONTINUE'), findsOneWidget);
  });
}
