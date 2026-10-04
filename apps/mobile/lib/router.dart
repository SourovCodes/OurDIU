import 'package:flutter/widgets.dart';
import 'package:go_router/go_router.dart';

import 'api/generated/export.dart';
import 'features/account/account_screen.dart';
import 'features/browse/browse_screen.dart';
import 'features/browse/course_screen.dart';
import 'features/browse/department_screen.dart';
import 'features/home/home_screen.dart';
import 'features/home/question_list_screen.dart';
import 'features/questions/question_screen.dart';
import 'data/routine.dart';
import 'features/routine/routine_screens.dart';
import 'features/saved/saved_screen.dart';
import 'features/search/search_screen.dart';
import 'features/upload/my_papers_screen.dart';
import 'features/upload/paper_screen.dart';
import 'features/upload/papers.dart';
import 'features/upload/review_thread.dart';
import 'features/upload/upload_screen.dart';
import 'shell/app_shell.dart';
import 'spaces/choose_screen.dart';
import 'features/contributors/contributor_screen.dart';
import 'features/contributors/contributors_screen.dart';
import 'spaces/coming_soon_screen.dart';
import 'spaces/space.dart';

final _rootKey = GlobalKey<NavigatorState>();

int _id(GoRouterState state) => int.tryParse(state.pathParameters['id']!) ?? 0;

/// Department and course pages, reachable from Home and Browse.
List<RouteBase> _catalogRoutes() => [
  GoRoute(
    path: 'departments/:id',
    builder: (context, state) => DepartmentScreen(id: _id(state)),
  ),
  GoRoute(
    path: 'courses/:id',
    builder: (context, state) => CourseScreen(id: _id(state)),
  ),
];

/// Where an ourdiu.com link (Android App Links, see AndroidManifest.xml) opens
/// in the app, or null when the location is the app's own. The site's pages
/// live under /questions; a paper (`/questions/123`) is the same path here.
String? webLinkLocation(Uri uri) {
  final s = uri.pathSegments;
  if (s.isEmpty || s.first != 'questions') return null;
  if (s.length == 2 && int.tryParse(s[1]) != null) return null;
  final rest = s.length > 2 ? s[2] : null;
  return switch (s.length > 1 ? s[1] : null) {
    'departments' when rest != null => '/browse/departments/$rest',
    'courses' when rest != null => '/browse/courses/$rest',
    'departments' || 'courses' || 'browse' => '/browse',
    'saved' => '/saved',
    'contributors' when rest != null => '/home/contributors/$rest',
    'contributors' => '/home/contributors',
    'my-submissions' when rest != null => '/account/papers/$rest',
    'my-submissions' => '/account/papers',
    // Sharing starts from Account (it needs a file and a signed-in user).
    'contribute' => '/account',
    _ => '/home',
  };
}

/// [initialLocation] is where the app opens: see `startLocation`.
GoRouter buildRouter({String initialLocation = '/home'}) => GoRouter(
  navigatorKey: _rootKey,
  initialLocation: initialLocation,
  redirect: (context, state) => webLinkLocation(state.uri),
  routes: [
    // First launch: which product to open.
    GoRoute(path: '/choose', builder: (context, state) => const ChooseScreen()),
    // Products that aren't out yet.
    // The Class Routine's space: Today, Students and Teachers (coming soon until
    // a routine is live).
    StatefulShellRoute.indexedStack(
      builder: (context, state, shell) => RoutineShell(shell: shell),
      branches: [
        StatefulShellBranch(
          routes: [
            GoRoute(
              path: '/routine',
              builder: (context, state) => const RoutineTodayScreen(),
            ),
          ],
        ),
        StatefulShellBranch(
          routes: [
            GoRoute(
              path: '/routine/sections',
              builder: (context, state) => const RoutineSectionsScreen(),
              routes: [
                GoRoute(
                  path: ':department/:section',
                  builder: (context, state) => RoutineSectionScreen(
                    department:
                        departmentFrom(state.pathParameters['department']) ??
                        RoutineDepartmentSlug.cse,
                    section: state.pathParameters['section']!,
                    group: state.uri.queryParameters['group'],
                  ),
                ),
              ],
            ),
          ],
        ),
        StatefulShellBranch(
          routes: [
            GoRoute(
              path: '/routine/teachers',
              builder: (context, state) => const RoutineTeachersScreen(),
              routes: [
                GoRoute(
                  path: ':department/:initials',
                  builder: (context, state) => RoutineTeacherScreen(
                    department:
                        departmentFrom(state.pathParameters['department']) ??
                        RoutineDepartmentSlug.cse,
                    initials: state.pathParameters['initials']!,
                  ),
                ),
              ],
            ),
          ],
        ),
      ],
    ),
    GoRoute(
      path: '/market',
      builder: (context, state) => const ComingSoonScreen(Space.market),
    ),
    // The Question Bank's space: its four tabs, and the screens covering them.
    StatefulShellRoute.indexedStack(
      builder: (context, state, shell) => AppShell(shell: shell),
      branches: [
        StatefulShellBranch(
          routes: [
            GoRoute(
              path: '/home',
              builder: (context, state) => const HomeScreen(),
              routes: [
                GoRoute(
                  path: 'contributors',
                  builder: (context, state) => const ContributorsScreen(),
                  routes: [
                    GoRoute(
                      path: ':username',
                      builder: (context, state) => ContributorScreen(
                        username: state.pathParameters['username']!,
                      ),
                    ),
                  ],
                ),
                GoRoute(
                  path: 'search',
                  builder: (context, state) => const SearchScreen(),
                ),
                GoRoute(
                  path: 'list/:which',
                  builder: (context, state) => QuestionListScreen(
                    list: HomeList.named(state.pathParameters['which']),
                  ),
                ),
                ..._catalogRoutes(),
              ],
            ),
          ],
        ),
        StatefulShellBranch(
          routes: [
            GoRoute(
              path: '/browse',
              builder: (context, state) => const BrowseScreen(),
              routes: [
                GoRoute(
                  path: 'search',
                  builder: (context, state) => const SearchScreen(),
                ),
                ..._catalogRoutes(),
              ],
            ),
          ],
        ),
        StatefulShellBranch(
          routes: [
            GoRoute(
              path: '/saved',
              builder: (context, state) => const SavedScreen(),
            ),
          ],
        ),
        StatefulShellBranch(
          routes: [
            GoRoute(
              path: '/account',
              builder: (context, state) => const AccountScreen(),
              routes: [
                GoRoute(
                  path: 'papers',
                  builder: (context, state) => const MyPapersScreen(),
                  routes: [
                    GoRoute(
                      path: ':id',
                      builder: (context, state) => PaperScreen(id: _id(state)),
                      routes: [
                        GoRoute(
                          parentNavigatorKey: _rootKey,
                          path: 'edit',
                          redirect: (context, state) =>
                              state.extra is MySubmissionDetail
                              ? null
                              : '/account/papers/${_id(state)}',
                          builder: (context, state) => UploadScreen(
                            editing: state.extra! as MySubmissionDetail,
                          ),
                        ),
                        GoRoute(
                          parentNavigatorKey: _rootKey,
                          path: 'messages',
                          builder: (context, state) =>
                              MessagesScreen(id: _id(state)),
                        ),
                      ],
                    ),
                  ],
                ),
              ],
            ),
          ],
        ),
      ],
    ),
    // The upload form covers the tabs; it needs the file it was opened with.
    GoRoute(
      parentNavigatorKey: _rootKey,
      path: '/upload',
      redirect: (context, state) =>
          state.extra is PickedPdf ? null : '/account',
      builder: (context, state) => UploadScreen(pdf: state.extra! as PickedPdf),
    ),
    // The reader covers the tabs.
    GoRoute(
      parentNavigatorKey: _rootKey,
      path: '/questions/:id',
      builder: (context, state) => QuestionScreen(
        id: _id(state),
        summary: state.extra is Question ? state.extra as Question : null,
        submissionId: int.tryParse(
          state.uri.queryParameters['submission'] ?? '',
        ),
      ),
    ),
  ],
);
