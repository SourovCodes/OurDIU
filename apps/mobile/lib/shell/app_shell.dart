import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../auth/sign_in_flow.dart';
import '../features/upload/papers.dart';
import '../features/upload/share_flow.dart';
import '../features/upload/shared_pdfs.dart';

/// The four tabs. Each keeps its own navigation stack; tapping the current tab
/// again returns to its first screen. Also where PDFs shared from other apps
/// arrive: they open the upload form.
class AppShell extends ConsumerStatefulWidget {
  const AppShell({super.key, required this.shell});

  final StatefulNavigationShell shell;

  @override
  ConsumerState<AppShell> createState() => _AppShellState();
}

class _AppShellState extends ConsumerState<AppShell> {
  StreamSubscription<PickedPdf>? _shared;

  @override
  void initState() {
    super.initState();
    final shared = ref.read(sharedPdfsProvider);
    _shared = shared.incoming.listen(_open);
    // After the first frame, so the sign-in sheet has somewhere to open.
    WidgetsBinding.instance.addPostFrameCallback((_) async {
      if (await shared.initial() case final pdf?) _open(pdf);
    });
  }

  @override
  void dispose() {
    _shared?.cancel();
    super.dispose();
  }

  Future<void> _open(PickedPdf pdf) async {
    if (!mounted) return;
    // Too big ones still say so in the form's check; this one couldn't be read.
    if (pdf.path.isEmpty && pdf.bytes <= maxPaperBytes) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text("Couldn't open the shared file. Try saving it first."),
        ),
      );
      return;
    }
    if (!await ensureSignedIn(context, ref, to: 'share papers')) return;
    if (mounted) openUploadForm(context, pdf);
  }

  @override
  Widget build(BuildContext context) {
    final shell = widget.shell;
    return Scaffold(
      body: shell,
      bottomNavigationBar: NavigationBar(
        selectedIndex: shell.currentIndex,
        onDestinationSelected: (i) =>
            shell.goBranch(i, initialLocation: i == shell.currentIndex),
        destinations: const [
          NavigationDestination(
            icon: Icon(Icons.home_outlined),
            selectedIcon: Icon(Icons.home_rounded),
            label: 'Home',
          ),
          NavigationDestination(
            icon: Icon(Icons.explore_outlined),
            selectedIcon: Icon(Icons.explore_rounded),
            label: 'Browse',
          ),
          NavigationDestination(
            icon: Icon(Icons.bookmarks_outlined),
            selectedIcon: Icon(Icons.bookmarks_rounded),
            label: 'Saved',
          ),
          NavigationDestination(
            icon: Icon(Icons.person_outline_rounded),
            selectedIcon: Icon(Icons.person_rounded),
            label: 'Account',
          ),
        ],
      ),
    );
  }
}

/// The current tab's first path segment ("/home" or "/browse"), so department
/// and course pages open inside the tab they were reached from.
String tabRoot(BuildContext context) =>
    '/${GoRouterState.of(context).uri.pathSegments.first}';
