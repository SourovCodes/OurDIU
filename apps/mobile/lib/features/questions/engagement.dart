import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../api/api.dart';
import '../../api/generated/export.dart';
import '../../auth/token.dart';
import '../../data/format.dart';

/// Your votes and reports on a question's papers; null when signed out.
final interactionsProvider = FutureProvider.family<QuestionInteractions?, int>((
  ref,
  questionId,
) async {
  if (ref.watch(sessionTokenProvider) == null) return null;
  return ref
      .watch(qbApiProvider)
      .engagement
      .getApiV1MeQuestionsIdInteractions(id: questionId);
});

/// Like and dislike counts after changing [current] to [next], before the API
/// answers.
VoteResult expectedVote(VoteResult current, VoteValue? next) {
  int count(VoteValue? vote, VoteValue value) => vote == value ? 1 : 0;
  final was = current.myVote;
  return VoteResult(
    likeCount:
        current.likeCount -
        count(was, VoteValue.value1) +
        count(next, VoteValue.value1),
    dislikeCount:
        current.dislikeCount -
        count(was, VoteValue.valueMinus1) +
        count(next, VoteValue.valueMinus1),
    viewCount: current.viewCount,
    myVote: next,
  );
}

/// As on the site.
const reportReasonLabels = {
  ReportReason.wrongDetails: 'Wrong course, semester or exam type',
  ReportReason.wrongFile: 'Wrong or incomplete paper',
  ReportReason.unreadable: 'Unreadable or broken file',
  ReportReason.duplicate: 'Duplicate of another paper',
  ReportReason.inappropriate: 'Inappropriate content',
  ReportReason.other: 'Something else',
};

const maxReportDetails = 500;

/// What a report sheet closed with, for the snackbar.
enum ReportResult { sent, hidden, alreadyReported }

/// Reports a problem with a published paper. Pops a [ReportResult] once sent.
class ReportSheet extends ConsumerStatefulWidget {
  const ReportSheet({super.key, required this.submissionId, this.paperTitle});

  final int submissionId;

  /// When the question has several papers, which one this is.
  final String? paperTitle;

  @override
  ConsumerState<ReportSheet> createState() => _ReportSheetState();
}

class _ReportSheetState extends ConsumerState<ReportSheet> {
  var _reason = ReportReason.wrongDetails;
  final _details = TextEditingController();
  var _sending = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _details.addListener(() => setState(() {}));
  }

  @override
  void dispose() {
    _details.dispose();
    super.dispose();
  }

  bool get _needsDetails =>
      _reason == ReportReason.other && _details.text.trim().isEmpty;

  Future<void> _send() async {
    setState(() {
      _sending = true;
      _error = null;
    });
    final details = _details.text.trim();
    try {
      final created = await ref
          .read(qbApiProvider)
          .engagement
          .postApiV1SubmissionsIdReports(
            id: widget.submissionId,
            body: CreateReportInput(
              reason: _reason,
              details: details.isEmpty ? null : details,
            ),
          );
      if (mounted) {
        Navigator.pop(
          context,
          created.submissionHidden ? ReportResult.hidden : ReportResult.sent,
        );
      }
    } on DioException catch (e) {
      if (!mounted) return;
      if (e.response?.statusCode == 409) {
        Navigator.pop(context, ReportResult.alreadyReported);
        return;
      }
      setState(() {
        _sending = false;
        _error = switch (e.response?.statusCode) {
          403 => "You can't report your own paper.",
          404 => 'This paper is no longer published.',
          429 => "You've sent a lot of reports. Please wait a minute.",
          _ => "Couldn't send the report. Check your connection.",
        };
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final scheme = theme.colorScheme;
    final reasons = ReportReason.$valuesDefined;
    return Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.viewInsetsOf(context).bottom),
      child: SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(24, 0, 24, 16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              widget.paperTitle == null
                  ? 'Report this paper'
                  : 'Report “${widget.paperTitle}”',
              style: theme.textTheme.titleLarge?.copyWith(
                fontWeight: FontWeight.w600,
              ),
            ),
            const SizedBox(height: 4),
            Text(
              'An admin reviews every report. Papers reported by several '
              'people are hidden until then.',
              style: TextStyle(color: scheme.onSurfaceVariant, fontSize: 13),
            ),
            const SizedBox(height: 16),
            RadioGroup<ReportReason>(
              groupValue: _reason,
              onChanged: (r) {
                if (r != null && !_sending) setState(() => _reason = r);
              },
              child: Column(
                spacing: 2,
                children: [
                  for (final (i, reason) in reasons.indexed)
                    Material(
                      color: scheme.surfaceContainer,
                      borderRadius: BorderRadius.vertical(
                        top: Radius.circular(i == 0 ? 20 : 4),
                        bottom: Radius.circular(
                          i == reasons.length - 1 ? 20 : 4,
                        ),
                      ),
                      clipBehavior: Clip.antiAlias,
                      child: RadioListTile<ReportReason>(
                        value: reason,
                        title: Text(reportReasonLabels[reason]!),
                        dense: true,
                      ),
                    ),
                ],
              ),
            ),
            const SizedBox(height: 16),
            TextField(
              controller: _details,
              enabled: !_sending,
              minLines: 2,
              maxLines: 5,
              maxLength: maxReportDetails,
              textCapitalization: TextCapitalization.sentences,
              decoration: InputDecoration(
                labelText: _reason == ReportReason.other
                    ? 'Details'
                    : 'Details (optional)',
                hintText: 'Tell the admin what you noticed',
                border: const OutlineInputBorder(),
              ),
            ),
            if (_error != null)
              Padding(
                padding: const EdgeInsets.only(top: 4),
                child: Text(_error!, style: TextStyle(color: scheme.error)),
              ),
            const SizedBox(height: 8),
            Row(
              mainAxisAlignment: MainAxisAlignment.end,
              spacing: 8,
              children: [
                TextButton(
                  onPressed: _sending ? null : () => Navigator.pop(context),
                  child: const Text('Cancel'),
                ),
                FilledButton(
                  onPressed: _sending || _needsDetails ? null : _send,
                  child: _sending
                      ? const SizedBox.square(
                          dimension: 18,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : const Text('Send report'),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

/// A like or dislike in the reader's toolbar: tinted while it's your vote.
class VoteButton extends StatelessWidget {
  const VoteButton({
    super.key,
    required this.icon,
    required this.selectedIcon,
    required this.tooltip,
    required this.selected,
    required this.onPressed,
    this.count,
  });

  final IconData icon;
  final IconData selectedIcon;
  final String tooltip;
  final bool selected;
  final VoidCallback? onPressed;
  final int? count;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    // A tint of the primary colour: the containers are too close to the
    // toolbar's own colour to show a vote.
    final fg = selected ? scheme.primary : scheme.onSurface;
    return Semantics(
      container: true,
      button: true,
      enabled: onPressed != null,
      selected: selected,
      label: count == null ? tooltip : '$tooltip, $count',
      excludeSemantics: true,
      child: Opacity(
        opacity: onPressed == null ? 0.45 : 1,
        child: Tooltip(
          message: tooltip,
          excludeFromSemantics: true,
          child: Material(
            color: selected
                ? scheme.primary.withValues(alpha: 0.14)
                : Colors.transparent,
            shape: const StadiumBorder(),
            clipBehavior: Clip.antiAlias,
            child: InkWell(
              onTap: onPressed,
              child: SizedBox(
                height: 44,
                child: Padding(
                  padding: EdgeInsets.symmetric(
                    horizontal: count == null ? 10 : 12,
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    spacing: 4,
                    children: [
                      Icon(selected ? selectedIcon : icon, color: fg),
                      if (count != null)
                        Text(
                          compactCount(count!),
                          style: TextStyle(
                            color: fg,
                            fontWeight: FontWeight.w600,
                            fontFeatures: const [FontFeature.tabularFigures()],
                          ),
                        ),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
