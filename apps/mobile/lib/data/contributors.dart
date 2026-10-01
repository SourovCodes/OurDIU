import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../api/api.dart';
import '../api/generated/export.dart';

/// The students who share papers, most published first; a page of [pageSize].
const contributorsPageSize = 30;

final contributorsPageProvider = FutureProvider.autoDispose
    .family<ContributorList, int>(
      (ref, page) => ref
          .watch(qbApiProvider)
          .contributors
          .getApiV1Contributors(page: page, pageSize: contributorsPageSize),
    );

/// A contributor's profile and the first page of their published papers.
final contributorProvider = FutureProvider.autoDispose
    .family<ContributorDetail, String>(
      (ref, username) => ref
          .watch(qbApiProvider)
          .contributors
          .getApiV1ContributorsUsername(username: username, pageSize: 50),
    );
