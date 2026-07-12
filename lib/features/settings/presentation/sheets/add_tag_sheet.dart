import 'package:flutter/material.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_radius.dart';
import '../../../../core/theme/app_text.dart';
import '../../../../shared/widgets/app_bottom_sheet.dart';
import '../../../../shared/widgets/app_text_field.dart';
import '../../../../shared/widgets/primary_button.dart';

/// The created tag returned by [showAddTagSheet] (name + chosen swatch).
typedef TagDraft = ({String label, Color color});

/// FRAMES `settings-addtag` — the "New study tag" sheet on the canonical
/// keyboard-aware shell. Returns the [TagDraft] on "Add tag", or null on
/// dismiss. Preset to name "Tutorial" with the pink (`#e85476`) swatch.
Future<TagDraft?> showAddTagSheet(BuildContext context) {
  return showAppBottomSheet<TagDraft>(
    context,
    title: 'New study tag',
    child: const _AddTagBody(),
  );
}

/// The seven tag palette colours (prototype order).
const _palette = <Color>[
  Color(0xFF5CBBFF),
  Color(0xFF6B5CF0),
  Color(0xFFE85476),
  Color(0xFF2A9D6B),
  Color(0xFFE8A430),
  Color(0xFFC0497B),
  Color(0xFF9AA3B2),
];

class _AddTagBody extends StatefulWidget {
  const _AddTagBody();

  @override
  State<_AddTagBody> createState() => _AddTagBodyState();
}

class _AddTagBodyState extends State<_AddTagBody> {
  final _controller = TextEditingController(text: 'Tutorial');
  Color _selected = const Color(0xFFE85476);

  @override
  void initState() {
    super.initState();
    _controller.addListener(() => setState(() {}));
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _submit() {
    final label = _controller.text.trim();
    if (label.isEmpty) return;
    Navigator.of(context).pop((label: label, color: _selected));
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Center(
          child: _PreviewChip(
            name: _controller.text.isEmpty ? 'Tag' : _controller.text,
            color: _selected,
          ),
        ),
        const SizedBox(height: 18),
        Padding(
          padding: const EdgeInsets.only(left: 2, bottom: 7),
          child: Text(
            'Name',
            style: AppText.sans(size: 12, weight: FontWeight.w700, color: colors.textMed),
          ),
        ),
        AppTextField(controller: _controller),
        const SizedBox(height: 18),
        Padding(
          padding: const EdgeInsets.only(left: 2, bottom: 11),
          child: Text(
            'Colour',
            style: AppText.sans(size: 12, weight: FontWeight.w700, color: colors.textMed),
          ),
        ),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 2),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              for (final c in _palette)
                _Swatch(
                  color: c,
                  selected: c == _selected,
                  onTap: () => setState(() => _selected = c),
                ),
            ],
          ),
        ),
        const SizedBox(height: 22),
        PrimaryButton(label: 'Add tag', onPressed: _submit),
      ],
    );
  }
}

/// Centered live preview of the tag being created (`surface` chip, hairline
/// border, dot + name).
class _PreviewChip extends StatelessWidget {
  const _PreviewChip({required this.name, required this.color});
  final String name;
  final Color color;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 15, vertical: 7),
      decoration: BoxDecoration(
        color: colors.surface,
        borderRadius: BorderRadius.circular(AppRadius.pill),
        border: Border.all(color: colors.border),
        boxShadow: colors.cardShadow,
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 9,
            height: 9,
            decoration: BoxDecoration(color: color, shape: BoxShape.circle),
          ),
          const SizedBox(width: 7),
          Text(
            name,
            style: AppText.sans(size: 13, weight: FontWeight.w700, color: colors.text),
          ),
        ],
      ),
    );
  }
}

/// One 28px colour circle in the palette row. Selected adds a white gap + a
/// colour ring (two box-shadows) and a white check.
class _Swatch extends StatelessWidget {
  const _Swatch({
    required this.color,
    required this.selected,
    required this.onTap,
  });
  final Color color;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: 28,
        height: 28,
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: color,
          shape: BoxShape.circle,
          boxShadow: selected
              ? [
                  const BoxShadow(color: Color(0xFFFFFFFF), spreadRadius: 2),
                  BoxShadow(color: color, spreadRadius: 4),
                ]
              : null,
        ),
        child: selected
            ? const Icon(Icons.check, size: 16, color: Color(0xFFFFFFFF))
            : null,
      ),
    );
  }
}
