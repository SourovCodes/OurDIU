import 'dart:io';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:path_provider/path_provider.dart';
import 'package:share_plus/share_plus.dart';
import 'package:url_launcher/url_launcher.dart';

/// Downloads the PDF to the app's temporary folder and opens the share sheet, from
/// where it can be saved to Files or Drive or sent to someone.
Future<void> sharePaper(
  BuildContext context, {
  required Dio dio,
  required Uri url,
  required String fileName,
}) async {
  // iPads anchor the share sheet on the button that opened it.
  final box = context.findRenderObject() as RenderBox?;
  final origin = box == null ? null : box.localToGlobal(Offset.zero) & box.size;
  final dir = await getTemporaryDirectory();
  final file = File('${dir.path}/$fileName');
  await dio.downloadUri(url, file.path);
  await SharePlus.instance.share(
    ShareParams(
      files: [XFile(file.path, mimeType: 'application/pdf')],
      sharePositionOrigin: origin,
    ),
  );
}

Future<void> openInBrowser(Uri url) =>
    launchUrl(url, mode: LaunchMode.externalApplication);

/// e.g. "Data Structures - Final - Fall 25.pdf", without characters that file
/// systems reject.
String paperFileName(List<String> parts) =>
    '${parts.join(' - ').replaceAll(RegExp(r'[\\/:*?"<>|]'), '')}.pdf';
