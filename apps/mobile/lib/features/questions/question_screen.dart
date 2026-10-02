import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:share_plus/share_plus.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../api/api.dart';
import '../../api/generated/export.dart';
import '../../auth/session.dart';
import '../../auth/sign_in_flow.dart';
import '../../auth/token.dart';
import '../../data/format.dart';
import '../../data/saved.dart';
import '../../theme/exam_shape.dart';
import '../../widgets/question_row.dart';
import '../../widgets/avatar.dart';
import '../../widgets/state_message.dart';
import 'engagement.dart';
import 'paper_actions.dart';
import 'paper_titles.dart';
import 'question_providers.dart';

/// The reader. The top-ranked published paper fills the screen; a tap on the
/// page hides the bars. A floating toolbar names the paper being read and opens a
/// sheet to switch between the question's papers, and holds the likes; the menu
/// opens the paper in a browser or reports a problem with it.
class QuestionScreen extends ConsumerStatefulWidget {
  const QuestionScreen({
    super.key,
    required this.id,
    this.summary,
    this.submissionId,
  });

  final int id;

  /// The paper to open on, e.g. a contributor's own copy; otherwise the best
  /// rated.
  final int? submissionId;

  /// The row that was tapped, to show the title while the question loads.
  final Question? summary;

  @override
  ConsumerState<QuestionScreen> createState() => _QuestionScreenState();
}

class _QuestionScreenState extends ConsumerState<QuestionScreen> {
  late int? _selectedId = widget.submissionId;
  final _countedPapers = <int>{};
  var _countedQuestion = false;
  var _chrome = true;
  (int, int)? _page;

  /// Votes and reports made here, over what the question and your interactions
  /// said when they loaded.
  final _votes = <int, VoteResult>{};
  final _reported = <int>{};

  @override
  void initState() {
    super.initState();
    ref.listenManual(questionProvider(widget.id), (_, next) {
      if (next case AsyncData(:final value)) _countViews(value);
    }, fireImmediately: true);
    ref.listenManual(sessionTokenProvider, (_, _) {
      setState(() {
        _votes.clear();
        _reported.clear();
      });
    });
  }

  QuestionInteractions? get _interactions =>
      ref.read(interactionsProvider(widget.id)).value;

  VoteResult _voteOf(Submission paper) =>
      _votes[paper.id] ??
      VoteResult(
        likeCount: paper.likeCount,
        dislikeCount: paper.dislikeCount,
        viewCount: paper.viewCount,
        myVote: _interactions?.votes
            .where((v) => v.submissionId == paper.id)
            .firstOrNull
            ?.value,
      );

  bool _isReported(Submission paper) =>
      _reported.contains(paper.id) ||
      (_interactions?.reportedSubmissionIds.contains(paper.id) ?? false);

  /// Your own papers can't be liked or reported.
  bool _isOwn(Submission paper) {
    final me = ref.read(profileProvider).value;
    return me != null && paper.uploader?.id == me.id;
  }

  void _snack(String text) => ScaffoldMessenger.of(context)
    ..hideCurrentSnackBar()
    ..showSnackBar(SnackBar(content: Text(text)));

  /// Likes or dislikes [paper]; the same vote again takes it back. Signed out,
  /// it signs in first and then records [value].
  Future<void> _vote(Submission paper, VoteValue value) async {
    final wasSignedIn = ref.read(sessionTokenProvider) != null;
    if (!await ensureSignedIn(context, ref, to: 'like papers')) return;
    if (!mounted) return;
    final before = _voteOf(paper);
    final next = wasSignedIn && before.myVote == value ? null : value;
    setState(() => _votes[paper.id] = expectedVote(before, next));
    final engagement = ref.read(qbApiProvider).engagement;
    try {
      final result = next == null
          ? await engagement.deleteApiV1SubmissionsIdVote(id: paper.id)
          : await engagement.putApiV1SubmissionsIdVote(
              id: paper.id,
              body: CastVoteInput(value: next),
            );
      if (mounted) setState(() => _votes[paper.id] = result);
    } on DioException catch (e) {
      if (!mounted) return;
      setState(() => _votes[paper.id] = before);
      _snack(switch (e.response?.statusCode) {
        403 => "You can't vote on your own paper.",
        429 => "You're voting too fast. Please wait a minute.",
        _ => "Couldn't save your vote. Check your connection.",
      });
    }
  }

  Future<void> _report(Submission paper, String? title) async {
    if (!await ensureSignedIn(context, ref, to: 'report a problem')) return;
    if (!mounted) return;
    final result = await showModalBottomSheet<ReportResult>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      showDragHandle: true,
      builder: (context) =>
          ReportSheet(submissionId: paper.id, paperTitle: title),
    );
    if (result == null || !mounted) return;
    setState(() => _reported.add(paper.id));
    _snack(switch (result) {
      ReportResult.sent => 'Report sent. An admin will take a look.',
      ReportResult.hidden =>
        'Report sent. The paper is hidden until an admin checks it.',
      ReportResult.alreadyReported => 'You already reported this paper.',
    });
  }

  void _countViews(QuestionDetail question) {
    final counter = ref.read(viewCounterProvider);
    if (!_countedQuestion) {
      _countedQuestion = true;
      counter.question(question.id, question.viewToken);
    }
    final paper = _selected(question);
    if (paper != null && _countedPapers.add(paper.id)) {
      counter.paper(paper.id, question.viewToken);
    }
  }

  List<Submission> _published(QuestionDetail question) => [
    for (final s in question.submissions)
      if (s.status == SubmissionStatus.published) s,
  ];

  Submission? _selected(QuestionDetail question) {
    final published = _published(question);
    return published.where((s) => s.id == _selectedId).firstOrNull ??
        published.firstOrNull;
  }

  void _select(QuestionDetail question, int id) {
    setState(() {
      _selectedId = id;
      _page = null;
      _chrome = true;
    });
    _countViews(question);
  }

  void _back(BuildContext context) =>
      context.canPop() ? context.pop() : context.go('/home');

  @override
  Widget build(BuildContext context) {
    return switch (ref.watch(questionProvider(widget.id))) {
      AsyncData(:final value) => _buildReader(context, value),
      AsyncError(:final error) => Scaffold(
        appBar: _placeholderBar(),
        body: StateMessage(
          icon: isOffline(error)
              ? Icons.cloud_off_rounded
              : Icons.error_outline_rounded,
          shape: ExamKind.midterm,
          title: switch (error) {
            _ when isOffline(error) => "You're offline",
            DioException(response: Response(statusCode: 404)) =>
              'This question no longer exists',
            _ => "Couldn't load this question",
          },
          body: 'Check your connection and try again.',
          actions: [
            FilledButton(
              onPressed: () => ref.invalidate(questionProvider(widget.id)),
              child: const Text('Try again'),
            ),
          ],
        ),
      ),
      _ => Scaffold(
        appBar: _placeholderBar(),
        body: const Center(child: CircularProgressIndicator()),
      ),
    };
  }

  AppBar _placeholderBar() => AppBar(
    title: _Title(
      title: widget.summary?.course.name ?? '',
      details: widget.summary == null ? null : questionDetails(widget.summary!),
    ),
  );

  Widget _buildReader(BuildContext context, QuestionDetail question) {
    final scheme = Theme.of(context).colorScheme;
    final padding = MediaQuery.paddingOf(context);
    final published = _published(question);
    final titles = paperTitles(published);
    final selected = _selected(question);
    final url = selected?.fileUrl == null
        ? null
        // Relative on servers without a public files domain (development).
        : absoluteUrl(selected!.fileUrl!);
    final summary = summaryOf(question);
    final saved = ref
        .watch(savedQuestionsProvider)
        .any((q) => q.id == question.id);
    // Watched so the votes, reports and own-paper checks below stay current.
    ref
      ..watch(interactionsProvider(widget.id))
      ..watch(profileProvider);
    const barHeight = 64.0;
    const motion = Duration(milliseconds: 220);

    // Opened from a link, the paper is all there is: back goes to Home.
    return PopScope(
      canPop: context.canPop(),
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) context.go('/home');
      },
      child: Scaffold(
        backgroundColor: scheme.surfaceContainer,
        body: Stack(
          children: [
            Positioned.fill(
              child: AnimatedPadding(
                duration: motion,
                curve: Curves.easeOutCubic,
                padding: EdgeInsets.only(
                  top: padding.top + (_chrome ? barHeight : 0),
                ),
                child: url != null && selected != null
                    ? KeyedSubtree(
                        // Keyed, so switching papers loads the new document.
                        key: ValueKey(selected.id),
                        child: ref.watch(paperViewerProvider)(
                          url,
                          PaperViewEvents(
                            onTap: () => setState(() => _chrome = !_chrome),
                            onPage: (page, count) {
                              if (mounted) {
                                setState(() => _page = (page, count));
                              }
                            },
                          ),
                        ),
                      )
                    : StateMessage(
                        icon: question.submissionCounts.pendingReview > 0
                            ? Icons.schedule_rounded
                            : Icons.description_outlined,
                        shape: ExamKind.quiz,
                        title: 'No published paper yet',
                        body: question.submissionCounts.pendingReview > 0
                            ? '${plural(question.submissionCounts.pendingReview, 'submission is', 'submissions are')} '
                                  'waiting for review. The paper appears here once approved.'
                            : "The papers shared for this exam weren't approved.",
                      ),
              ),
            ),
            // Top bar
            Positioned(
              top: 0,
              left: 0,
              right: 0,
              child: AnimatedSlide(
                duration: motion,
                curve: Curves.easeOutCubic,
                offset: _chrome ? Offset.zero : const Offset(0, -1),
                child: Material(
                  color: scheme.surface,
                  child: Padding(
                    padding: EdgeInsets.only(top: padding.top),
                    child: SizedBox(
                      height: barHeight,
                      child: Row(
                        children: [
                          BackButton(onPressed: () => _back(context)),
                          Expanded(
                            child: _Title(
                              title: question.course.name,
                              details: questionDetails(summary),
                            ),
                          ),
                          IconButton(
                            tooltip: saved ? 'Remove from saved' : 'Save',
                            isSelected: saved,
                            selectedIcon: Icon(
                              Icons.bookmark_rounded,
                              color: scheme.primary,
                            ),
                            icon: const Icon(Icons.bookmark_border_rounded),
                            onPressed: () {
                              ref
                                  .read(savedQuestionsProvider.notifier)
                                  .toggle(summary);
                              ScaffoldMessenger.of(context)
                                ..hideCurrentSnackBar()
                                ..showSnackBar(
                                  SnackBar(
                                    content: Text(
                                      saved ? 'Removed from saved' : 'Saved',
                                    ),
                                  ),
                                );
                            },
                          ),
                          if (url != null && selected != null)
                            _PaperMenu(
                              reported: _isReported(selected),
                              own: _isOwn(selected),
                              onShareLink: () => SharePlus.instance.share(
                                ShareParams(
                                  uri: Uri.parse(
                                    '$apiBaseUrl/questions/${widget.id}',
                                  ),
                                ),
                              ),
                              onOpenInBrowser: () => openInBrowser(url),
                              onReport: () => _report(
                                selected,
                                published.length > 1
                                    ? titles[selected.id]
                                    : null,
                              ),
                            ),
                          const SizedBox(width: 4),
                        ],
                      ),
                    ),
                  ),
                ),
              ),
            ),
            // Page counter
            if (_page case (final page, final count) when url != null)
              Positioned(
                top: padding.top + barHeight + 10,
                right: 14,
                child: AnimatedOpacity(
                  duration: motion,
                  opacity: _chrome ? 1 : 0,
                  child: DecoratedBox(
                    decoration: ShapeDecoration(
                      color: scheme.surfaceContainerHighest,
                      shape: const StadiumBorder(),
                    ),
                    child: Padding(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 10,
                        vertical: 4,
                      ),
                      child: Text(
                        'Page $page of $count',
                        style: const TextStyle(
                          fontSize: 12,
                          fontFeatures: [FontFeature.tabularFigures()],
                        ),
                      ),
                    ),
                  ),
                ),
              ),
            // Floating toolbar
            if (url != null && selected != null)
              Positioned(
                left: 12,
                right: 12,
                bottom: padding.bottom + 14,
                child: AnimatedSlide(
                  duration: motion,
                  curve: Curves.easeOutCubic,
                  offset: _chrome ? Offset.zero : const Offset(0, 1.8),
                  child: _Toolbar(
                    paperTitle: titles[selected.id]!,
                    position: published.length > 1
                        ? (published.indexOf(selected) + 1, published.length)
                        : null,
                    onPickPaper: () =>
                        _showPapers(context, question, published, titles),
                    vote: _voteOf(selected),
                    own: _isOwn(selected),
                    onVote: (value) => _vote(selected, value),
                    url: url,
                    fileName: paperFileName([
                      question.course.name,
                      question.examType.name,
                      question.semester.name,
                      if (published.length > 1) titles[selected.id]!,
                    ]),
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }

  void _showPapers(
    BuildContext context,
    QuestionDetail question,
    List<Submission> published,
    Map<int, String> titles,
  ) {
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      builder: (context) => _PaperSheet(
        papers: published,
        titles: titles,
        selectedId: _selected(question)?.id,
        onPick: (id) {
          Navigator.pop(context);
          _select(question, id);
        },
      ),
    );
  }
}

class _Title extends StatelessWidget {
  const _Title({required this.title, this.details});

  final String title;
  final String? details;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          title,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: theme.textTheme.titleMedium?.copyWith(
            fontWeight: FontWeight.w600,
            fontSize: 17,
          ),
        ),
        if (details != null)
          Text(
            details!,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: theme.textTheme.bodySmall?.copyWith(
              color: theme.colorScheme.onSurfaceVariant,
            ),
          ),
      ],
    );
  }
}

class _Toolbar extends StatelessWidget {
  const _Toolbar({
    required this.paperTitle,
    required this.position,
    required this.onPickPaper,
    required this.vote,
    required this.own,
    required this.onVote,
    required this.url,
    required this.fileName,
  });

  final String paperTitle;

  /// (current, count) when the question has more than one paper.
  final (int, int)? position;
  final VoidCallback onPickPaper;
  final VoteResult vote;

  /// Your own paper: no voting on it.
  final bool own;
  final ValueChanged<VoteValue> onVote;
  final Uri url;
  final String fileName;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Material(
      color: scheme.surfaceContainerHighest,
      shape: const StadiumBorder(),
      elevation: 6,
      shadowColor: Colors.black54,
      child: Padding(
        padding: const EdgeInsets.all(6),
        child: Row(
          spacing: 2,
          children: [
            Expanded(
              child: switch (position) {
                (final current, final count) => Material(
                  color: scheme.primary,
                  shape: const StadiumBorder(),
                  clipBehavior: Clip.antiAlias,
                  child: InkWell(
                    onTap: onPickPaper,
                    child: Padding(
                      padding: const EdgeInsets.fromLTRB(16, 7, 10, 7),
                      child: Row(
                        spacing: 8,
                        children: [
                          Icon(
                            Icons.description_rounded,
                            color: scheme.onPrimary,
                          ),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  paperTitle,
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: TextStyle(
                                    color: scheme.onPrimary,
                                    fontWeight: FontWeight.w600,
                                    fontSize: 14,
                                  ),
                                ),
                                Text(
                                  'Paper $current of $count · change',
                                  style: TextStyle(
                                    color: scheme.onPrimary.withValues(
                                      alpha: 0.85,
                                    ),
                                    fontSize: 11,
                                  ),
                                ),
                              ],
                            ),
                          ),
                          Icon(
                            Icons.expand_less_rounded,
                            color: scheme.onPrimary,
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
                null => Padding(
                  padding: const EdgeInsets.only(left: 14),
                  child: Text(
                    paperTitle,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      fontWeight: FontWeight.w600,
                      fontSize: 14,
                    ),
                  ),
                ),
              },
            ),
            VoteButton(
              icon: Icons.thumb_up_outlined,
              selectedIcon: Icons.thumb_up_rounded,
              tooltip: own ? 'Your paper' : 'Like',
              selected: vote.myVote == VoteValue.value1,
              count: vote.likeCount,
              onPressed: own ? null : () => onVote(VoteValue.value1),
            ),
            VoteButton(
              icon: Icons.thumb_down_outlined,
              selectedIcon: Icons.thumb_down_rounded,
              tooltip: own ? 'Your paper' : 'Dislike',
              selected: vote.myVote == VoteValue.valueMinus1,
              onPressed: own ? null : () => onVote(VoteValue.valueMinus1),
            ),
            _ShareButton(url: url, fileName: fileName),
          ],
        ),
      ),
    );
  }
}

enum _MenuAction { shareLink, openInBrowser, report }

class _PaperMenu extends StatelessWidget {
  const _PaperMenu({
    required this.reported,
    required this.own,
    required this.onShareLink,
    required this.onOpenInBrowser,
    required this.onReport,
  });

  final bool reported;
  final bool own;
  final VoidCallback onShareLink;
  final VoidCallback onOpenInBrowser;
  final VoidCallback onReport;

  @override
  Widget build(BuildContext context) {
    final muted = Theme.of(context).colorScheme.onSurfaceVariant;
    return PopupMenuButton<_MenuAction>(
      tooltip: 'More',
      icon: const Icon(Icons.more_vert_rounded),
      onSelected: (action) => switch (action) {
        _MenuAction.shareLink => onShareLink(),
        _MenuAction.openInBrowser => onOpenInBrowser(),
        _MenuAction.report => onReport(),
      },
      itemBuilder: (context) => [
        PopupMenuItem(
          value: _MenuAction.shareLink,
          child: ListTile(
            leading: Icon(Icons.link_rounded, color: muted),
            title: const Text('Share link'),
            contentPadding: EdgeInsets.zero,
          ),
        ),
        PopupMenuItem(
          value: _MenuAction.openInBrowser,
          child: ListTile(
            leading: Icon(Icons.open_in_new_rounded, color: muted),
            title: const Text('Open in browser'),
            contentPadding: EdgeInsets.zero,
          ),
        ),
        PopupMenuItem(
          value: _MenuAction.report,
          enabled: !reported && !own,
          child: ListTile(
            leading: Icon(Icons.flag_outlined, color: muted),
            title: Text(
              reported
                  ? 'You reported this paper'
                  : 'Report a problem with this paper',
            ),
            enabled: !reported && !own,
            contentPadding: EdgeInsets.zero,
          ),
        ),
      ],
    );
  }
}

/// The question's papers, with who shared each, when, and how others rated it.
class _PaperSheet extends StatelessWidget {
  const _PaperSheet({
    required this.papers,
    required this.titles,
    required this.selectedId,
    required this.onPick,
  });

  final List<Submission> papers;
  final Map<int, String> titles;
  final int? selectedId;
  final ValueChanged<int> onPick;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final scheme = theme.colorScheme;
    return ListView(
      shrinkWrap: true,
      padding: const EdgeInsets.fromLTRB(16, 0, 16, 24),
      children: [
        Text(
          papers.length == 1
              ? '1 copy of this exam'
              : '${papers.length} copies of this exam',
          style: theme.textTheme.titleLarge?.copyWith(
            fontWeight: FontWeight.w600,
          ),
        ),
        const SizedBox(height: 2),
        Text(
          'Shared by different students, best rated first.',
          style: TextStyle(color: scheme.onSurfaceVariant),
        ),
        const SizedBox(height: 14),
        for (final paper in papers) ...[
          _PaperOption(
            paper: paper,
            title: titles[paper.id]!,
            selected: paper.id == selectedId,
            onTap: () => onPick(paper.id),
          ),
          const SizedBox(height: 8),
        ],
      ],
    );
  }
}

class _PaperOption extends StatelessWidget {
  const _PaperOption({
    required this.paper,
    required this.title,
    required this.selected,
    required this.onTap,
  });

  final Submission paper;
  final String title;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final fg = selected ? scheme.onPrimaryContainer : scheme.onSurface;
    final uploader = paper.uploader;
    return Material(
      color: selected ? scheme.primaryContainer : scheme.surfaceContainer,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(20),
        side: BorderSide(
          color: selected ? scheme.primary : Colors.transparent,
          width: 2,
        ),
      ),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Row(
            spacing: 12,
            children: [
              PersonAvatar(
                name: uploader?.name ?? '?',
                image: uploader?.image,
                background: scheme.secondaryContainer,
                foreground: scheme.onSecondaryContainer,
              ),
              Expanded(
                child: DefaultTextStyle.merge(
                  style: TextStyle(color: fg),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    spacing: 2,
                    children: [
                      Text(
                        title,
                        style: const TextStyle(fontWeight: FontWeight.w600),
                      ),
                      Text(
                        [
                          if (uploader != null) uploader.name,
                          shortDate(paper.createdAt),
                        ].join(' · '),
                        style: const TextStyle(fontSize: 13),
                      ),
                      Wrap(
                        spacing: 12,
                        children: [
                          _Stat(
                            Icons.thumb_up_outlined,
                            compactCount(paper.likeCount),
                            fg,
                          ),
                          _Stat(
                            Icons.visibility_outlined,
                            compactCount(paper.viewCount),
                            fg,
                          ),
                          _Stat(
                            Icons.picture_as_pdf_outlined,
                            fileSize(paper.fileSize),
                            fg,
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ),
              if (selected)
                Icon(Icons.check_circle_rounded, color: scheme.primary),
            ],
          ),
        ),
      ),
    );
  }
}

class _Stat extends StatelessWidget {
  const _Stat(this.icon, this.text, this.color);

  final IconData icon;
  final String text;
  final Color color;

  @override
  Widget build(BuildContext context) => Row(
    mainAxisSize: MainAxisSize.min,
    spacing: 3,
    children: [
      Icon(icon, size: 14, color: color.withValues(alpha: 0.8)),
      Text(
        text,
        style: TextStyle(fontSize: 12, color: color.withValues(alpha: 0.8)),
      ),
    ],
  );
}

class _ShareButton extends ConsumerStatefulWidget {
  const _ShareButton({required this.url, required this.fileName});

  final Uri url;
  final String fileName;

  @override
  ConsumerState<_ShareButton> createState() => _ShareButtonState();
}

class _ShareButtonState extends ConsumerState<_ShareButton> {
  var _busy = false;

  Future<void> _share() async {
    setState(() => _busy = true);
    try {
      await sharePaper(
        context,
        dio: ref.read(dioProvider),
        url: widget.url,
        fileName: widget.fileName,
      );
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text(
              "Couldn't download the paper. Check your connection.",
            ),
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return IconButton(
      tooltip: 'Share or save to Files',
      onPressed: _busy ? null : _share,
      icon: _busy
          ? const SizedBox.square(
              dimension: 20,
              child: CircularProgressIndicator(strokeWidth: 2),
            )
          : const Icon(Icons.share_rounded),
    );
  }
}
