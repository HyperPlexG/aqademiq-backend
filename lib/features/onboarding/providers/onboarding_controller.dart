import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../data/auth/auth_repository.dart';

/// The multi-step onboarding draft (README §6: name, subjects, moods, peak time,
/// goal, prism). Held across the step routes; on [OnboardingController.finish]
/// the guest is linked to a real account so the app shows the onboarded state.
class OnboardingDraft {
  const OnboardingDraft({
    this.referral = '',
    this.name = '',
    this.level = 'Undergraduate',
    this.subjects = const ['Engineering', 'CS'],
    this.subjectMoods = const {'Engineering': 2, 'Computer Science': 4},
    this.peakTimes = const ['Afternoon'],
    this.focusGoalHrs = 3,
    this.prismMode = 'Deep Work',
  });

  final String referral;
  final String name;
  final String level;
  final List<String> subjects;
  final Map<String, int> subjectMoods;
  final List<String> peakTimes;
  final double focusGoalHrs;
  final String prismMode;

  OnboardingDraft copyWith({
    String? referral,
    String? name,
    String? level,
    List<String>? subjects,
    Map<String, int>? subjectMoods,
    List<String>? peakTimes,
    double? focusGoalHrs,
    String? prismMode,
  }) {
    return OnboardingDraft(
      referral: referral ?? this.referral,
      name: name ?? this.name,
      level: level ?? this.level,
      subjects: subjects ?? this.subjects,
      subjectMoods: subjectMoods ?? this.subjectMoods,
      peakTimes: peakTimes ?? this.peakTimes,
      focusGoalHrs: focusGoalHrs ?? this.focusGoalHrs,
      prismMode: prismMode ?? this.prismMode,
    );
  }
}

final onboardingProvider =
    NotifierProvider<OnboardingController, OnboardingDraft>(OnboardingController.new);

class OnboardingController extends Notifier<OnboardingDraft> {
  @override
  OnboardingDraft build() => const OnboardingDraft();

  void setReferral(String v) => state = state.copyWith(referral: v);
  void setName(String v) => state = state.copyWith(name: v);
  void setLevel(String v) => state = state.copyWith(level: v);

  /// Peak times are multi-select (ONB-3) — tap toggles membership.
  void togglePeakTime(String v) {
    final next = [...state.peakTimes];
    next.contains(v) ? next.remove(v) : next.add(v);
    state = state.copyWith(peakTimes: next);
  }

  void setFocusGoal(double v) => state = state.copyWith(focusGoalHrs: v);
  void setPrismMode(String v) => state = state.copyWith(prismMode: v);

  void toggleSubject(String s) {
    final next = [...state.subjects];
    next.contains(s) ? next.remove(s) : next.add(s);
    state = state.copyWith(subjects: next);
  }

  void setSubjectMood(String subject, int mood) =>
      state = state.copyWith(subjectMoods: {...state.subjectMoods, subject: mood});

  /// Completes onboarding: links the guest to a real account so the app shows
  /// the onboarded (non-guest) experience.
  Future<void> finish() async {
    final auth = ref.read(authRepositoryProvider);
    if (auth.currentUser?.isGuest ?? true) {
      await auth.linkGuestToAccount(
        email: 'you@aqademiq.app',
        password: 'onboarded',
      );
    }
  }
}
