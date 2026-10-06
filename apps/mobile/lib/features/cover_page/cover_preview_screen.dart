import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:path_provider/path_provider.dart';
import 'package:pdfrx/pdfrx.dart';
import 'package:share_plus/share_plus.dart';

import '../../api/api.dart';
import '../../data/cover_page.dart';
import '../../data/format.dart';
import '../../spaces/space.dart';
import '../../theme/exam_shape.dart';
import '../../widgets/state_message.dart';
import 'cover_page_screen.dart';

/// The page of a PDF in memory. Tests swap in a placeholder.
final coverPageViewerProvider = Provider<Widget Function(CoverFile file)>(
  (ref) =>
      (file) => PdfDocumentViewBuilder(
        documentRef: PdfDocumentRefData(
          file.bytes,
          // Each page made is a document of its own.
          sourceName: 'cover-${identityHashCode(file.bytes)}',
        ),
        builder: (context, document) =>
            PdfPageView(document: document, pageNumber: 1),
      ),
);

/// Hands a made file to the share sheet (save to Files or Drive, send, print).
/// Tests swap in a recorder.
final coverPageSharerProvider =
    Provider<
      Future<void> Function(CoverFile file, CoverFormat format, Rect? origin)
    >(
      (ref) => (file, format, origin) async {
        final dir = await getTemporaryDirectory();
        final path = '${dir.path}/${file.name}';
        await File(path).writeAsBytes(file.bytes);
        await SharePlus.instance.share(
          ShareParams(
            files: [XFile(path, mimeType: format.mimeType)],
            sharePositionOrigin: origin,
          ),
        );
      },
    );

/// The cover page as the API makes it, so what's shared is what's shown.
class CoverPreviewScreen extends ConsumerStatefulWidget {
  const CoverPreviewScreen({super.key, required this.preview});

  final CoverPreview preview;

  @override
  ConsumerState<CoverPreviewScreen> createState() => _CoverPreviewState();
}

class _CoverPreviewState extends ConsumerState<CoverPreviewScreen> {
  late Future<CoverFile> _pdf = _makePdf();
  CoverFormat? _busy;

  /// The PDF shown. It can fail before the screen listens: the screen shows
  /// the error, so it isn't reported as uncaught.
  Future<CoverFile> _makePdf() => _make(CoverFormat.pdf)..ignore();

  Future<CoverFile> _make(CoverFormat format) => makeCoverPage(
    ref.read(dioProvider),
    widget.preview.template,
    widget.preview.input,
    format,
  );

  Future<void> _share(BuildContext button, CoverFormat format) async {
    final messenger = ScaffoldMessenger.of(context);
    // iPads anchor the share sheet on the button that opened it.
    final box = button.findRenderObject() as RenderBox?;
    final origin = box == null
        ? null
        : box.localToGlobal(Offset.zero) & box.size;
    setState(() => _busy = format);
    try {
      final file = format == CoverFormat.pdf ? await _pdf : await _make(format);
      await ref.read(coverPageSharerProvider)(file, format, origin);
    } on Object catch (error) {
      messenger.showSnackBar(
        SnackBar(
          content: Text(
            isOffline(error)
                ? "You're offline. Connect to make the file."
                : "Couldn't make the ${format == CoverFormat.pdf ? 'PDF' : 'Word file'}. Try again.",
          ),
        ),
      );
    } finally {
      if (mounted) setState(() => _busy = null);
    }
  }

  late final _blanks = coverBlanks(
    widget.preview.template,
    widget.preview.input,
  );

  /// The page on the whole screen, to pinch and pan.
  void _zoom(BuildContext context, CoverFile file) =>
      Navigator.of(context).push(
        MaterialPageRoute<void>(
          fullscreenDialog: true,
          builder: (context) => Scaffold(
            backgroundColor: Colors.black,
            appBar: AppBar(
              backgroundColor: Colors.black,
              foregroundColor: Colors.white,
              leading: const CloseButton(),
            ),
            body: InteractiveViewer(
              maxScale: 6,
              child: Center(
                child: _Page(child: ref.read(coverPageViewerProvider)(file)),
              ),
            ),
          ),
        ),
      );

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Theme(
      data: Space.cover.theme(context),
      child: Builder(
        builder: (context) => Scaffold(
          appBar: AppBar(
            title: Text(coverTemplateName(widget.preview.template)),
          ),
          body: FutureBuilder(
            future: _pdf,
            builder: (context, snapshot) => switch (snapshot) {
              AsyncSnapshot(hasData: true, :final data?) => ColoredBox(
                color: scheme.surfaceContainerHigh,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    if (_blanks.isNotEmpty)
                      _BlankNotice(
                        blanks: _blanks,
                        onFill: () => Navigator.of(context).pop(),
                      ),
                    Expanded(
                      child: Padding(
                        padding: const EdgeInsets.fromLTRB(24, 20, 24, 8),
                        child: Center(
                          child: _Page(
                            onTap: () => _zoom(context, data),
                            child: ref.watch(coverPageViewerProvider)(data),
                          ),
                        ),
                      ),
                    ),
                    Padding(
                      padding: const EdgeInsets.only(bottom: 12),
                      child: Text(
                        'Tap the page to zoom in',
                        textAlign: TextAlign.center,
                        style: TextStyle(color: scheme.onSurfaceVariant),
                      ),
                    ),
                  ],
                ),
              ),
              AsyncSnapshot(hasError: true, :final error?) => StateMessage(
                icon: isOffline(error)
                    ? Icons.cloud_off_rounded
                    : Icons.error_outline_rounded,
                shape: ExamKind.lab,
                title: isOffline(error)
                    ? "You're offline"
                    : "Couldn't make the page",
                body: isOffline(error)
                    ? 'The cover page is made online. Connect and try again.'
                    : 'Something went wrong on our side. Please try again.',
                actions: [
                  FilledButton(
                    onPressed: () => setState(() {
                      _pdf = _makePdf();
                    }),
                    child: const Text('Try again'),
                  ),
                ],
              ),
              _ => const Center(child: CircularProgressIndicator()),
            },
          ),
          bottomNavigationBar: SafeArea(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
              child: Row(
                spacing: 10,
                children: [
                  Expanded(
                    child: Builder(
                      builder: (button) => FilledButton.icon(
                        style: FilledButton.styleFrom(
                          minimumSize: const Size.fromHeight(56),
                        ),
                        onPressed: _busy != null
                            ? null
                            : () => _share(button, CoverFormat.pdf),
                        icon: const Icon(Icons.share_outlined),
                        label: const Text('Share PDF'),
                      ),
                    ),
                  ),
                  Builder(
                    builder: (button) => FilledButton.tonal(
                      style: FilledButton.styleFrom(
                        minimumSize: const Size(0, 56),
                      ),
                      onPressed: _busy != null
                          ? null
                          : () => _share(button, CoverFormat.docx),
                      child: Text(
                        _busy == CoverFormat.docx ? 'Making it…' : 'Word file',
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

/// An A4 page.
class _Page extends StatelessWidget {
  const _Page({required this.child, this.onTap});

  final Widget child;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) => AspectRatio(
    aspectRatio: 595.28 / 841.89,
    child: Semantics(
      label: 'The cover page',
      image: true,
      button: onTap != null,
      hint: onTap == null ? null : 'Zoom in',
      child: GestureDetector(
        onTap: onTap,
        child: DecoratedBox(
          decoration: const BoxDecoration(
            color: Colors.white,
            boxShadow: [BoxShadow(blurRadius: 10, color: Color(0x2E000000))],
          ),
          child: child,
        ),
      ),
    ),
  );
}

/// What's left blank, with the way back to fill it in.
class _BlankNotice extends StatelessWidget {
  const _BlankNotice({required this.blanks, required this.onFill});

  final List<String> blanks;
  final VoidCallback onFill;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
      child: Material(
        color: scheme.primaryContainer,
        borderRadius: BorderRadius.circular(16),
        child: Padding(
          padding: const EdgeInsets.fromLTRB(14, 6, 6, 6),
          child: Row(
            spacing: 10,
            children: [
              Icon(
                Icons.info_outline_rounded,
                color: scheme.onPrimaryContainer,
              ),
              Expanded(
                child: Text.rich(
                  TextSpan(
                    children: [
                      const TextSpan(
                        text: 'Left blank: ',
                        style: TextStyle(fontWeight: FontWeight.w700),
                      ),
                      TextSpan(text: listed(blanks)),
                    ],
                  ),
                  style: TextStyle(color: scheme.onPrimaryContainer),
                ),
              ),
              TextButton(onPressed: onFill, child: const Text('Fill in')),
            ],
          ),
        ),
      ),
    );
  }
}
