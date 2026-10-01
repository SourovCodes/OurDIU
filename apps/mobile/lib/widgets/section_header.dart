import 'package:flutter/material.dart';

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
            style: theme.textTheme.titleMedium?.copyWith(
              fontWeight: FontWeight.w600,
              fontSize: 18,
            ),
          ),
        ),
        if (onSeeAll != null)
          TextButton(onPressed: onSeeAll, child: const Text('See all')),
      ],
    );
  }
}
