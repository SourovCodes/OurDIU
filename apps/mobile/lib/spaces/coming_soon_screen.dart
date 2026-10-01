import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../theme/theme.dart';
import 'space.dart';
import 'switcher.dart';

/// The space of a product that isn't out yet, in its own colours.
class ComingSoonScreen extends ConsumerWidget {
  const ComingSoonScreen(this.space, {super.key});

  final Space space;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Theme(
      data: space.theme(context),
      child: Builder(
        builder: (context) {
          final theme = Theme.of(context);
          final scheme = theme.colorScheme;
          return Scaffold(
            body: SafeArea(
              child: ListView(
                padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
                children: [
                  SpaceTitle(space),
                  const SizedBox(height: 56),
                  Center(child: SpaceIcon(space, size: 160)),
                  const SizedBox(height: 32),
                  Text(
                    'Coming soon',
                    textAlign: TextAlign.center,
                    style: expressive(40, color: scheme.onSurface),
                  ),
                  const SizedBox(height: 12),
                  Text(
                    "${space.tagline}. We're building it now.",
                    textAlign: TextAlign.center,
                    style: theme.textTheme.bodyLarge?.copyWith(
                      color: scheme.onSurfaceVariant,
                    ),
                  ),
                  const SizedBox(height: 32),
                  Center(
                    child: FilledButton.tonalIcon(
                      onPressed: () => openSpace(context, ref, Space.questions),
                      icon: const Icon(Icons.description_outlined),
                      label: const Text('Open the Question Bank'),
                    ),
                  ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }
}
