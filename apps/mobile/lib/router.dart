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
import 'features/saved/saved_screen.dart';
import 'features/search/search_screen.dart';
import 'features/upload/my_papers_screen.dart';
import 'features/upload/paper_screen.dart';
import 'features/upload/papers.dart';
import 'features/upload/upload_screen.dart';
import 'shell/app_shell.dart';
import 'spaces/choose_screen.dart';
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

/// [initialLocation] is where the app opens: see `startLocation`.
GoRouter buildRouter({String initialLocation = '/home'}) => GoRouter(
  navigatorKey: _rootKey,
  initialLocation: initialLocation,
  routes: [
    // First launch: which product to open.
    GoRoute(path: '/choose', builder: (context, state) => const ChooseScreen()),
    // Products that aren't out yet.
    GoRoute(
      path: '/routine',
      builder: (context, state) => const ComingSoonScreen(Space.routine),
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
                  path: 'search',
                  builder: (context, state) => const SearchScreen(),
                ),
                GoRoute(
                  path: 'list/:which',
                  builder: (context, state) => QuestionListScreen(
                    popular: state.pathParameters['which'] == 'popular',
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
              routes: _catalogRoutes(),
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
      ),
    ),
  ],
);
