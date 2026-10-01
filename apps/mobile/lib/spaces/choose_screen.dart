import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../theme/theme.dart';
import 'space.dart';
import 'switcher.dart';

/// First launch: which product to open. After that the app opens in the space
/// used last.
class ChooseScreen extends ConsumerWidget {
  const ChooseScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = Theme.of(context);
    final scheme = theme.colorScheme;
    return Scaffold(
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 24),
          children: [
            Text(
              'OurDIU',
              style: expressive(
                18,
                width: 125,
                weight: 800,
                color: scheme.primary,
              ),
            ),
            const SizedBox(height: 20),
            Text(
              'What do you need?',
              style: expressive(44, color: scheme.onSurface),
            ),
            const SizedBox(height: 24),
            for (final space in Space.values) ...[
              _ChoiceTile(
                space: space,
                onTap: () => openSpace(context, ref, space),
              ),
              const SizedBox(height: 12),
            ],
            const SizedBox(height: 4),
            Text(
              'You can switch any time from the top of the screen.',
              textAlign: TextAlign.center,
              style: theme.textTheme.bodyMedium?.copyWith(
                color: scheme.onSurfaceVariant,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _ChoiceTile extends StatelessWidget {
  const _ChoiceTile({required this.space, required this.onTap});

  final Space space;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = space.colors(context);
    return Opacity(
      opacity: space.live ? 1 : 0.78,
      child: Material(
        color: colors.container,
        borderRadius: BorderRadius.circular(28),
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          onTap: onTap,
          child: Padding(
            padding: const EdgeInsets.all(20),
            child: Row(
              spacing: 16,
              children: [
                SpaceIcon(space, size: 64),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    spacing: 4,
                    children: [
                      if (!space.live)
                        Padding(
                          padding: const EdgeInsets.only(bottom: 4),
                          child: SpaceBadge('Coming soon', colors: colors),
                        ),
                      Text(
                        space.title,
                        style: expressive(
                          22,
                          width: 115,
                          weight: 760,
                          color: colors.onContainer,
                        ),
                      ),
                      Text(
                        space.tagline,
                        style: TextStyle(
                          color: colors.onContainer,
                          height: 1.3,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
