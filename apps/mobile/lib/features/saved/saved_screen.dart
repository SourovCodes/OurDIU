import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../data/saved.dart';
import '../../theme/exam_shape.dart';
import '../../theme/theme.dart';
import '../../widgets/question_row.dart';
import '../../widgets/state_message.dart';

/// Papers bookmarked in the reader, newest first. Kept on this phone.
class SavedScreen extends ConsumerWidget {
  const SavedScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final saved = ref.watch(savedQuestionsProvider);
    final scheme = Theme.of(context).colorScheme;
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
                      body: 'Tap the bookmark on any paper to save it here.',
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
            : ListView(
                padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
                children: [
                  Text('Saved', style: expressive(40, color: scheme.onSurface)),
                  const SizedBox(height: 16),
                  RowGroup(children: [for (final q in saved) QuestionRow(q)]),
                ],
              ),
      ),
    );
  }
}
