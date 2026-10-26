/// The one rule for searching names (courses, departments, any picker), so
/// every search box finds the same things in the same order. The website has
/// the same rule (`apps/web/app/lib/search.ts`); both run the cases in
/// `packages/shared/test-data/name-search.json`, so they can't drift apart.
library;

const _smallWords = {'and', 'of', 'the', 'in', 'for', 'to'};
final _numeral = RegExp(r'^([ivx]+|\d+)$');
final _nonWord = RegExp('[^a-z0-9]+');
final _space = RegExp(r'\s+');

/// The first letters of a name's words, the way students shorten it:
/// "Programming and Problem Solving" is "pps", "Electrical Circuits I" is
/// "ec". Small words and numbers (Roman or not) are left out.
String initials(String name) => name
    .toLowerCase()
    .split(_nonWord)
    .where(
      (w) => w.isNotEmpty && !_smallWords.contains(w) && !_numeral.hasMatch(w),
    )
    .map((w) => w[0])
    .join();

/// The typed words, lower-case.
List<String> queryWords(String query) =>
    query.toLowerCase().split(_space).where((w) => w.isNotEmpty).toList();

/// How well a name matches what was typed, lower is better, or null for no
/// match: 0 the name starts with it ("data" → Data Structures), 1 one word
/// that is the name's initials ("pps"), 2 one word that starts them ("pp"),
/// 3 the name contains every typed word, in any order ("struct data").
int? matchRank(String name, String query) {
  final typed = queryWords(query);
  if (typed.isEmpty) return null;
  final q = typed.join(' ');
  final lower = name.toLowerCase();
  if (lower.startsWith(q)) return 0;
  if (typed.length == 1 && q.length >= 2) {
    final short = initials(name);
    if (short == q) return 1;
    if (short.startsWith(q)) return 2;
  }
  return typed.every(lower.contains) ? 3 : null;
}

/// The better of two ranks, either of which may be no match.
int? bestRank(int? a, int? b) =>
    a == null ? b : (b == null ? a : (a < b ? a : b));

/// The items that match, best first; items with the same rank keep their
/// order. [rank] is usually [matchRank] on the item's name.
List<T> searchBy<T>(Iterable<T> items, int? Function(T) rank) {
  final ranked = <({T item, int index, int rank})>[];
  var index = 0;
  for (final item in items) {
    final r = rank(item);
    if (r != null) ranked.add((item: item, index: index, rank: r));
    index++;
  }
  // List.sort isn't stable, hence the index.
  ranked.sort((a, b) => a.rank != b.rank ? a.rank - b.rank : a.index - b.index);
  return [for (final r in ranked) r.item];
}
