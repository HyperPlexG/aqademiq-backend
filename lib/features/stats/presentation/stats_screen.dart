import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/router/app_router.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_radius.dart';
import '../../../core/theme/app_text.dart';
import '../../../core/utils/launch_external.dart';
import '../../../data/fixtures/fixtures.dart';
import '../../../data/models/mood_log.dart';
import '../../../data/models/user_stats.dart';
import '../../../data/repositories/mood_repository.dart';
import '../../../data/repositories/profile_repository.dart';
import '../../../shared/mascot/ada_mascot.dart';
import '../../../shared/widgets/app_card.dart';
import '../../../shared/widgets/app_scaffold.dart';
import '../../../shared/widgets/share_sheet.dart';
import '../../plan/providers/plan_providers.dart';
import '../../settings/presentation/sheets/rate_sheet.dart';
import '../../settings/providers/profile_controller.dart';

/// FRAMES `profile-top` / `profile-main` — the Profile/Stats tab (one scrollable
/// page: identity + stats + mood week up top, support links + invite hero below).
class StatsScreen extends ConsumerWidget {
  const StatsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final statsAsync = ref.watch(statsProvider);
    return AppScaffold(
      child: statsAsync.when(
        loading: () => Center(child: CircularProgressIndicator(color: context.colors.accent)),
        error: (_, _) => Center(child: Text('Could not load profile', style: AppText.sans(size: 13, color: context.colors.textMed))),
        data: (stats) => _Body(stats: stats),
      ),
    );
  }
}

class _Body extends ConsumerWidget {
  const _Body({required this.stats});
  final UserStats stats;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = context.colors;
    final name = ref.watch(profileControllerProvider).name;
    final streak = ref.watch(streakProvider).value ?? stats.streakDays;
    final completed = ref.watch(weeklyCompletedProvider).value ?? stats.tasksCompletedThisWeek;
    final moods = ref.watch(moodWeekProvider).value ?? stats.weekMoods;

    return ListView(
      padding: EdgeInsets.zero,
      children: [
        Row(
          children: [
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
              decoration: BoxDecoration(color: colors.surface, borderRadius: BorderRadius.circular(AppRadius.pill), boxShadow: colors.cardShadow),
              child: Text(name, style: AppText.sans(size: 12, weight: FontWeight.w700, color: colors.text)),
            ),
            const Spacer(),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 4),
              decoration: BoxDecoration(color: colors.surface, borderRadius: BorderRadius.circular(AppRadius.pill), boxShadow: colors.cardShadow),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  _CircleIcon(icon: Icons.ios_share, onTap: () => unawaited(showShareSheet(context))),
                  const SizedBox(width: 2),
                  _CircleIcon(icon: Icons.settings, onTap: () => context.push(Routes.settings)),
                ],
              ),
            ),
          ],
        ),
        const SizedBox(height: 14),
        Row(
          children: [
            GestureDetector(
              onTap: () => unawaited(context.push(Routes.moodMorning)),
              child: const AdaMascot(size: 46, cheeks: true, sparkles: true),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Keep it frozen, ${name.split(' ').first}', style: AppText.sans(size: 15, weight: FontWeight.w800, letterSpacing: -0.2, color: colors.text)),
                  const SizedBox(height: 2),
                  Text('$streak-day streak · Prism 3 days', style: AppText.sans(size: 10.5, color: colors.textMed)),
                ],
              ),
            ),
          ],
        ),
        const SizedBox(height: 14),
        _StatsCard(streak: streak, completed: completed),
        const SizedBox(height: 8),
        _MoodCard(moods: moods, onAddToday: () => unawaited(context.push(Routes.moodEvening))),
        const SizedBox(height: 16),
        const _LinksCard(),
        const SizedBox(height: 16),
        _InviteHero(onTap: () => unawaited(showShareSheet(context))),
      ],
    );
  }
}

class _CircleIcon extends StatelessWidget {
  const _CircleIcon({required this.icon, required this.onTap});
  final IconData icon;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: onTap,
      child: SizedBox(width: 30, height: 30, child: Icon(icon, size: 16, color: context.colors.text)),
    );
  }
}

class _StatsCard extends StatelessWidget {
  const _StatsCard({required this.streak, required this.completed});
  final int streak;
  final int completed;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return AppCard(
      padding: EdgeInsets.zero,
      child: Row(
        children: [
          Expanded(child: _StatCol(value: '$streak', label: 'DAY STREAK', sub: '$streak/7 days', progress: (streak / 7).clamp(0, 1))),
          Container(width: 1, height: 64, color: colors.border),
          Expanded(child: _StatCol(value: '$completed', label: 'COMPLETED', sub: '$completed/12 tasks', progress: (completed / 12).clamp(0, 1))),
        ],
      ),
    );
  }
}

class _StatCol extends StatelessWidget {
  const _StatCol({required this.value, required this.label, required this.sub, required this.progress});
  final String value;
  final String label;
  final String sub;
  final double progress;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.baseline,
            textBaseline: TextBaseline.alphabetic,
            children: [
              Text(value, style: AppText.numeral(size: 26, color: colors.text)),
              const SizedBox(width: 6),
              Text(label, style: AppText.sans(size: 8.5, weight: FontWeight.w800, letterSpacing: AppText.em(0.1, 8.5), color: colors.textDim)),
            ],
          ),
          Container(
            height: 4,
            margin: const EdgeInsets.fromLTRB(0, 7, 0, 4),
            decoration: BoxDecoration(color: colors.bg, borderRadius: BorderRadius.circular(2)),
            child: FractionallySizedBox(
              alignment: Alignment.centerLeft,
              widthFactor: progress,
              child: Container(decoration: BoxDecoration(color: colors.accent, borderRadius: BorderRadius.circular(2))),
            ),
          ),
          Text(sub, style: AppText.sans(size: 9, color: colors.textDim)),
        ],
      ),
    );
  }
}

class _MoodCard extends StatelessWidget {
  const _MoodCard({required this.moods, required this.onAddToday});

  final List<MoodLog> moods;
  final VoidCallback onAddToday;

  static const _days = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

  int? _moodFor(DateTime monday, int i) {
    final day = monday.add(Duration(days: i));
    int? mood;
    for (final l in moods) {
      if (l.date.year == day.year && l.date.month == day.month && l.date.day == day.day) {
        mood = l.mood;
      }
    }
    return mood;
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final monday = Fixtures.today.subtract(Duration(days: Fixtures.today.weekday - 1));
    final todayIndex = Fixtures.today.weekday - 1;
    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('MOOD & DAILY REFLECTIONS', style: AppText.sans(size: 10, weight: FontWeight.w800, letterSpacing: AppText.em(0.08, 10), color: colors.textDim)),
          const SizedBox(height: 9),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              for (var i = 0; i < 7; i++)
                Column(
                  children: [
                    SizedBox(
                      width: 28,
                      height: 28,
                      child: Center(child: _moodSlot(colors, monday, i, todayIndex)),
                    ),
                    const SizedBox(height: 3),
                    Text(_days[i], style: AppText.sans(size: 9, weight: FontWeight.w700, color: i == todayIndex ? colors.accent : colors.textDim)),
                  ],
                ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _moodSlot(AppColors colors, DateTime monday, int i, int todayIndex) {
    final mood = _moodFor(monday, i);
    if (mood != null) {
      return AdaMascot(size: 24, toneIndex: mood, melt: (4 - mood) / 4, bubbles: 0);
    }
    final isToday = i == todayIndex;
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: isToday ? onAddToday : null,
      child: Container(
        width: 21,
        height: 21,
        alignment: Alignment.center,
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(8),
          border: Border.all(color: isToday ? colors.accent : const Color(0xFFD8D4CC), width: 1.5),
        ),
        child: isToday ? Text('+', style: TextStyle(fontSize: 12, color: colors.accent, fontWeight: FontWeight.w700, height: 1)) : null,
      ),
    );
  }
}

class _LinksCard extends ConsumerWidget {
  const _LinksCard();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = context.colors;
    final links = <(String, VoidCallback)>[
      ('Rate the app', () => unawaited(showRateSheet(context))),
      ('Share feedback', () => unawaited(openExternal(context, Uri(scheme: 'mailto', path: 'hello@aqademiq.app', queryParameters: {'subject': 'Aqademiq feedback'})))),
      ('FAQ', () => unawaited(openExternal(context, Uri.parse('https://aqademiq.app/faq')))),
      ('Follow us on Instagram', () => unawaited(openExternal(context, Uri.parse('https://instagram.com/aqademiq')))),
    ];
    return AppCard(
      child: Column(
        children: [
          for (var i = 0; i < links.length; i++)
            GestureDetector(
              behavior: HitTestBehavior.opaque,
              onTap: links[i].$2,
              child: Container(
                decoration: BoxDecoration(border: i == links.length - 1 ? null : Border(bottom: BorderSide(color: colors.border))),
                padding: const EdgeInsets.symmetric(vertical: 8),
                child: Row(
                  children: [
                    Expanded(child: Text(links[i].$1, style: AppText.sans(size: 12, color: colors.text))),
                    Text('›', style: TextStyle(fontSize: 16, color: colors.textDim)),
                  ],
                ),
              ),
            ),
        ],
      ),
    );
  }
}

class _InviteHero extends StatelessWidget {
  const _InviteHero({required this.onTap});
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 17),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(20),
          gradient: const LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [Color(0xFF6B5CF0), Color(0xFFB39DF5), Color(0xFFE9C8D8)],
            stops: [0, 0.52, 1],
          ),
        ),
        child: Column(
          children: [
            Image.asset('assets/images/logo.png', width: 54, height: 54, fit: BoxFit.contain),
            const SizedBox(height: 2),
            Text('Aqademiq', style: AppText.sans(size: 22, weight: FontWeight.w800, letterSpacing: -0.5, color: Colors.white)),
            const SizedBox(height: 4),
            Text('Your focus sanctuary.', style: AppText.sans(size: 11, weight: FontWeight.w700, color: Colors.white.withValues(alpha: 0.92))),
          ],
        ),
      ),
    );
  }
}
