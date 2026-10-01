import 'dart:io';

import 'package:device_info_plus/device_info_plus.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:in_app_review/in_app_review.dart';
import 'package:package_info_plus/package_info_plus.dart';
import 'package:url_launcher/url_launcher.dart';

/// Where feedback goes: the address on the site's contact page (AUTHOR.email).
const supportEmail = 'sourov2305101004@diu.edu.bd';

/// The app and phone a feedback email came from, so bugs can be reproduced.
class AppDetails {
  const AppDetails({
    required this.version,
    required this.build,
    required this.device,
  });

  final String version;
  final String build;
  final String device;
}

final appDetailsProvider = FutureProvider<AppDetails>((ref) async {
  final package = await PackageInfo.fromPlatform();
  final info = DeviceInfoPlugin();
  final device = switch (Platform.operatingSystem) {
    'android' => await info.androidInfo.then(
      (a) =>
          '${a.manufacturer} ${a.model}, Android ${a.version.release} '
          '(SDK ${a.version.sdkInt})',
    ),
    'ios' => await info.iosInfo.then(
      (i) => '${i.utsname.machine}, iOS ${i.systemVersion}',
    ),
    _ => Platform.operatingSystemVersion,
  };
  return AppDetails(
    version: package.version,
    build: package.buildNumber,
    device: device,
  );
});

/// An email to [supportEmail], with room to write above the app's details.
Uri feedbackEmail(AppDetails? details) {
  final body = [
    '',
    '',
    '—',
    if (details != null) ...[
      'App ${details.version} (${details.build})',
      details.device,
    ],
  ].join('\n');
  // Not Uri(queryParameters:): mail apps show its + for spaces literally.
  return Uri.parse(
    'mailto:$supportEmail'
    '?subject=${Uri.encodeComponent('QuestionBank app feedback')}'
    '&body=${Uri.encodeComponent(body)}',
  );
}

Future<void> sendFeedback(AppDetails? details) =>
    launchUrl(feedbackEmail(details));

/// The app's Play Store page, where a rating can be left. Unlike
/// requestReview(), it always opens: Play limits how often the review card shows.
Future<void> openStoreListing() => InAppReview.instance.openStoreListing();
