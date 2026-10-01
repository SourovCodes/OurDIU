import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../api/api.dart';
import '../../api/generated/export.dart';
import '../../auth/session.dart';
import '../../auth/sign_in_flow.dart';
import '../../auth/token.dart';
import '../../data/format.dart';
import '../../data/support.dart';
import '../../data/settings.dart';
import '../../theme/exam_shape.dart';
import '../../theme/theme.dart';
import '../../widgets/avatar.dart';
import '../../widgets/google_button.dart';
import '../../widgets/skeleton.dart';
import '../upload/share_card.dart';

Future<void> _openSite(String path) =>
    launchUrl(Uri.parse('$apiBaseUrl$path'), mode: LaunchMode.inAppBrowserView);

class AccountScreen extends ConsumerWidget {
  const AccountScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = Theme.of(context);
    final scheme = theme.colorScheme;
    final details = ref.watch(appDetailsProvider).value;
    final android = Theme.of(context).platform == TargetPlatform.android;
    final signedIn = ref.watch(sessionTokenProvider) != null;

    return Scaffold(
      body: SafeArea(
        bottom: false,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
          children: [
            if (signedIn) ...[
              const _Profile(),
              const SizedBox(height: 24),
              const YourPapersSection(),
            ] else ...[
              Text('Account', style: expressive(40, color: scheme.onSurface)),
              const SizedBox(height: 20),
              const _SignInCard(),
            ],
            const SizedBox(height: 24),
            Text(
              'Appearance',
              style: theme.textTheme.titleMedium?.copyWith(
                fontWeight: FontWeight.w600,
              ),
            ),
            const SizedBox(height: 10),
            SegmentedButton<ThemeMode>(
              segments: const [
                ButtonSegment(
                  value: ThemeMode.system,
                  icon: Icon(Icons.contrast_rounded),
                  label: Text('System'),
                ),
                ButtonSegment(
                  value: ThemeMode.light,
                  icon: Icon(Icons.light_mode_rounded),
                  label: Text('Light'),
                ),
                ButtonSegment(
                  value: ThemeMode.dark,
                  icon: Icon(Icons.dark_mode_rounded),
                  label: Text('Dark'),
                ),
              ],
              selected: {ref.watch(appearanceProvider)},
              showSelectedIcon: false,
              onSelectionChanged: (s) =>
                  ref.read(appearanceProvider.notifier).set(s.single),
            ),
            const SizedBox(height: 24),
            Column(
              spacing: 2,
              children: [
                if (android)
                  _LinkTile(
                    icon: Icons.star_outline_rounded,
                    title: 'Rate QuestionBank',
                    subtitle: 'On Google Play',
                    bottom: false,
                    onTap: openStoreListing,
                  ),
                _LinkTile(
                  icon: Icons.feedback_outlined,
                  title: 'Send feedback',
                  subtitle: 'Report a bug or suggest an idea',
                  top: !android,
                  onTap: () => sendFeedback(details),
                ),
              ],
            ),
            const SizedBox(height: 12),
            Column(
              spacing: 2,
              children: [
                for (final (i, (icon, label, path)) in const [
                  (Icons.info_outline_rounded, 'About QuestionBank', '/about'),
                  (Icons.mail_outline_rounded, 'Contact us', '/contact'),
                  (Icons.policy_outlined, 'Privacy policy', '/privacy'),
                  (Icons.gavel_rounded, 'Terms of use', '/terms'),
                ].indexed)
                  _LinkTile(
                    icon: icon,
                    title: label,
                    top: i == 0,
                    bottom: i == 3,
                    onTap: () => _openSite(path),
                  ),
              ],
            ),
            if (signedIn) ...[
              const SizedBox(height: 24),
              const _SignOutButton(),
              const SizedBox(height: 4),
              Center(
                child: TextButton(
                  style: TextButton.styleFrom(
                    foregroundColor: scheme.onSurfaceVariant,
                  ),
                  // Google Play asks for a way to delete the account from the app.
                  onPressed: () => _openSite('/delete-account'),
                  child: const Text('Delete account'),
                ),
              ),
            ],
            const SizedBox(height: 20),
            Text(
              [
                if (details != null) 'Version ${details.version}',
                'diuqbank.com',
              ].join(' · '),
              textAlign: TextAlign.center,
              style: theme.textTheme.bodySmall?.copyWith(
                color: scheme.onSurfaceVariant,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// A row in a group of rounded tiles: the ends of the group are rounder.
class _LinkTile extends StatelessWidget {
  const _LinkTile({
    required this.icon,
    required this.title,
    this.subtitle,
    this.top = true,
    this.bottom = true,
    required this.onTap,
  });

  final IconData icon;
  final String title;
  final String? subtitle;
  final bool top;
  final bool bottom;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Material(
      color: scheme.surfaceContainerLow,
      borderRadius: BorderRadius.vertical(
        top: Radius.circular(top ? 20 : 4),
        bottom: Radius.circular(bottom ? 20 : 4),
      ),
      clipBehavior: Clip.antiAlias,
      child: ListTile(
        leading: Icon(icon, color: scheme.onSurfaceVariant),
        title: Text(title),
        subtitle: subtitle == null ? null : Text(subtitle!),
        trailing: Icon(
          Icons.open_in_new_rounded,
          size: 18,
          color: scheme.onSurfaceVariant,
        ),
        onTap: onTap,
      ),
    );
  }
}

/// What an account is for, and the sign-in as it happens.
class _SignInCard extends ConsumerWidget {
  const _SignInCard();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final scheme = Theme.of(context).colorScheme;
    final state = ref.watch(signInProvider);

    if (state case SignInRefused(:final email)) {
      final (background, foreground) = examColors(context, ExamKind.midterm);
      return Material(
        color: background,
        borderRadius: BorderRadius.circular(20),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            spacing: 12,
            children: [
              Icon(Icons.block_rounded, color: foreground),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  spacing: 4,
                  children: [
                    Text(
                      'Use your DIU Google account',
                      style: TextStyle(
                        color: foreground,
                        fontWeight: FontWeight.w700,
                        fontSize: 16,
                      ),
                    ),
                    Text(
                      'New accounts need a @diu.edu.bd address, and $email '
                      "isn't one. If you already have a QuestionBank account "
                      'with another address, choose that one.',
                      style: TextStyle(color: foreground, height: 1.4),
                    ),
                    const SizedBox(height: 8),
                    FilledButton(
                      onPressed: () => runSignIn(context, ref),
                      child: const Text('Choose another account'),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      );
    }

    return Card.filled(
      color: scheme.primaryContainer,
      margin: EdgeInsets.zero,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(28)),
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: switch (state) {
          SigningIn(:final email) => Row(
            spacing: 16,
            children: [
              SizedBox.square(
                dimension: 28,
                child: CircularProgressIndicator(
                  strokeWidth: 3,
                  color: scheme.onPrimaryContainer,
                ),
              ),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Signing you in…',
                      style: expressive(
                        18,
                        width: 110,
                        weight: 700,
                        color: scheme.onPrimaryContainer,
                      ),
                    ),
                    Text(
                      'as $email',
                      style: TextStyle(color: scheme.onPrimaryContainer),
                    ),
                  ],
                ),
              ),
            ],
          ),
          _ => Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            spacing: 12,
            children: [
              Text(
                'Share what you’ve got',
                style: expressive(
                  20,
                  width: 110,
                  weight: 700,
                  color: scheme.onPrimaryContainer,
                ),
              ),
              Text(
                'Sign in to like the useful papers and report problems. '
                'Uploading from the app comes next. Reading never needs an '
                'account.',
                style: TextStyle(color: scheme.onPrimaryContainer, height: 1.4),
              ),
              GoogleButton(onPressed: () => runSignIn(context, ref)),
              Text(
                'New accounts need your DIU Google account (@diu.edu.bd).',
                style: TextStyle(
                  fontSize: 13,
                  color: scheme.onPrimaryContainer.withValues(alpha: 0.85),
                ),
              ),
            ],
          ),
        },
      ),
    );
  }
}

class _Profile extends ConsumerWidget {
  const _Profile();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return switch (ref.watch(profileProvider)) {
      AsyncData(value: final Profile profile) => _ProfileDetails(profile),
      AsyncError() => _ProfileError(
        onRetry: () => ref.invalidate(profileProvider),
      ),
      _ => const _ProfileSkeleton(),
    };
  }
}

class _ProfileDetails extends StatelessWidget {
  const _ProfileDetails(this.profile);

  final Profile profile;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final scheme = theme.colorScheme;
    final muted = TextStyle(color: scheme.onSurfaceVariant);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const SizedBox(height: 12),
        PersonAvatar(name: profile.name, image: profile.image, radius: 44),
        const SizedBox(height: 14),
        Text(
          profile.name,
          style: expressive(
            30,
            width: 115,
            weight: 780,
            color: scheme.onSurface,
          ).copyWith(height: 1.05),
        ),
        const SizedBox(height: 6),
        Text('@${profile.username}', style: muted),
        Text(profile.email, style: theme.textTheme.bodySmall?.merge(muted)),
        const SizedBox(height: 20),
        Row(
          spacing: 8,
          children: [
            _Stat(
              value: thousands(profile.publishedCount),
              label: profile.publishedCount == 1
                  ? 'paper shared'
                  : 'papers shared',
            ),
            _Stat(
              value: thousands(profile.viewCount),
              label: profile.viewCount == 1
                  ? 'view of your papers'
                  : 'views of your papers',
            ),
          ],
        ),
        const SizedBox(height: 12),
        _LinkTile(
          icon: Icons.badge_outlined,
          title: 'Your public page',
          subtitle: 'diuqbank.com/contributors/${profile.username}',
          onTap: () => _openSite('/contributors/${profile.username}'),
        ),
      ],
    );
  }
}

class _Stat extends StatelessWidget {
  const _Stat({required this.value, required this.label});

  final String value;
  final String label;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final scheme = theme.colorScheme;
    return Expanded(
      child: DecoratedBox(
        decoration: BoxDecoration(
          color: scheme.surfaceContainer,
          borderRadius: BorderRadius.circular(20),
        ),
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 14, 16, 14),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            spacing: 4,
            children: [
              Text(
                value,
                style: expressive(
                  26,
                  width: 120,
                  weight: 780,
                  color: scheme.onSurface,
                ).copyWith(height: 1),
              ),
              Text(
                label,
                style: theme.textTheme.bodySmall?.copyWith(
                  color: scheme.onSurfaceVariant,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _ProfileSkeleton extends StatelessWidget {
  const _ProfileSkeleton();

  @override
  Widget build(BuildContext context) => const Skeleton(
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      spacing: 10,
      children: [
        SizedBox(height: 2),
        Bone(width: 88, height: 88, radius: 44),
        SizedBox(height: 4),
        Bone(width: 220, height: 30),
        Bone(width: 140, height: 14),
        SizedBox(height: 10),
        Row(
          spacing: 8,
          children: [
            Expanded(child: Bone(height: 72, radius: 20)),
            Expanded(child: Bone(height: 72, radius: 20)),
          ],
        ),
        Bone(height: 64, radius: 20),
      ],
    ),
  );
}

class _ProfileError extends StatelessWidget {
  const _ProfileError({required this.onRetry});

  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Padding(
      padding: const EdgeInsets.only(top: 12),
      child: Material(
        color: scheme.surfaceContainer,
        borderRadius: BorderRadius.circular(20),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Row(
            spacing: 12,
            children: [
              Icon(Icons.cloud_off_rounded, color: scheme.onSurfaceVariant),
              const Expanded(
                child: Text(
                  "Couldn't load your account. Check your connection.",
                ),
              ),
              TextButton(onPressed: onRetry, child: const Text('Try again')),
            ],
          ),
        ),
      ),
    );
  }
}

class _SignOutButton extends ConsumerWidget {
  const _SignOutButton();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final danger = Theme.of(context).colorScheme.error;
    return OutlinedButton.icon(
      style: OutlinedButton.styleFrom(
        foregroundColor: danger,
        side: BorderSide(color: danger.withValues(alpha: 0.45)),
        minimumSize: const Size.fromHeight(48),
      ),
      icon: const Icon(Icons.logout_rounded),
      label: const Text('Sign out'),
      onPressed: () async {
        final messenger = ScaffoldMessenger.of(context);
        final confirmed = await showModalBottomSheet<bool>(
          context: context,
          useRootNavigator: true,
          showDragHandle: true,
          builder: (context) => const _ConfirmSignOut(),
        );
        if (confirmed != true) return;
        await ref.read(signInProvider.notifier).signOut();
        messenger
          ..hideCurrentSnackBar()
          ..showSnackBar(const SnackBar(content: Text('Signed out')));
      },
    );
  }
}

class _ConfirmSignOut extends StatelessWidget {
  const _ConfirmSignOut();

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(24, 0, 24, 16),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          spacing: 8,
          children: [
            Text(
              'Sign out?',
              style: theme.textTheme.titleLarge?.copyWith(
                fontWeight: FontWeight.w600,
              ),
            ),
            Text(
              'Your saved papers stay on this phone. You can sign back in any '
              'time.',
              style: TextStyle(color: theme.colorScheme.onSurfaceVariant),
            ),
            const SizedBox(height: 8),
            Row(
              mainAxisAlignment: MainAxisAlignment.end,
              spacing: 8,
              children: [
                TextButton(
                  onPressed: () => Navigator.pop(context, false),
                  child: const Text('Cancel'),
                ),
                FilledButton(
                  onPressed: () => Navigator.pop(context, true),
                  child: const Text('Sign out'),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
