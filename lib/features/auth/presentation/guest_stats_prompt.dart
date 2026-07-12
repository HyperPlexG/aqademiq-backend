import 'dart:ui';

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../core/router/app_router.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_text.dart';
import '../../../shared/widgets/app_card.dart';
import '../../../shared/widgets/primary_button.dart';

/// FRAME `guest-stats` — gated Stats prompt: a blurred fake stats preview behind
/// a bottom sheet inviting the guest to set up their profile.
class GuestStatsPrompt extends StatelessWidget {
  const GuestStatsPrompt({super.key});

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;

    return Scaffold(
      backgroundColor: colors.bg,
      body: const SafeArea(
        child: Padding(
          padding: EdgeInsets.symmetric(horizontal: 16),
          child: Stack(
            children: [
              // Layer A — blurred stats preview (sharp title on top).
              _StatsPreview(),
              // Layer B — bottom sheet CTA.
              Align(
                alignment: Alignment.bottomCenter,
                child: _SetupSheet(),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Sharp page title + a dimmed/blurred column of fake stat cards.
class _StatsPreview extends StatelessWidget {
  const _StatsPreview();

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        // Title sits OUTSIDE the blur wrapper — sharp/full.
        Text(
          'Your stats',
          style: AppText.sans(size: 28, weight: FontWeight.w800, color: colors.text),
        ),
        const SizedBox(height: 14),
        Expanded(
          child: IgnorePointer(
            child: ImageFiltered(
              imageFilter: ImageFilter.blur(sigmaX: 3.5, sigmaY: 3.5),
              child: const Opacity(
                opacity: 0.5,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Row(
                      children: [
                        Expanded(child: _StatCard(label: 'DAY STREAK')),
                        SizedBox(width: 8),
                        Expanded(child: _StatCard(label: 'FOCUS HRS')),
                      ],
                    ),
                    SizedBox(height: 10),
                    _WeeklyFocusCard(),
                    SizedBox(height: 10),
                    _MoodTrendsCard(),
                  ],
                ),
              ),
            ),
          ),
        ),
      ],
    );
  }
}

/// A single placeholder stat card: big `—` value over a tiny caps label.
class _StatCard extends StatelessWidget {
  const _StatCard({required this.label});

  final String label;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;

    return AppCard(
      padding: const EdgeInsets.all(14),
      child: Column(
        children: [
          Text(
            '—',
            style: AppText.numeral(size: 28, color: colors.text),
          ),
          const SizedBox(height: 4),
          Text(
            label,
            style: AppText.sans(
              size: 9,
              weight: FontWeight.w800,
              letterSpacing: AppText.em(0.1, 9),
              color: colors.textDim,
            ),
          ),
        ],
      ),
    );
  }
}

/// Fake weekly-focus bar chart.
class _WeeklyFocusCard extends StatelessWidget {
  const _WeeklyFocusCard();

  static const _heights = <double>[40, 70, 30, 85, 55, 20, 60];

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;

    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            'Weekly focus',
            style: AppText.sans(size: 13, weight: FontWeight.w700, color: colors.text),
          ),
          const SizedBox(height: 8),
          SizedBox(
            height: 44,
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                for (var i = 0; i < _heights.length; i++) ...[
                  if (i > 0) const SizedBox(width: 6),
                  Expanded(
                    child: FractionallySizedBox(
                      heightFactor: _heights[i] / 100,
                      child: Container(
                        decoration: BoxDecoration(
                          color: colors.accent.withValues(alpha: 0.5),
                          borderRadius: BorderRadius.circular(3),
                        ),
                      ),
                    ),
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// Fake mood-trends card (title only).
class _MoodTrendsCard extends StatelessWidget {
  const _MoodTrendsCard();

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;

    return AppCard(
      child: SizedBox(
        height: 46,
        child: Align(
          alignment: Alignment.topLeft,
          child: Text(
            'Mood trends',
            style: AppText.sans(size: 13, weight: FontWeight.w700, color: colors.text),
          ),
        ),
      ),
    );
  }
}

/// The white bottom sheet with the setup CTA.
class _SetupSheet extends StatelessWidget {
  const _SetupSheet();

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.fromLTRB(16, 18, 16, 24),
      decoration: const BoxDecoration(
        color: Color(0xFFFFFFFF),
        borderRadius: BorderRadius.vertical(top: Radius.circular(22)),
        boxShadow: [
          BoxShadow(color: Color(0x24000000), blurRadius: 40, offset: Offset(0, -8)),
        ],
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Grabber.
          Center(
            child: Container(
              width: 36,
              height: 4,
              decoration: BoxDecoration(
                color: const Color(0xFFE0E0E0),
                borderRadius: BorderRadius.circular(2),
              ),
            ),
          ),
          const SizedBox(height: 14),
          Text(
            'Track your progress',
            style: AppText.sans(size: 16, weight: FontWeight.w800, color: colors.text),
          ),
          const SizedBox(height: 3),
          Text(
            'Set up your profile and Ada will track your streaks, focus hours '
            '& mood trends — then tune your plan to match.',
            style: AppText.sans(size: 11.5, height: 1.55, color: colors.textMed),
          ),
          const SizedBox(height: 14),
          PrimaryButton(
            label: 'Set up now · 2 min →',
            onPressed: () => context.go(Routes.obReferral),
          ),
          const SizedBox(height: 8),
          Center(
            child: GestureDetector(
              onTap: () => context.pop(),
              child: Text(
                'Not now',
                style: AppText.sans(size: 11.5, color: colors.textMed),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
