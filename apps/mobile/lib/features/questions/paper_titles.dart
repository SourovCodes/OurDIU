import '../../api/generated/export.dart';

// Mirrors apps/web/app/lib/submissions.ts, so a paper has the same name in the app
// and on the site.

/// e.g. "Section 5A · Batch 61", or null when the uploader gave neither.
String? paperDetails(Submission submission) {
  final parts = [
    if (submission.section case final section?) 'Section $section',
    if (submission.batch case final batch?) 'Batch $batch',
  ];
  return parts.isEmpty ? null : parts.join(' · ');
}

/// How to tell the papers of one question apart: by section and batch when given,
/// otherwise by who uploaded them, and only then by number ("Paper 2").
String paperTitle(Submission submission, int index) =>
    paperDetails(submission) ??
    switch (submission.uploader) {
      final uploader? => 'By ${uploader.name}',
      null => 'Paper ${index + 1}',
    };

/// Titles for a question's published papers (in list order) that tell them apart:
/// two "Batch 65" papers become "Batch 65 · Jane" and "Batch 65 · Sam", and any
/// that still clash are numbered.
Map<int, String> paperTitles(List<Submission> published) {
  Map<String, int> countOf(Iterable<String> titles) {
    final counts = <String, int>{};
    for (final title in titles) {
      counts[title] = (counts[title] ?? 0) + 1;
    }
    return counts;
  }

  final base = [for (final (i, s) in published.indexed) paperTitle(s, i)];
  final baseCounts = countOf(base);
  final named = [
    for (final (i, s) in published.indexed)
      baseCounts[base[i]]! > 1 && paperDetails(s) != null && s.uploader != null
          ? '${base[i]} · ${s.uploader!.name}'
          : base[i],
  ];

  final namedCounts = countOf(named);
  final seen = <String, int>{};
  return {
    for (final (i, s) in published.indexed)
      s.id: namedCounts[named[i]] == 1
          ? named[i]
          : '${named[i]} (${seen[named[i]] = (seen[named[i]] ?? 0) + 1})',
  };
}
