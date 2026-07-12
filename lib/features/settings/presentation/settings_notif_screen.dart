import 'package:flutter/material.dart';

import '../../../shared/widgets/settings_row.dart';
import 'sheets/notif_sound_sheet.dart';
import 'widgets/settings_scaffold.dart';

/// FRAMES `settings-notif` (+ `settings-notif-more`, the same screen scrolled) —
/// the Notifications route. All notification groups live in one scrollable list.
class NotificationsScreen extends StatefulWidget {
  const NotificationsScreen({super.key});

  @override
  State<NotificationsScreen> createState() => _NotificationsScreenState();
}

class _NotificationsScreenState extends State<NotificationsScreen> {
  bool _beforeTask = false;
  bool _taskStarts = true;
  bool _halfway = false;
  bool _taskFinished = false;
  bool _allDay = true;
  bool _morning = true;
  bool _reviewToday = true;
  bool _stateOfMind = true;
  bool _motivational = true;
  bool _productUpdates = true;

  TimeOfDay _allDayTime = const TimeOfDay(hour: 7, minute: 0);
  TimeOfDay _morningTime = const TimeOfDay(hour: 8, minute: 0);
  TimeOfDay _reviewTime = const TimeOfDay(hour: 20, minute: 0);

  Future<void> _pickTime(TimeOfDay current, ValueChanged<TimeOfDay> apply) async {
    final picked = await showTimePicker(context: context, initialTime: current);
    if (picked != null) setState(() => apply(picked));
  }

  @override
  Widget build(BuildContext context) {
    return SettingsScaffold(
      title: 'Notifications',
      children: [
        SetGroup(
          children: [
            SettingsRow(
              label: 'Notification sound',
              value: 'Chime',
              showChevron: true,
              last: true,
              onTap: () => showNotifSoundSheet(context),
            ),
          ],
        ),
        const SizedBox(height: 18),
        const GroupLabel('Tasks'),
        SetGroup(
          children: [
            SettingsRow(
              label: 'Before task',
              toggle: _beforeTask,
              onToggle: (v) => setState(() => _beforeTask = v),
            ),
            SettingsRow(
              label: 'When a task starts',
              toggle: _taskStarts,
              onToggle: (v) => setState(() => _taskStarts = v),
            ),
            SettingsRow(
              label: 'Halfway through task',
              toggle: _halfway,
              onToggle: (v) => setState(() => _halfway = v),
            ),
            SettingsRow(
              label: 'When a task is finished',
              toggle: _taskFinished,
              onToggle: (v) => setState(() => _taskFinished = v),
              last: true,
            ),
          ],
        ),
        const SizedBox(height: 18),
        const GroupLabel('Time of day reminders'),
        SetGroup(
          children: [
            SettingsRow(
              label: 'All day & anytime',
              toggle: _allDay,
              onToggle: (v) => setState(() => _allDay = v),
            ),
            SettingsRow(
              label: 'At time',
              pill: _allDayTime.format(context),
              onTap: () => _pickTime(_allDayTime, (v) => _allDayTime = v),
            ),
            SettingsRow(
              label: 'Morning',
              toggle: _morning,
              onToggle: (v) => setState(() => _morning = v),
            ),
            SettingsRow(
              label: 'At time',
              pill: _morningTime.format(context),
              last: true,
              onTap: () => _pickTime(_morningTime, (v) => _morningTime = v),
            ),
          ],
        ),
        const SizedBox(height: 18),
        const GroupLabel('Review your day'),
        SetGroup(
          children: [
            SettingsRow(
              label: 'Review today notifications',
              toggle: _reviewToday,
              onToggle: (v) => setState(() => _reviewToday = v),
            ),
            SettingsRow(
              label: 'At time',
              pill: _reviewTime.format(context),
              last: true,
              onTap: () => _pickTime(_reviewTime, (v) => _reviewTime = v),
            ),
          ],
        ),
        const SizedBox(height: 18),
        const GroupLabel('Other'),
        SetGroup(
          children: [
            SettingsRow(
              label: 'State of mind reminder',
              toggle: _stateOfMind,
              onToggle: (v) => setState(() => _stateOfMind = v),
            ),
            SettingsRow(
              label: 'Motivational',
              toggle: _motivational,
              onToggle: (v) => setState(() => _motivational = v),
            ),
            SettingsRow(
              label: 'Product updates',
              toggle: _productUpdates,
              onToggle: (v) => setState(() => _productUpdates = v),
              last: true,
            ),
          ],
        ),
      ],
    );
  }
}
