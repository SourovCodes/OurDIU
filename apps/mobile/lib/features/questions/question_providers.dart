import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:pdfrx/pdfrx.dart';

import '../../api/api.dart';
import '../../api/generated/export.dart';

/// A question with its papers, ranked the way the API sends them.
final questionProvider = FutureProvider.autoDispose.family<QuestionDetail, int>(
  (ref, id) => ref.watch(qbApiProvider).questions.getApiV1QuestionsId(id: id),
);

/// Counts views of the question page and its papers, like the site does: with the
/// question's `viewToken`. The API decides what counts (once a day per install,
/// thanks to its cookies); failures don't matter to the reader, so they're ignored.
class ViewCounter {
  ViewCounter(this._api);

  final QbApi _api;

  Future<void> question(int id, String viewToken) => _ignoreErrors(
    _api.engagement.postApiV1QuestionsIdViews(id: id, xViewToken: viewToken),
  );

  Future<void> paper(int submissionId, String viewToken) => _ignoreErrors(
    _api.engagement.postApiV1SubmissionsIdViews(
      id: submissionId,
      xViewToken: viewToken,
    ),
  );

  Future<void> _ignoreErrors(Future<void> request) async {
    try {
      await request;
    } catch (_) {}
  }
}

final viewCounterProvider = Provider<ViewCounter>(
  (ref) => ViewCounter(ref.watch(qbApiProvider)),
);

/// What the reader needs to hear from the PDF viewer.
class PaperViewEvents {
  const PaperViewEvents({required this.onTap, required this.onPage});

  /// A single tap on the page: shows or hides the bars.
  final VoidCallback onTap;

  /// The page in view and the page count, once known.
  final void Function(int page, int pageCount) onPage;
}

/// Shows the PDF at a URL. Tests swap it for a placeholder, since the real viewer
/// needs the native PDF engine.
final paperViewerProvider =
    Provider<Widget Function(Uri url, PaperViewEvents events)>(
      (ref) =>
          (url, events) => PaperView(url: url, events: events),
    );

class PaperView extends StatefulWidget {
  const PaperView({super.key, required this.url, required this.events});

  final Uri url;
  final PaperViewEvents events;

  @override
  State<PaperView> createState() => _PaperViewState();
}

class _PaperViewState extends State<PaperView> {
  var _pageCount = 0;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return PdfViewer.uri(
      widget.url,
      params: PdfViewerParams(
        backgroundColor: scheme.surfaceContainer,
        margin: 10,
        onGeneralTap: (context, controller, details) {
          if (details.type != PdfViewerGeneralTapType.tap) return false;
          widget.events.onTap();
          return true;
        },
        onViewerReady: (document, controller) {
          _pageCount = document.pages.length;
          widget.events.onPage(controller.pageNumber ?? 1, _pageCount);
        },
        onPageChanged: (page) {
          if (page != null && _pageCount > 0) {
            widget.events.onPage(page, _pageCount);
          }
        },
        loadingBannerBuilder: (context, downloaded, total) => Center(
          child: CircularProgressIndicator(
            value: total == null || total == 0 ? null : downloaded / total,
          ),
        ),
      ),
    );
  }
}
