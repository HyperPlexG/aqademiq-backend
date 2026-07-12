import 'package:flutter/material.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_radius.dart';
import '../../../../core/theme/app_text.dart';

/// Opens the settings-rate sheet ("Rate Aqademiq").
///
/// The real settings screen behind is dimmed by the barrier — do not rebuild it.
Future<void> showRateSheet(BuildContext context) {
  return showModalBottomSheet<void>(
    context: context,
    backgroundColor: Colors.transparent,
    barrierColor: const Color(0x6B140F1C),
    isScrollControlled: true,
    builder: (_) => const _RateSheet(),
  );
}

class _RateSheet extends StatefulWidget {
  const _RateSheet();

  @override
  State<_RateSheet> createState() => _RateSheetState();
}

class _RateSheetState extends State<_RateSheet> {
  int _rating = 0;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final hasRating = _rating > 0;

    return SafeArea(
      top: false,
      child: Container(
        decoration: BoxDecoration(
          color: colors.surface,
          borderRadius: const BorderRadius.vertical(
            top: Radius.circular(AppRadius.sheetTop),
          ),
          boxShadow: colors.sheetShadow,
        ),
        padding: const EdgeInsets.fromLTRB(18, 12, 18, 24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 38,
              height: 4,
              margin: const EdgeInsets.only(bottom: 16),
              decoration: BoxDecoration(
                color: const Color(0xFFE0DDD7),
                borderRadius: BorderRadius.circular(2),
              ),
            ),
            Text(
              'Rate Aqademiq',
              style: AppText.sans(
                size: 20,
                weight: FontWeight.w800,
                color: colors.text,
              ),
            ),
            const SizedBox(height: 16),
            Text(
              'How has Aqademiq been treating you?',
              textAlign: TextAlign.center,
              style: AppText.sans(size: 12.5, color: colors.textMed),
            ),
            const SizedBox(height: 16),
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                for (var i = 1; i <= 5; i++) ...[
                  if (i > 1) const SizedBox(width: 14),
                  GestureDetector(
                    onTap: () => setState(() => _rating = i),
                    child: Icon(
                      Icons.star_outline,
                      size: 30,
                      color: i <= _rating
                          ? colors.accent
                          : const Color(0xFFC9C5BD),
                    ),
                  ),
                ],
              ],
            ),
            const SizedBox(height: 20),
            GestureDetector(
              onTap: hasRating ? () => Navigator.of(context).pop() : null,
              child: Container(
                width: double.infinity,
                padding: const EdgeInsets.symmetric(vertical: 13),
                decoration: BoxDecoration(
                  color: hasRating ? colors.ink : colors.hilite,
                  borderRadius: BorderRadius.circular(AppRadius.pill),
                ),
                child: Text(
                  'Submit rating',
                  textAlign: TextAlign.center,
                  style: AppText.sans(
                    size: 13.5,
                    weight: FontWeight.w800,
                    color: hasRating ? Colors.white : const Color(0xFFB0AAA2),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
