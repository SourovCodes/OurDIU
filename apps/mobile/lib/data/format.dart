import 'dart:io';

import 'package:dio/dio.dart';

/// 1220 → "1,220".
String thousands(int n) =>
    n.toString().replaceAllMapped(RegExp(r'\B(?=(\d{3})+(?!\d))'), (_) => ',');

/// View counts: 940 → "940", 6358 → "6.4k", 12400 → "12k".
String compactCount(int n) {
  if (n < 1000) return '$n';
  final k = n / 1000;
  final text = k >= 10 ? k.round().toString() : k.toStringAsFixed(1);
  return '${text.replaceAll(RegExp(r'\.0$'), '')}k';
}

String plural(int n, String word, [String? pluralForm]) =>
    '${thousands(n)} ${n == 1 ? word : (pluralForm ?? '${word}s')}';

/// Semesters newest first, like the site: by year, then Fall, Summer, Spring,
/// Short. Names look like "Fall 25" (`parseSemesterName` in @qb/shared).
int compareSemesters(String a, String b) {
  const terms = ['Fall', 'Summer', 'Spring', 'Short'];
  (int, int) key(String name) {
    final parts = name.split(' ');
    final year = parts.length == 2 ? int.tryParse(parts[1]) ?? 0 : 0;
    final term = terms.indexOf(parts.first);
    return (year, term < 0 ? terms.length : term);
  }

  final (yearA, termA) = key(a);
  final (yearB, termB) = key(b);
  return yearA != yearB ? yearB.compareTo(yearA) : termA.compareTo(termB);
}

/// Whether a request failed because the phone has no connection (rather than
/// the server answering with an error).
bool isOffline(Object error) =>
    error is DioException &&
    (error.type == DioExceptionType.connectionError ||
        error.type == DioExceptionType.connectionTimeout ||
        error.error is SocketException);

const _months = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

/// e.g. "25 Sep 2026", in the phone's time zone.
String shortDate(DateTime date) {
  final d = date.toLocal();
  return '${d.day} ${_months[d.month - 1]} ${d.year}';
}

/// How long ago, shortly: "just now", "5 min", "3 h", "2 d", then the date.
String timeAgo(DateTime date, {DateTime? now}) {
  final elapsed = (now ?? DateTime.now()).difference(date);
  if (elapsed.inMinutes < 1) return 'just now';
  if (elapsed.inHours < 1) return '${elapsed.inMinutes} min';
  if (elapsed.inDays < 1) return '${elapsed.inHours} h';
  if (elapsed.inDays < 7) return '${elapsed.inDays} d';
  return shortDate(date);
}

/// 272499 → "266 KB", 2400000 → "2.3 MB".
String fileSize(int bytes) => bytes < 1024 * 1024
    ? '${(bytes / 1024).round()} KB'
    : '${(bytes / (1024 * 1024)).toStringAsFixed(1)} MB';
