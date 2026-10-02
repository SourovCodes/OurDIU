import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../api/api.dart';
import '../../api/generated/export.dart';
import '../../auth/session.dart';
import '../../data/format.dart';
import '../../theme/theme.dart';
import '../../widgets/state_message.dart';
import 'paper_widgets.dart';
import 'papers.dart';
import 'share_flow.dart';
import 'upload_screen.dart';

// A paper's review conversation with the reviewers, like the website's: their
// messages, and each step of the review with its note. Also the two ways to
// answer a request for changes: replacing the file and resubmitting.

/// After an action on a paper: everything that shows it is stale.
void refreshPaper(WidgetRef ref, int id) => ref
  ..invalidate(myPaperProvider(id))
  ..invalidate(myPapersProvider)
  ..invalidate(reviewActivityProvider)
  ..invalidate(profileProvider);

/// "asked for changes", from the person who took the step.
String _stepText(ReviewMessageKind kind) => switch (kind) {
  ReviewMessageKind.changesRequested => 'asked for changes',
  ReviewMessageKind.rejected => 'rejected the paper',
  ReviewMessageKind.published => 'published the paper',
  ReviewMessageKind.returnedToReview => 'moved it back to review',
  ReviewMessageKind.detailsEdited => 'edited the details',
  ReviewMessageKind.fileReplaced => 'replaced the file',
  ReviewMessageKind.resubmitted => 'resubmitted it for review',
  ReviewMessageKind.comment || ReviewMessageKind.$unknown => 'wrote',
};

IconData _stepIcon(ReviewMessageKind kind) => switch (kind) {
  ReviewMessageKind.changesRequested => Icons.edit_note_rounded,
  ReviewMessageKind.rejected => Icons.block_rounded,
  ReviewMessageKind.published => Icons.check_rounded,
  ReviewMessageKind.returnedToReview => Icons.undo_rounded,
  ReviewMessageKind.detailsEdited => Icons.edit_outlined,
  ReviewMessageKind.fileReplaced => Icons.upload_file_rounded,
  ReviewMessageKind.resubmitted => Icons.send_rounded,
  _ => Icons.chat_bubble_outline_rounded,
};

/// You see your own entries as "You" and every admin as "Reviewer".
String _who(ReviewMessage m) =>
    m.author.role == ReviewAuthorRole.uploader ? 'You' : 'Reviewer';

/// One entry: a step as a small line (with its note), a message as a bubble.
class ReviewEntry extends StatelessWidget {
  const ReviewEntry(this.message, {super.key});

  final ReviewMessage message;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final scheme = theme.colorScheme;
    final muted = theme.textTheme.bodySmall?.copyWith(
      color: scheme.onSurfaceVariant,
    );
    final kind = message.kind;
    final body = message.body;

    if (kind != ReviewMessageKind.comment) {
      final (background, foreground) = switch (kind) {
        ReviewMessageKind.changesRequested => ExamColors.of(context).changes,
        ReviewMessageKind.published => ExamColors.of(context).lab,
        ReviewMessageKind.rejected => ExamColors.of(context).midterm,
        ReviewMessageKind.resubmitted => ExamColors.of(context).quiz,
        _ => (scheme.surfaceContainerHighest, scheme.onSurfaceVariant),
      };
      return Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        spacing: 6,
        children: [
          Row(
            spacing: 10,
            children: [
              Container(
                width: 26,
                height: 26,
                decoration: BoxDecoration(
                  color: background,
                  shape: BoxShape.circle,
                ),
                child: Icon(_stepIcon(kind), size: 15, color: foreground),
              ),
              Expanded(
                child: Text.rich(
                  TextSpan(
                    children: [
                      TextSpan(
                        text: _who(message),
                        style: const TextStyle(fontWeight: FontWeight.w600),
                      ),
                      TextSpan(text: ' ${_stepText(kind)}  '),
                      TextSpan(text: timeAgo(message.createdAt), style: muted),
                    ],
                  ),
                ),
              ),
            ],
          ),
          if (body != null && body.isNotEmpty)
            Padding(
              padding: const EdgeInsets.only(left: 36),
              child: Container(
                width: double.infinity,
                padding: const EdgeInsets.symmetric(
                  horizontal: 12,
                  vertical: 9,
                ),
                decoration: BoxDecoration(
                  color: scheme.surfaceContainerHigh,
                  borderRadius: BorderRadius.circular(16),
                ),
                child: Text(body, style: const TextStyle(height: 1.4)),
              ),
            ),
        ],
      );
    }

    final mine = message.author.role == ReviewAuthorRole.uploader;
    const corner = Radius.circular(18);
    const tail = Radius.circular(6);
    return Align(
      alignment: mine ? Alignment.centerRight : Alignment.centerLeft,
      child: ConstrainedBox(
        constraints: BoxConstraints(
          maxWidth: MediaQuery.sizeOf(context).width * 0.8,
        ),
        child: Column(
          crossAxisAlignment: mine
              ? CrossAxisAlignment.end
              : CrossAxisAlignment.start,
          spacing: 3,
          children: [
            Text.rich(
              TextSpan(
                children: [
                  TextSpan(
                    text: _who(message),
                    style: TextStyle(
                      fontWeight: FontWeight.w600,
                      color: scheme.onSurface,
                    ),
                  ),
                  TextSpan(text: ' · ${timeAgo(message.createdAt)}'),
                ],
              ),
              style: muted,
            ),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 13, vertical: 9),
              decoration: BoxDecoration(
                color: mine
                    ? scheme.primaryContainer
                    : scheme.surfaceContainerHigh,
                borderRadius: BorderRadius.only(
                  topLeft: mine ? corner : tail,
                  topRight: mine ? tail : corner,
                  bottomLeft: corner,
                  bottomRight: corner,
                ),
              ),
              child: Text(
                body ?? '',
                style: TextStyle(
                  height: 1.4,
                  color: mine ? scheme.onPrimaryContainer : scheme.onSurface,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// A line that marks where the unread entries start.
class NewDivider extends StatelessWidget {
  const NewDivider({super.key});

  @override
  Widget build(BuildContext context) {
    final primary = Theme.of(context).colorScheme.primary;
    final line = Expanded(
      child: Container(height: 1, color: primary.withValues(alpha: 0.4)),
    );
    return Row(
      spacing: 8,
      children: [
        line,
        Text(
          'New',
          style: TextStyle(
            color: primary,
            fontSize: 12,
            fontWeight: FontWeight.w700,
          ),
        ),
        line,
      ],
    );
  }
}

/// [messages] in order, with the "New" line before the last [unread] ones.
List<Widget> threadEntries(List<ReviewMessage> messages, int unread) {
  final firstNew = unread > 0 ? messages.length - unread : -1;
  return [
    for (final (i, m) in messages.indexed) ...[
      if (i == firstNew) const NewDivider(),
      ReviewEntry(m),
    ],
  ];
}

/// The whole conversation, with a box to write to the reviewers while the
/// paper isn't published. Opening it marks it read.
class MessagesScreen extends ConsumerStatefulWidget {
  const MessagesScreen({super.key, required this.id});

  final int id;

  @override
  ConsumerState<MessagesScreen> createState() => _MessagesScreenState();
}

class _MessagesScreenState extends ConsumerState<MessagesScreen> {
  final _text = TextEditingController();
  var _sending = false;

  /// What was unread when the screen opened: the API marks it read on load.
  int? _unread;

  @override
  void initState() {
    super.initState();
    // Always fresh: this load is what marks the conversation read.
    Future.microtask(() => ref.invalidate(myPaperProvider(widget.id)));
  }

  @override
  void dispose() {
    _text.dispose();
    super.dispose();
  }

  Future<void> _send() async {
    final body = _text.text.trim();
    if (body.isEmpty || _sending) return;
    setState(() => _sending = true);
    try {
      await ref
          .read(qbApiProvider)
          .account
          .postApiV1MeSubmissionsIdMessages(
            id: widget.id,
            body: PostReviewMessageInput(body: body),
          );
      _text.clear();
      refreshPaper(ref, widget.id);
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            apiErrorMessage(e) ?? "Couldn't send your message. Try again.",
          ),
        ),
      );
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final async = ref.watch(myPaperProvider(widget.id));
    final paper = async.value;
    if (paper != null) {
      _unread ??= paper.unread;
      if (paper.unread > 0) {
        // Read now: the badges change.
        Future.microtask(() {
          ref
            ..invalidate(myPapersProvider)
            ..invalidate(reviewActivityProvider);
        });
      }
    }
    return Scaffold(
      appBar: AppBar(
        titleSpacing: 0,
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Messages',
              style: TextStyle(fontWeight: FontWeight.w600, fontSize: 17),
            ),
            if (paper != null)
              Text(
                '${paper.classification.course.name} · '
                '${paperDetails(paper.classification)}',
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: theme.textTheme.bodySmall?.copyWith(
                  color: theme.colorScheme.onSurfaceVariant,
                ),
              ),
          ],
        ),
      ),
      body: switch ((paper, async.error)) {
        (final paper?, _) => Column(
          children: [
            Expanded(
              child: paper.messages.isEmpty
                  ? StateMessage(
                      icon: Icons.forum_outlined,
                      title: 'No messages yet',
                      body:
                          'Questions about your paper? Write to the reviewers '
                          'here.',
                    )
                  : ListView(
                      // Newest at the bottom, where the box is.
                      reverse: true,
                      padding: const EdgeInsets.fromLTRB(16, 12, 16, 16),
                      children: [
                        for (final entry in threadEntries(
                          paper.messages,
                          _unread ?? 0,
                        ).reversed)
                          Padding(
                            padding: const EdgeInsets.only(top: 14),
                            child: entry,
                          ),
                      ],
                    ),
            ),
            if (paper.status != SubmissionStatus.published)
              _Compose(controller: _text, sending: _sending, onSend: _send),
          ],
        ),
        (_, final error?) => StateMessage(
          icon: isOffline(error)
              ? Icons.cloud_off_rounded
              : Icons.error_outline_rounded,
          title: isOffline(error)
              ? "You're offline"
              : "Couldn't load the messages",
          body: 'Check your connection and try again.',
          actions: [
            FilledButton(
              onPressed: () => ref.invalidate(myPaperProvider(widget.id)),
              child: const Text('Try again'),
            ),
          ],
        ),
        _ => const Center(child: CircularProgressIndicator()),
      },
    );
  }
}

class _Compose extends StatelessWidget {
  const _Compose({
    required this.controller,
    required this.sending,
    required this.onSend,
  });

  final TextEditingController controller;
  final bool sending;
  final VoidCallback onSend;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Material(
      color: scheme.surface,
      child: SafeArea(
        top: false,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(12, 8, 12, 10),
          child: Row(
            spacing: 8,
            children: [
              Expanded(
                child: TextField(
                  controller: controller,
                  minLines: 1,
                  maxLines: 5,
                  maxLength: 2000,
                  textCapitalization: TextCapitalization.sentences,
                  decoration: InputDecoration(
                    hintText: 'Write to the reviewer',
                    counterText: '',
                    filled: true,
                    fillColor: scheme.surfaceContainerHigh,
                    contentPadding: const EdgeInsets.symmetric(
                      horizontal: 16,
                      vertical: 12,
                    ),
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(24),
                      borderSide: BorderSide.none,
                    ),
                  ),
                ),
              ),
              IconButton.filled(
                tooltip: 'Send',
                onPressed: sending ? null : onSend,
                style: IconButton.styleFrom(minimumSize: const Size(48, 48)),
                icon: sending
                    ? const SizedBox.square(
                        dimension: 20,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Icon(Icons.send_rounded),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Replaces whatever snackbar is showing.
void _snack(BuildContext context, String text) => ScaffoldMessenger.of(context)
  ..hideCurrentSnackBar()
  ..showSnackBar(SnackBar(content: Text(text)));

/// Picks a corrected PDF and, once confirmed in a sheet, replaces the paper's
/// file with it. Returns whether it was replaced.
Future<bool> replaceFile(
  BuildContext context,
  WidgetRef ref,
  MySubmissionDetail paper,
) async {
  final pdf = await choosePdf(context, ref, title: 'Replace the file');
  if (pdf == null || !context.mounted) return false;
  final replaced = await showModalBottomSheet<bool>(
    context: context,
    useRootNavigator: true,
    showDragHandle: true,
    isScrollControlled: true,
    builder: (context) => _ReplaceSheet(paper: paper, pdf: pdf),
  );
  if (replaced != true) return false;
  refreshPaper(ref, paper.id);
  if (context.mounted) {
    _snack(context, 'File replaced. Resubmit when you’re ready.');
  }
  return true;
}

class _ReplaceSheet extends ConsumerStatefulWidget {
  const _ReplaceSheet({required this.paper, required this.pdf});

  final MySubmissionDetail paper;
  final PickedPdf pdf;

  @override
  ConsumerState<_ReplaceSheet> createState() => _ReplaceSheetState();
}

class _ReplaceSheetState extends ConsumerState<_ReplaceSheet> {
  late PickedPdf _pdf = widget.pdf;
  double? _progress;
  String? _error;

  Future<void> _change() async {
    final pdf = await choosePdf(context, ref, title: 'Replace the file');
    if (pdf != null && mounted) setState(() => _pdf = pdf);
  }

  Future<void> _replace() async {
    setState(() {
      _progress = 0;
      _error = null;
    });
    try {
      await replacePaperFile(
        ref.read(dioProvider),
        widget.paper.id,
        _pdf,
        onProgress: (p) {
          if (mounted) setState(() => _progress = p);
        },
      );
      if (mounted) Navigator.pop(context, true);
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _progress = null;
        _error = apiErrorMessage(e) ?? "Couldn't replace the file. Try again.";
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final sending = _progress != null;
    return _Sheet(
      title: 'Replace the file',
      text:
          'It replaces the PDF you uploaded, and the AI checks it again. The '
          'reviewer decides when you resubmit.',
      error: _error,
      progress: _progress,
      confirm: 'Replace',
      confirmIcon: Icons.upload_rounded,
      onConfirm: sending ? null : _replace,
      child: PdfFileCard(pdf: _pdf, onReplace: sending ? null : _change),
    );
  }
}

/// Asks for an optional note, then sends a paper a reviewer asked to change
/// back for review. Returns whether it was resubmitted.
Future<bool> resubmit(
  BuildContext context,
  WidgetRef ref,
  MySubmissionDetail paper,
) async {
  final done = await showModalBottomSheet<bool>(
    context: context,
    useRootNavigator: true,
    showDragHandle: true,
    isScrollControlled: true,
    builder: (context) => _ResubmitSheet(paper: paper),
  );
  if (done != true) return false;
  refreshPaper(ref, paper.id);
  if (context.mounted) {
    _snack(context, 'Sent back for review');
  }
  return true;
}

class _ResubmitSheet extends ConsumerStatefulWidget {
  const _ResubmitSheet({required this.paper});

  final MySubmissionDetail paper;

  @override
  ConsumerState<_ResubmitSheet> createState() => _ResubmitSheetState();
}

class _ResubmitSheetState extends ConsumerState<_ResubmitSheet> {
  final _note = TextEditingController();
  var _sending = false;
  String? _error;

  @override
  void dispose() {
    _note.dispose();
    super.dispose();
  }

  Future<void> _send() async {
    setState(() {
      _sending = true;
      _error = null;
    });
    final note = _note.text.trim();
    try {
      await ref
          .read(qbApiProvider)
          .account
          .postApiV1MeSubmissionsIdResubmit(
            id: widget.paper.id,
            body: ResubmitInput(note: note.isEmpty ? null : note),
          );
      if (mounted) Navigator.pop(context, true);
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _sending = false;
        _error = apiErrorMessage(e) ?? "Couldn't resubmit it. Try again.";
      });
    }
  }

  @override
  Widget build(BuildContext context) => _Sheet(
    title: 'Resubmit for review?',
    text:
        'The reviewer looks at your paper again. You can’t change it until '
        'they’ve decided, unless they ask again.',
    error: _error,
    progress: _sending ? -1 : null,
    confirm: 'Resubmit',
    confirmIcon: Icons.send_rounded,
    onConfirm: _sending ? null : _send,
    child: TextField(
      controller: _note,
      minLines: 3,
      maxLines: 6,
      maxLength: 2000,
      textCapitalization: TextCapitalization.sentences,
      decoration: const InputDecoration(
        labelText: 'What did you change? (optional)',
        hintText: 'e.g. Uploaded the full paper and fixed the semester',
        alignLabelWithHint: true,
        border: OutlineInputBorder(),
      ),
    ),
  );
}

/// A bottom sheet with a heading, a line of text, its content and two
/// buttons. [progress] shows while working: 0–1 for an upload, -1 otherwise.
class _Sheet extends StatelessWidget {
  const _Sheet({
    required this.title,
    required this.text,
    required this.confirm,
    required this.confirmIcon,
    required this.onConfirm,
    required this.child,
    this.error,
    this.progress,
  });

  final String title;
  final String text;
  final String confirm;
  final IconData confirmIcon;
  final VoidCallback? onConfirm;
  final Widget child;
  final String? error;
  final double? progress;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final progress = this.progress;
    return Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.viewInsetsOf(context).bottom),
      child: SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(20, 0, 20, 16),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            spacing: 14,
            children: [
              Text(title, style: expressive(24, width: 115, weight: 780)),
              Text(
                text,
                style: TextStyle(
                  color: theme.colorScheme.onSurfaceVariant,
                  height: 1.4,
                ),
              ),
              child,
              if (error case final error?)
                Text(error, style: TextStyle(color: theme.colorScheme.error)),
              if (progress != null)
                LinearProgressIndicator(value: progress < 0 ? null : progress),
              Row(
                mainAxisAlignment: MainAxisAlignment.end,
                spacing: 8,
                children: [
                  TextButton(
                    onPressed: progress == null
                        ? () => Navigator.pop(context, false)
                        : null,
                    child: const Text('Cancel'),
                  ),
                  FilledButton.icon(
                    onPressed: onConfirm,
                    icon: Icon(confirmIcon),
                    label: Text(confirm),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}
