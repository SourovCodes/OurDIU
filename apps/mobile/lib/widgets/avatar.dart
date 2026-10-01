import 'package:flutter/material.dart';

import '../api/api.dart';
import '../theme/theme.dart';

/// Up to two initials of a name: "Nusrat Jahan" → "NJ".
String initialsOf(String name) => name
    .split(RegExp(r'\s+'))
    .where((w) => w.isNotEmpty)
    .take(2)
    .map((w) => w[0].toUpperCase())
    .join();

/// A person's photo, or their initials in the expressive type while it loads or
/// when they have none.
class PersonAvatar extends StatelessWidget {
  const PersonAvatar({
    super.key,
    required this.name,
    required this.image,
    this.radius = 20,
    this.background,
    this.foreground,
  });

  final String name;

  /// As the API sends it; avatars it stores are relative to the site.
  final String? image;
  final double radius;
  final Color? background;
  final Color? foreground;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return CircleAvatar(
      radius: radius,
      backgroundColor: background ?? scheme.primaryContainer,
      foregroundImage: image == null
          ? null
          : NetworkImage(absoluteUrl(image!).toString()),
      onForegroundImageError: image == null ? null : (_, _) {},
      child: Text(
        initialsOf(name),
        style: expressive(
          radius * 0.72,
          width: 120,
          weight: 760,
          color: foreground ?? scheme.onPrimaryContainer,
        ),
      ),
    );
  }
}
