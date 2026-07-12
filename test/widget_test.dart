import 'package:aqademiq/app.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:google_fonts/google_fonts.dart';

void main() {
  setUpAll(() => GoogleFonts.config.allowRuntimeFetching = false);

  testWidgets('entry flow: splash -> welcome -> guest -> plan timeline', (tester) async {
    await tester.pumpWidget(const ProviderScope(child: AqademiqApp()));
    await tester.pump();
    expect(find.text('Aqademiq'), findsOneWidget);

    await tester.pump(const Duration(milliseconds: 1700));
    await tester.pump();
    expect(find.text('Jump right in!'), findsOneWidget);

    await tester.tap(find.text('Jump right in!'));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 500));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 700));
    await tester.pump();

    expect(find.text('ANYTIME (2)'), findsOneWidget);
    expect(find.text('PLANNED (2)'), findsOneWidget);
  });
}
