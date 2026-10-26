/// The one rule for searching names (courses, departments, any picker), so
/// every search box finds the same things in the same order. The website has
/// the same rule (`packages/shared/src/search.ts`); both run the cases in
/// `packages/shared/test-data/name-search.json`, so they can't drift apart.
library;

final _space = RegExp(r'\s+');

/// The typed words, lower-case.
List<String> queryWords(String query) =>
    query.toLowerCase().split(_space).where((w) => w.isNotEmpty).toList();

/// How well a name matches what was typed, lower is better, or null for no
/// match: 0 the name starts with it ("data" → Data Structures), 1 it's one of
/// the name's short names ([aliases], lower-case, initials among them: "pps",
/// "dsa"), 2 it starts a short name, two letters or more ("pp" → "pps"), 3 the
/// name contains every typed word, in any order ("struct data").
int? matchRank(String name, String query, [List<String> aliases = const []]) {
  final typed = queryWords(query);
  if (typed.isEmpty) return null;
  final q = typed.join(' ');
  final lower = name.toLowerCase();
  if (lower.startsWith(q)) return 0;
  if (aliases.contains(q)) return 1;
  if (q.length >= 2 && aliases.any((a) => a.startsWith(q))) return 2;
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
