import 'dart:async';

import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'papers.dart';

/// PDFs shared to the app from others ("Share → QuestionBank", Android).
abstract interface class SharedPdfs {
  /// The PDF the app was opened with, once.
  Future<PickedPdf?> initial();

  /// PDFs shared while the app is running.
  Stream<PickedPdf> get incoming;
}

/// Talks to `MainActivity`, which copies the shared file into the cache. No
/// path means it wasn't copied: too big (the size says so) or unreadable
/// (size -1).
class PlatformSharedPdfs implements SharedPdfs {
  PlatformSharedPdfs() {
    _channel.setMethodCallHandler((call) async {
      if (call.method != 'shared') return;
      if (await _read(call.arguments) case final pdf?) _incoming.add(pdf);
    });
  }

  static const _channel = MethodChannel('diuqbank/shared_pdf');
  final _incoming = StreamController<PickedPdf>.broadcast();

  @override
  Stream<PickedPdf> get incoming => _incoming.stream;

  @override
  Future<PickedPdf?> initial() async {
    try {
      return await _read(await _channel.invokeMethod<Object?>('take'));
    } on MissingPluginException {
      // iOS, for now.
      return null;
    }
  }

  static Future<PickedPdf?> _read(Object? value) async {
    if (value is! Map) return null;
    final path = value['path'] as String?;
    return PickedPdf(
      path: path ?? '',
      name: value['name'] as String? ?? 'Shared paper.pdf',
      bytes: (value['size'] as num?)?.toInt() ?? 0,
      source: PaperSource.shared,
      pages: path == null ? null : await countPages(path),
    );
  }
}

final sharedPdfsProvider = Provider<SharedPdfs>((ref) => PlatformSharedPdfs());
