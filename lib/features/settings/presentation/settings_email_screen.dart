import 'package:flutter/material.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_text.dart';
import '../../../shared/widgets/settings_row.dart';
import 'widgets/settings_scaffold.dart';

/// settings-email — Email settings route.
///
/// Intro paragraph + a single [SetGroup] of marketing-email toggle rows.
/// Toggle state is local to this screen.
class EmailSettingsScreen extends StatefulWidget {
  const EmailSettingsScreen({super.key});

  @override
  State<EmailSettingsScreen> createState() => _EmailSettingsScreenState();
}

class _EmailSettingsScreenState extends State<EmailSettingsScreen> {
  bool _productUpdates = true;
  bool _studyTips = true;
  bool _offers = false;
  bool _research = false;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return SettingsScaffold(
      title: 'Email settings',
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(2, 0, 2, 20),
          child: Text(
            "We'll only reach out when it's genuinely useful — a new feature, "
            "a study tip, or the occasional offer. You're in control, and you "
            'can change this anytime.',
            style: AppText.sans(size: 13, height: 1.55, color: colors.text),
          ),
        ),
        SetGroup(
          children: [
            SettingsRow(
              label: 'Product updates',
              toggle: _productUpdates,
              onToggle: (v) => setState(() => _productUpdates = v),
            ),
            SettingsRow(
              label: 'Study tips & guides',
              toggle: _studyTips,
              onToggle: (v) => setState(() => _studyTips = v),
            ),
            SettingsRow(
              label: 'Offers & promotions',
              toggle: _offers,
              onToggle: (v) => setState(() => _offers = v),
            ),
            SettingsRow(
              label: 'Research & surveys',
              toggle: _research,
              onToggle: (v) => setState(() => _research = v),
              last: true,
            ),
          ],
        ),
      ],
    );
  }
}
