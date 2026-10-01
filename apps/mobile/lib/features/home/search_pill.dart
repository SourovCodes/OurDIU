import 'package:flutter/material.dart';

/// The large search entry on Home. It flies into the search field (a shared
/// Hero), so opening search feels like the pill expanding.
class SearchPill extends StatelessWidget {
  const SearchPill({super.key, required this.label, required this.onTap});

  final String label;
  final VoidCallback onTap;

  static const heroTag = 'search';

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Hero(
      tag: heroTag,
      child: Material(
        color: scheme.surfaceContainerHigh,
        shape: const StadiumBorder(),
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          onTap: onTap,
          child: ConstrainedBox(
            constraints: const BoxConstraints(minHeight: 56),
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
              child: Row(
                spacing: 12,
                children: [
                  Icon(Icons.search_rounded, color: scheme.onSurfaceVariant),
                  Expanded(
                    child: Text(
                      label,
                      style: TextStyle(
                        fontSize: 16,
                        color: scheme.onSurfaceVariant,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
