import 'package:flutter/material.dart';

import '../theme/theme.dart';

/// A section title with an optional "See all" link on the right.
class SectionHeader extends StatelessWidget {
  const SectionHeader(this.title, {super.key, this.onSeeAll});

  final String title;
  final VoidCallback? onSeeAll;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Row(
      children: [
        Expanded(
          child: Text(
            title,
            // Expressive, as the website's section headings.
            style: expressive(
              24,
              width: 120,
              weight: 780,
              color: theme.colorScheme.onSurface,
            ),
          ),
        ),
        if (onSeeAll != null)
          TextButton(onPressed: onSeeAll, child: const Text('See all')),
      ],
    );
  }
}
