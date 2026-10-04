import 'dart:async';
import 'dart:convert';

import 'package:flutter/services.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../data/routine.dart';

// The Class Routine's home-screen widget (Android, docs/PLAN.md decisions 35-36): the
// app hands it the saved routine's week, and a tap on it opens Today. The
// widget itself (android/…/RoutineWidgets.kt) works out "now" and "next".

const _channel = MethodChannel('ourdiu/routine_widget');

/// The week as the widgets read it: a short label ("67_B1", "STA"), and each
/// class's day, times, course, who (a lab group, or the sections attending a
/// teacher's class) and room. Null when nothing is saved.
String? routineWidgetData(MyRoutine? mine) {
  if (mine == null) return null;
  return jsonEncode({
    'label': switch (mine.saved) {
      SavedSection(:final section, :final group) => pickLabel(section, group),
      SavedTeacher(:final initials) => initials,
    },
    'version': mine.version.version,
    'classes': [
      for (final c in mine.classes)
        {
          'day': c.day.json,
          'start': c.start,
          'end': c.end,
          'course': c.course.title ?? c.course.code,
          'who': ?switch (c) {
            AttendedClass(:final sections) => attendingLabel(sections),
            _ when c.labGroup != null => '${c.labGroup} lab',
            _ when isLab(c) => 'Lab',
            _ => null,
          },
          'room': c.room,
          'lab': isLab(c),
        },
    ],
  });
}

/// Keeps the widgets showing the saved routine, and opens Today from them.
class RoutineWidgetSync extends ConsumerStatefulWidget {
  const RoutineWidgetSync({
    super.key,
    required this.router,
    required this.child,
  });

  final GoRouter router;
  final Widget child;

  @override
  ConsumerState<RoutineWidgetSync> createState() => _RoutineWidgetSyncState();
}

class _RoutineWidgetSyncState extends ConsumerState<RoutineWidgetSync> {
  String? _sent;
  var _first = true;

  @override
  void initState() {
    super.initState();
    _channel.setMethodCallHandler((call) async {
      if (call.method == 'open') widget.router.go('/routine');
    });
    unawaited(_openedFromWidget());
    // Nothing saved (or forgotten): the widgets say how to pick one.
    ref.listenManual(myRoutineChoiceProvider, (_, saved) {
      if (saved == null) unawaited(_send(null));
    }, fireImmediately: true);
    // Loaded (or the phone's copy, offline): the widgets show it. Listening also
    // loads the saved routine at start, so the widgets follow a new version
    // without a visit to the routine.
    ref.listenManual(myRoutineProvider, (_, next) {
      if (next case AsyncData(:final value?)) {
        unawaited(_send(routineWidgetData(value)));
      }
    }, fireImmediately: true);
  }

  Future<void> _openedFromWidget() async {
    try {
      if (await _channel.invokeMethod<bool>('take') ?? false) {
        widget.router.go('/routine');
      }
    } on MissingPluginException {
      // iOS and tests: no widgets.
    }
  }

  Future<void> _send(String? data) async {
    if (!_first && data == _sent) return;
    _first = false;
    _sent = data;
    try {
      await _channel.invokeMethod<void>('save', data);
    } on MissingPluginException {
      // iOS and tests: no widgets.
    }
  }

  @override
  Widget build(BuildContext context) => widget.child;
}
