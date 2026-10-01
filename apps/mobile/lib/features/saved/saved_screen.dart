import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../auth/token.dart';
import '../../data/saved.dart';
import '../../theme/exam_shape.dart';
import '../../theme/theme.dart';
import '../../widgets/question_row.dart';
import '../../widgets/state_message.dart';

/// Papers bookmarked in the reader, newest first. Kept on this phone, and with
/// the account when signed in (the same list as on the website).
class SavedScreen extends ConsumerWidget {
  const SavedScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final saved = ref.watch(savedQuestionsProvider);
    final signedIn = ref.watch(sessionTokenProvider) != null;
    final scheme = Theme.of(context).colorScheme;
    final where = Text(
      signedIn
          ? 'Synced with your account, so they’re on ourdiu.com too.'
          : 'On this phone. Sign in to keep them on ourdiu.com too.',
      style: Theme.of(context).textTheme.bodyMedium
          ?.copyWith(color: scheme.onSurfaceVariant),
    );
    return Scaffold(
      body: SafeArea(
        bottom: false,
        child: saved.isEmpty
            ? Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Padding(
                    padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
                    child: Text(
                      'Saved',
                      style: expressive(40, color: scheme.onSurface),
                    ),
                  ),
                  Expanded(
                    child: StateMessage(
                      icon: Icons.bookmark_rounded,
                      shape: ExamKind.finalExam,
                      title: 'Keep papers for exam week',
                      body: signedIn
                          ? 'Tap the bookmark on any paper to save it here and on ourdiu.com.'
                          : 'Tap the bookmark on any paper to save it here.',
                      actions: [
                        FilledButton(
                          onPressed: () => context.go('/browse'),
                          child: const Text('Browse papers'),
                        ),
                      ],
                    ),
                  ),
                ],
              )
            : RefreshIndicator(
                onRefresh: ref.read(savedQuestionsProvider.notifier).sync,
                child: ListView(
                  padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
                  children: [
                    Text(
                      'Saved',
                      style: expressive(40, color: scheme.onSurface),
                    ),
                    const SizedBox(height: 6),
                    where,
                    const SizedBox(height: 16),
                    RowGroup(children: [for (final q in saved) QuestionRow(q)]),
                  ],
                ),
              ),
      ),
    );
  }
}
