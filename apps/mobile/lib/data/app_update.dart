import 'dart:async';
import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:in_app_update/in_app_update.dart';
import 'package:package_info_plus/package_info_plus.dart';

import '../api/api.dart';
import 'prefs.dart';

// Keeping the app up to date, checked once per launch (docs/PLAN.md, decision 26):
// - an app older than the server's minimum (GET /api/v1/app/android) shows only
//   "Time to update", for the rare breaking change;
// - otherwise Google Play's in-app update: Play asks, downloads in the background,
//   and the app offers to restart into the new version.

/// What Play says about an update to this app.
enum PlayUpdate { none, available, downloaded }

/// Google Play's in-app updates, behind an interface so tests can stand in for Play.
abstract class PlayUpdates {
  /// Whether Play has an update, and its version code. `none` wherever Play can't
  /// tell: not Android, not installed from Play, debug builds, offline.
  Future<({PlayUpdate state, int? versionCode})> check();

  /// Play's own "Update available" sheet; true once the person accepts. The
  /// download goes on in the background.
  Future<bool> startFlexible();

  /// Fires once the background download is complete.
  Stream<void> get downloaded;

  /// Installs the downloaded update and restarts the app.
  Future<void> completeFlexible();
}

class GooglePlayUpdates implements PlayUpdates {
  /// Only release builds on Android come from Play; anything else just fails.
  bool get _supported => Platform.isAndroid && kReleaseMode;

  @override
  Future<({PlayUpdate state, int? versionCode})> check() async {
    if (!_supported) return (state: PlayUpdate.none, versionCode: null);
    try {
      final info = await InAppUpdate.checkForUpdate();
      if (info.installStatus == InstallStatus.downloaded) {
        return (
          state: PlayUpdate.downloaded,
          versionCode: info.availableVersionCode,
        );
      }
      final available =
          info.updateAvailability == UpdateAvailability.updateAvailable &&
          info.flexibleUpdateAllowed;
      return (
        state: available ? PlayUpdate.available : PlayUpdate.none,
        versionCode: info.availableVersionCode,
      );
    } on PlatformException {
      return (state: PlayUpdate.none, versionCode: null);
    }
  }

  @override
  Future<bool> startFlexible() async {
    try {
      return await InAppUpdate.startFlexibleUpdate() == AppUpdateResult.success;
    } on PlatformException {
      return false;
    }
  }

  @override
  Stream<void> get downloaded => InAppUpdate.installUpdateListener
      .where((status) => status == InstallStatus.downloaded)
      .map((_) {});

  @override
  Future<void> completeFlexible() => InAppUpdate.completeFlexibleUpdate();
}

final playUpdatesProvider = Provider<PlayUpdates>((ref) => GooglePlayUpdates());

/// This app's version, MAJOR.MINOR.PATCH (from its mobile-v* tag).
final installedVersionProvider = FutureProvider<String>(
  (ref) async => (await PackageInfo.fromPlatform()).version,
);

/// The oldest version the server still works with.
final minimumVersionProvider = FutureProvider<String>(
  (ref) async =>
      (await ref.watch(qbApiProvider).app.getApiV1AppAndroid()).minVersion,
);

/// Whether [version] comes before [other] (both MAJOR.MINOR.PATCH). Anything that
/// isn't a version counts as current, so a bad value never locks people out.
bool isOlderVersion(String version, String other) {
  List<int>? parts(String v) {
    final numbers = v.split('.').map(int.tryParse).toList();
    return numbers.length == 3 && !numbers.contains(null)
        ? numbers.cast<int>()
        : null;
  }

  final (a, b) = (parts(version), parts(other));
  if (a == null || b == null) return false;
  for (var i = 0; i < 3; i++) {
    if (a[i] != b[i]) return a[i] < b[i];
  }
  return false;
}

enum AppUpdateStatus {
  /// Nothing to do (or still checking).
  current,

  /// Older than the server's minimum: only "Time to update" is shown.
  required,

  /// Downloaded by Play: offer to restart into it.
  readyToRestart,
}

/// After "No thanks", Play isn't asked again for the same version this long.
const declinedUpdateSnooze = Duration(days: 3);

const _declinedKey = 'update_declined';

class AppUpdate extends Notifier<AppUpdateStatus> {
  var _checked = false;

  @override
  AppUpdateStatus build() => AppUpdateStatus.current;

  /// Runs the launch check, once per app session.
  Future<void> check() async {
    if (_checked) return;
    _checked = true;

    // The server's minimum first: an app that no longer works shouldn't offer
    // anything else. Offline or failing, it isn't known, so nobody is blocked.
    try {
      final (installed, minimum) = await (
        ref.read(installedVersionProvider.future),
        ref.read(minimumVersionProvider.future),
      ).wait;
      if (isOlderVersion(installed, minimum)) {
        state = AppUpdateStatus.required;
        return;
      }
    } catch (_) {
      // Unknown: carry on.
    }

    final play = ref.read(playUpdatesProvider);
    final update = await play.check();
    switch (update.state) {
      case PlayUpdate.none:
        return;
      case PlayUpdate.downloaded:
        state = AppUpdateStatus.readyToRestart;
        return;
      case PlayUpdate.available:
        if (_declinedRecently(update.versionCode)) return;
        // Listen before starting, so a quick download isn't missed.
        final downloaded = play.downloaded.first;
        if (!await play.startFlexible()) {
          downloaded.ignore();
          _rememberDeclined(update.versionCode);
          return;
        }
        await downloaded;
        if (ref.mounted) state = AppUpdateStatus.readyToRestart;
    }
  }

  Future<void> restart() => ref.read(playUpdatesProvider).completeFlexible();

  /// Saved as `versionCode:millisecondsSinceEpoch`.
  bool _declinedRecently(int? versionCode) {
    final saved = ref.read(prefsProvider).getString(_declinedKey)?.split(':');
    if (saved == null || saved.length != 2 || saved[0] != '$versionCode') {
      return false;
    }
    final at = int.tryParse(saved[1]);
    return at != null &&
        DateTime.now().difference(DateTime.fromMillisecondsSinceEpoch(at)) <
            declinedUpdateSnooze;
  }

  void _rememberDeclined(int? versionCode) => ref
      .read(prefsProvider)
      .setString(
        _declinedKey,
        '$versionCode:${DateTime.now().millisecondsSinceEpoch}',
      );
}

final appUpdateProvider = NotifierProvider<AppUpdate, AppUpdateStatus>(
  AppUpdate.new,
);
