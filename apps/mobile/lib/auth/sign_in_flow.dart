import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../api/generated/export.dart';
import '../widgets/google_button.dart';
import 'session.dart';
import 'token.dart';

void _snack(ScaffoldMessengerState messenger, String text) => messenger
  ..hideCurrentSnackBar()
  ..showSnackBar(SnackBar(content: Text(text)));

/// Signs in and says how it went. A refused account is explained on the
/// Account tab. True when signed in.
Future<bool> runSignIn(BuildContext context, WidgetRef ref) async {
  final messenger = ScaffoldMessenger.of(context);
  final outcome = await ref.read(signInProvider.notifier).signIn();
  switch (outcome) {
    case SignInOutcome.signedIn:
      final profile = await ref
          .read(profileProvider.future)
          .then<Profile?>((p) => p, onError: (_) => null);
      _snack(
        messenger,
        profile == null ? 'Signed in' : 'Signed in as ${profile.name}',
      );
    case SignInOutcome.refused:
      if (context.mounted) context.go('/account');
    case SignInOutcome.failed:
      _snack(
        messenger,
        "Couldn't sign in. Check your connection and try again.",
      );
    case SignInOutcome.cancelled:
      break;
  }
  return outcome == SignInOutcome.signedIn;
}

/// True when signed in, asking first when not: "Sign in to [to]".
Future<bool> ensureSignedIn(
  BuildContext context,
  WidgetRef ref, {
  required String to,
}) async {
  if (ref.read(sessionTokenProvider) != null) return true;
  final proceed = await showModalBottomSheet<bool>(
    context: context,
    useRootNavigator: true,
    showDragHandle: true,
    builder: (context) => _SignInNeeded(to: to),
  );
  if (proceed != true || !context.mounted) return false;
  return runSignIn(context, ref);
}

class _SignInNeeded extends StatelessWidget {
  const _SignInNeeded({required this.to});

  final String to;

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
              'Sign in to $to',
              style: theme.textTheme.titleLarge?.copyWith(
                fontWeight: FontWeight.w600,
              ),
            ),
            Text(
              'Likes and reports come from signed-in students, so they stay '
              'useful. It takes one tap with your DIU Google account.',
              style: TextStyle(
                color: theme.colorScheme.onSurfaceVariant,
                height: 1.4,
              ),
            ),
            const SizedBox(height: 8),
            SizedBox(
              width: double.infinity,
              child: Wrap(
                alignment: WrapAlignment.end,
                spacing: 8,
                runSpacing: 8,
                children: [
                  TextButton(
                    onPressed: () => Navigator.pop(context, false),
                    child: const Text('Not now'),
                  ),
                  GoogleButton(onPressed: () => Navigator.pop(context, true)),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
