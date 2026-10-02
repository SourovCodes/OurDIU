import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../auth/sign_in_flow.dart';
import '../../data/format.dart';
import 'papers.dart';

/// "Share a paper": signs in with a DIU account if needed, then scan or pick a
/// PDF and open the form with it.
Future<void> startSharing(BuildContext context, WidgetRef ref) async {
  if (!await ensureContributor(context, ref)) return;
  if (!context.mounted) return;
  final pdf = await choosePdf(context, ref);
  if (pdf == null || !context.mounted) return;
  openUploadForm(context, pdf);
}

/// Asks whether to scan or pick a PDF, then gets it. Null when the user backs
/// out, or (after saying why) when it couldn't be read or is too big.
Future<PickedPdf?> choosePdf(
  BuildContext context,
  WidgetRef ref, {
  String title = 'Share a paper',
}) async {
  final source = await showModalBottomSheet<PaperSource>(
    context: context,
    useRootNavigator: true,
    showDragHandle: true,
    builder: (context) => _SourceSheet(title: title),
  );
  if (source == null || !context.mounted) return null;
  final pdf = await _pick(context, ref, source);
  if (pdf == null || !context.mounted) return null;
  if (pdf.bytes > maxPaperBytes) {
    _tooBig(context, pdf);
    return null;
  }
  return pdf;
}

/// Gets a PDF from [source]; says so when that fails.
Future<PickedPdf?> _pick(
  BuildContext context,
  WidgetRef ref,
  PaperSource source,
) async {
  final messenger = ScaffoldMessenger.of(context);
  final sources = ref.read(paperSourcesProvider);
  final PickedPdf? pdf;
  try {
    pdf = source == PaperSource.scan
        ? await sources.scan()
        : await sources.pick();
  } catch (e) {
    debugPrint('Getting a paper failed: $e');
    messenger.showSnackBar(
      SnackBar(
        content: Text(
          source == PaperSource.scan
              ? "The scanner couldn't start. Try choosing a PDF instead."
              : "Couldn't open that file. Try another one.",
        ),
      ),
    );
    return null;
  }
  return pdf;
}

void _tooBig(BuildContext context, PickedPdf pdf) =>
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(
          'This PDF is ${fileSize(pdf.bytes)}; the limit is '
          '${fileSize(maxPaperBytes)}. Scanning it again makes a smaller file.',
        ),
      ),
    );

/// Opens the form for [pdf], or says why it can't be uploaded.
bool openUploadForm(BuildContext context, PickedPdf pdf) {
  if (pdf.bytes > maxPaperBytes) {
    _tooBig(context, pdf);
    return false;
  }
  context.push('/upload', extra: pdf);
  return true;
}

class _SourceSheet extends StatelessWidget {
  const _SourceSheet({required this.title});

  final String title;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          spacing: 10,
          children: [
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 8),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                spacing: 2,
                children: [
                  Text(
                    title,
                    style: theme.textTheme.titleLarge?.copyWith(
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  Text(
                    'One exam per file, up to 20 MB. Scanning makes a clean PDF '
                    'from photos.',
                    style: TextStyle(color: theme.colorScheme.onSurfaceVariant),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 4),
            // ML Kit's document scanner is Android-only.
            if (defaultTargetPlatform == TargetPlatform.android)
              const _SourceOption(
                source: PaperSource.scan,
                icon: Icons.document_scanner_outlined,
                title: 'Scan the paper',
                subtitle: 'The camera finds the edges. Add every page.',
              ),
            const _SourceOption(
              source: PaperSource.files,
              icon: Icons.picture_as_pdf_outlined,
              title: 'Choose a PDF',
              subtitle: 'From Files, Downloads or Drive',
            ),
          ],
        ),
      ),
    );
  }
}

class _SourceOption extends StatelessWidget {
  const _SourceOption({
    required this.source,
    required this.icon,
    required this.title,
    required this.subtitle,
  });

  final PaperSource source;
  final IconData icon;
  final String title;
  final String subtitle;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Material(
      color: scheme.surfaceContainer,
      borderRadius: BorderRadius.circular(20),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: () => Navigator.pop(context, source),
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Row(
            spacing: 14,
            children: [
              Container(
                width: 48,
                height: 48,
                decoration: BoxDecoration(
                  color: scheme.primaryContainer,
                  borderRadius: BorderRadius.circular(16),
                ),
                child: Icon(icon, color: scheme.onPrimaryContainer),
              ),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  spacing: 2,
                  children: [
                    Text(
                      title,
                      style: const TextStyle(
                        fontWeight: FontWeight.w600,
                        fontSize: 16,
                      ),
                    ),
                    Text(
                      subtitle,
                      style: TextStyle(
                        color: scheme.onSurfaceVariant,
                        fontSize: 13,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
