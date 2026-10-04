import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../theme/exam_shape.dart';
import '../theme/theme.dart';
import 'space.dart';

/// Opens [space] and remembers it, so the app reopens there.
void openSpace(BuildContext context, WidgetRef ref, Space space) {
  ref.read(lastSpaceProvider.notifier).set(space);
  context.go(space.home);
}

/// The space's icon on its shape, in its colours.
class SpaceIcon extends StatelessWidget {
  const SpaceIcon(this.space, {super.key, this.size = 48});

  final Space space;
  final double size;

  @override
  Widget build(BuildContext context) {
    final colors = space.colors(context);
    final light = Theme.of(context).brightness == Brightness.light;
    return SizedBox.square(
      dimension: size,
      child: Stack(
        alignment: Alignment.center,
        children: [
          ExamShape(space.shape, color: colors.accent, size: size),
          Icon(
            space.icon,
            size: size * 0.46,
            color: light ? Colors.white : colors.container,
          ),
        ],
      ),
    );
  }
}

/// "Coming soon" or "New" next to a space's name.
class SpaceBadge extends StatelessWidget {
  const SpaceBadge(this.label, {super.key, required this.colors});

  final String label;
  final SpaceColors colors;

  @override
  Widget build(BuildContext context) => DecoratedBox(
    decoration: ShapeDecoration(
      color: colors.accent,
      shape: const StadiumBorder(),
    ),
    child: Padding(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      child: Text(
        label,
        style: TextStyle(
          fontSize: 12,
          fontWeight: FontWeight.w700,
          color: Theme.of(context).brightness == Brightness.light
              ? Colors.white
              : colors.container,
        ),
      ),
    ),
  );
}

/// The space's name at the top of its first screen; tapping it opens the
/// switcher.
class SpaceTitle extends StatelessWidget {
  const SpaceTitle(this.space, {super.key});

  final Space space;

  @override
  Widget build(BuildContext context) {
    final color = space.colors(context).accent;
    return Align(
      alignment: AlignmentDirectional.centerStart,
      child: Semantics(
        button: true,
        label: '${space.label}, switch product',
        excludeSemantics: true,
        child: InkWell(
          borderRadius: BorderRadius.circular(12),
          onTap: () => showSpaceSwitcher(context, current: space),
          child: Padding(
            padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 4),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              spacing: 2,
              children: [
                Text(
                  space.label,
                  style: expressive(18, width: 125, weight: 800, color: color),
                ),
                Icon(Icons.arrow_drop_down_rounded, color: color, size: 28),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// The bottom sheet for moving to another product.
Future<void> showSpaceSwitcher(
  BuildContext context, {
  required Space current,
}) => showModalBottomSheet<void>(
  context: context,
  useRootNavigator: true,
  builder: (sheet) => _SwitcherSheet(current: current, outer: context),
);

class _SwitcherSheet extends ConsumerWidget {
  const _SwitcherSheet({required this.current, required this.outer});

  final Space current;

  /// The screen the sheet was opened from, which does the navigating.
  final BuildContext outer;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = Theme.of(context);
    return SafeArea(
      child: SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          spacing: 8,
          children: [
            Padding(
              padding: const EdgeInsets.only(left: 4, bottom: 4),
              child: Text(
                'Switch to',
                style: expressive(24, color: theme.colorScheme.onSurface),
              ),
            ),
            for (final space in Space.values)
              _SwitcherTile(
                space: space,
                current: space == current,
                soon: ref.watch(spaceSoonProvider(space)),
                onTap: () {
                  Navigator.of(context).pop();
                  if (space != current) openSpace(outer, ref, space);
                },
              ),
            Padding(
              padding: const EdgeInsets.only(top: 4),
              child: Text(
                'One account works in all of them.',
                textAlign: TextAlign.center,
                style: theme.textTheme.bodySmall?.copyWith(
                  color: theme.colorScheme.onSurfaceVariant,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _SwitcherTile extends StatelessWidget {
  const _SwitcherTile({
    required this.space,
    required this.current,
    required this.soon,
    required this.onTap,
  });

  final Space space;
  final bool current;
  final bool soon;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = space.colors(context);
    return Semantics(
      selected: current,
      child: Material(
        color: colors.container,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(20),
          side: BorderSide(
            color: current ? colors.accent : Colors.transparent,
            width: 2,
          ),
        ),
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          onTap: onTap,
          child: Padding(
            padding: const EdgeInsets.all(12),
            child: Row(
              spacing: 14,
              children: [
                SpaceIcon(space, size: 44),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    spacing: 2,
                    children: [
                      Text(
                        space.label,
                        style: TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.w700,
                          color: colors.onContainer,
                        ),
                      ),
                      Text(
                        current ? "You're here" : space.tagline,
                        style: TextStyle(color: colors.onContainer),
                      ),
                    ],
                  ),
                ),
                if (current)
                  Icon(Icons.check_circle_rounded, color: colors.accent)
                else if (soon)
                  SpaceBadge('Coming soon', colors: colors),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
