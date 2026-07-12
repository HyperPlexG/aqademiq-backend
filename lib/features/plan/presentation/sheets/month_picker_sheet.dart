import 'package:flutter/material.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_text.dart';
import '../../../../shared/widgets/calendar_grid.dart';

/// One month the calendar popup can show. The prototype only ships June (the
/// selected month, `plan-month`) and its July advance (`plan-month-next`).
class _MonthView {
  const _MonthView({
    required this.year,
    required this.month,
    required this.firstCol,
    required this.total,
    this.accentDay,
  });

  final int year;
  final int month;
  final int firstCol;
  final int total;
  final int? accentDay;

  String get label => '${_monthNames[month - 1]} $year';
}

const _monthNames = <String>[
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

// June 2026 — day 1 lands on Monday (firstCol 0), 30 days, day 3 selected.
const _june = _MonthView(
  year: 2026,
  month: 6,
  firstCol: 0,
  total: 30,
  accentDay: 3,
);

// July 2026 — day 1 lands on Wednesday (firstCol 2), 31 days, no selection.
const _july = _MonthView(year: 2026, month: 7, firstCol: 2, total: 31);

/// Presents the month picker popup (`plan-month` / `plan-month-next` /
/// `plan-monthyear`): a white card that drops from beneath the dimmed planner
/// header. Tapping a day returns that [DateTime]; the title chevron flips the
/// card to a month/year wheel that also returns a [DateTime]. Returns `null` on
/// dismiss.
Future<DateTime?> showMonthPicker(
  BuildContext context, {
  DateTime? selected,
}) {
  return showDialog<DateTime>(
    context: context,
    barrierColor: const Color(0x47140F1C),
    builder: (_) => const _MonthPickerPopup(),
  );
}

class _MonthPickerPopup extends StatelessWidget {
  const _MonthPickerPopup();

  @override
  Widget build(BuildContext context) {
    final topInset = MediaQuery.of(context).padding.top + 92;
    return Align(
      alignment: Alignment.topCenter,
      child: Padding(
        padding: EdgeInsets.only(top: topInset, left: 12, right: 12),
        child: const _MonthCard(),
      ),
    );
  }
}

class _MonthCard extends StatefulWidget {
  const _MonthCard();

  @override
  State<_MonthCard> createState() => _MonthCardState();
}

class _MonthCardState extends State<_MonthCard> {
  bool _wheelOpen = false;
  late _MonthView _view = _june;

  void _prevMonth() {
    if (_view.month == _july.month) setState(() => _view = _june);
  }

  void _nextMonth() {
    if (_view.month == _june.month) setState(() => _view = _july);
  }

  void _pickDay(int day) =>
      Navigator.of(context).pop(DateTime(_view.year, _view.month, day));

  void _pickFromWheel(int month, int year) =>
      Navigator.of(context).pop(DateTime(year, month));

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return Material(
      type: MaterialType.transparency,
      child: Container(
        decoration: BoxDecoration(
          color: colors.surface,
          borderRadius: BorderRadius.circular(22),
          boxShadow: const [
            BoxShadow(
              color: Color(0x29000000),
              blurRadius: 44,
              offset: Offset(0, 14),
            ),
          ],
        ),
        padding: _wheelOpen
            ? const EdgeInsets.fromLTRB(15, 15, 15, 22)
            : const EdgeInsets.fromLTRB(15, 15, 15, 18),
        child: _wheelOpen
            ? _WheelBody(
                view: _view,
                onClose: () => setState(() => _wheelOpen = false),
                onPick: _pickFromWheel,
              )
            : _CalendarBody(
                view: _view,
                onOpenWheel: () => setState(() => _wheelOpen = true),
                onPrev: _prevMonth,
                onNext: _nextMonth,
                onDayTap: _pickDay,
              ),
      ),
    );
  }
}

class _CalendarBody extends StatelessWidget {
  const _CalendarBody({
    required this.view,
    required this.onOpenWheel,
    required this.onPrev,
    required this.onNext,
    required this.onDayTap,
  });

  final _MonthView view;
  final VoidCallback onOpenWheel;
  final VoidCallback onPrev;
  final VoidCallback onNext;
  final ValueChanged<int> onDayTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            GestureDetector(
              behavior: HitTestBehavior.opaque,
              onTap: onOpenWheel,
              child: Row(
                children: [
                  Text(
                    view.label,
                    style: AppText.sans(
                      size: 17,
                      weight: FontWeight.w800,
                      color: colors.text,
                    ),
                  ),
                  const SizedBox(width: 3),
                  Icon(Icons.chevron_right, size: 16, color: colors.accent),
                ],
              ),
            ),
            Row(
              children: [
                GestureDetector(
                  behavior: HitTestBehavior.opaque,
                  onTap: onPrev,
                  child: Icon(
                    Icons.chevron_left,
                    size: 20,
                    color: colors.text,
                  ),
                ),
                const SizedBox(width: 16),
                GestureDetector(
                  behavior: HitTestBehavior.opaque,
                  onTap: onNext,
                  child: Icon(
                    Icons.chevron_right,
                    size: 20,
                    color: colors.text,
                  ),
                ),
              ],
            ),
          ],
        ),
        const SizedBox(height: 14),
        CalendarGrid(
          firstCol: view.firstCol,
          total: view.total,
          accentDay: view.accentDay,
          onDayTap: onDayTap,
        ),
      ],
    );
  }
}

class _WheelBody extends StatelessWidget {
  const _WheelBody({
    required this.view,
    required this.onClose,
    required this.onPick,
  });

  final _MonthView view;
  final VoidCallback onClose;
  final void Function(int month, int year) onPick;

  static const _months = <String>[
    'April',
    'May',
    'June',
    'July',
    'August',
  ];
  static const _monthNums = <int>[4, 5, 6, 7, 8];
  static const _years = <int>[2024, 2025, 2026, 2027, 2028];
  static const _opacities = <double>[0.28, 0.5, 1, 0.5, 0.28];

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        GestureDetector(
          behavior: HitTestBehavior.opaque,
          onTap: onClose,
          child: Row(
            children: [
              Text(
                view.label,
                style: AppText.sans(
                  size: 17,
                  weight: FontWeight.w800,
                  color: colors.accent,
                ),
              ),
              const SizedBox(width: 3),
              Icon(Icons.expand_more, size: 16, color: colors.accent),
            ],
          ),
        ),
        const SizedBox(height: 10),
        Stack(
          alignment: Alignment.center,
          children: [
            Positioned(
              left: -4,
              right: -4,
              child: Container(
                height: 42,
                decoration: BoxDecoration(
                  color: colors.accentSoft,
                  borderRadius: BorderRadius.circular(12),
                ),
              ),
            ),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 6),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(
                    child: _WheelColumn(
                      labels: _months,
                      alignEnd: false,
                      onTapCenter: () => onPick(_monthNums[2], view.year),
                    ),
                  ),
                  Expanded(
                    child: _WheelColumn(
                      labels: [for (final y in _years) '$y'],
                      alignEnd: true,
                      onTapCenter: () => onPick(view.month, _years[2]),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ],
    );
  }
}

class _WheelColumn extends StatelessWidget {
  const _WheelColumn({
    required this.labels,
    required this.alignEnd,
    required this.onTapCenter,
  });

  final List<String> labels;
  final bool alignEnd;
  final VoidCallback onTapCenter;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return Column(
      crossAxisAlignment:
          alignEnd ? CrossAxisAlignment.end : CrossAxisAlignment.start,
      children: [
        for (var i = 0; i < labels.length; i++)
          SizedBox(
            height: 42,
            child: Align(
              alignment: alignEnd ? Alignment.centerRight : Alignment.centerLeft,
              child: Opacity(
                opacity: _WheelBody._opacities[i],
                child: GestureDetector(
                  behavior: HitTestBehavior.opaque,
                  onTap: i == 2 ? onTapCenter : null,
                  child: Text(
                    labels[i],
                    style: AppText.sans(
                      size: i == 2 ? 22 : 19,
                      weight: i == 2 ? FontWeight.w800 : FontWeight.w600,
                      color: colors.text,
                    ),
                  ),
                ),
              ),
            ),
          ),
      ],
    );
  }
}
