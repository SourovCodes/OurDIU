import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../data/app_update.dart';
import '../../data/support.dart';
import '../../theme/exam_shape.dart';
import '../../widgets/state_message.dart';

/// The app's snackbars outside any one screen, such as "Update downloaded".
final rootMessengerKey = GlobalKey<ScaffoldMessengerState>();

/// Wraps the whole app: runs the launch update check, shows only "Time to update"
/// when this version no longer works, and offers to restart once Play has
/// downloaded an update.
class UpdateGate extends ConsumerStatefulWidget {
  const UpdateGate({super.key, required this.child});

  final Widget child;

  @override
  ConsumerState<UpdateGate> createState() => _UpdateGateState();
}

class _UpdateGateState extends ConsumerState<UpdateGate> {
  @override
  void initState() {
    super.initState();
    // After the first frame: the check never holds up the app's start.
    WidgetsBinding.instance.addPostFrameCallback(
      (_) => ref.read(appUpdateProvider.notifier).check(),
    );
  }

  @override
  Widget build(BuildContext context) {
    ref.listen(appUpdateProvider, (_, status) {
      if (status != AppUpdateStatus.readyToRestart) return;
      rootMessengerKey.currentState?.showSnackBar(
        SnackBar(
          content: const Text(
            'Update downloaded. Restart to use the new version.',
          ),
          // Until they restart, or the app closes (Play installs it then).
          duration: const Duration(days: 1),
          behavior: SnackBarBehavior.floating,
          action: SnackBarAction(
            label: 'Restart',
            onPressed: () => ref.read(appUpdateProvider.notifier).restart(),
          ),
        ),
      );
    });
    return ref.watch(appUpdateProvider) == AppUpdateStatus.required
        ? const UpdateRequiredScreen()
        : widget.child;
  }
}

/// This version no longer works with the server: nothing but the way to update.
class UpdateRequiredScreen extends StatelessWidget {
  const UpdateRequiredScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Scaffold(
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(24, 24, 24, 32),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const Expanded(
                child: StateMessage(
                  icon: Icons.system_update_rounded,
                  shape: ExamKind.midterm,
                  title: 'Time to update OurDIU',
                  body:
                      "This version can't load papers any more. Update from "
                      'Google Play to keep using the Question Bank.',
                ),
              ),
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                spacing: 8,
                children: [
                  Icon(
                    Icons.bookmark_border_rounded,
                    size: 18,
                    color: scheme.primary,
                  ),
                  // Wraps on narrow screens and with large text.
                  Flexible(
                    child: Text(
                      'Your saved papers and account stay.',
                      style: TextStyle(color: scheme.onSurfaceVariant),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 24),
              FilledButton.icon(
                onPressed: openStoreListing,
                style: FilledButton.styleFrom(
                  minimumSize: const Size.fromHeight(56),
                ),
                icon: const Icon(Icons.shop_rounded),
                label: const Text('Update on Google Play'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
