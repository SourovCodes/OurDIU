import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../api/api.dart';
import '../api/generated/export.dart';

/// Departments, courses, semesters and exam types, loaded once per app session
/// (one request, like the site's `loadTaxonomy`).
final taxonomyProvider = FutureProvider<Taxonomy>(
  (ref) => ref.watch(qbApiProvider).taxonomy.getApiV1Taxonomy(),
);
