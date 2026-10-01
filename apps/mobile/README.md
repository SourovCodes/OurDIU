# OurDIU mobile app

Flutter app for Android (`com.ourdiu.app`, "OurDIU" on Google Play) and iOS (`com.diuqbank.app`), using Riverpod and go_router. See "Mobile app" in the repository's README for how it fits in with the API.

```bash
fvm install             # the Flutter version pinned in .fvmrc
flutter pub get
flutter run             # against https://diuqbank.com (ourdiu.com after the cutover)
flutter run --dart-define=API_BASE_URL=http://10.0.2.2:5173   # local dev server, Android emulator
```

## Design

Material 3 Expressive on the site's indigo, in light and dark (`lib/theme/theme.dart`), with Roboto Flex bundled for the wide, heavy headings (`expressive()`; its licence is `assets/fonts/OFL.txt`). Each exam type has its own shape and colour, used in list badges, filter chips, carousel cards and empty states (`lib/theme/exam_shape.dart`): a scalloped "cookie" for Finals, a clover for Midterms, a circle for Quizzes, a rounded square for lab exams. Use the theme's colours and these widgets rather than literal colours, and check new screens at large font sizes and in both themes.

## Layout

- `lib/shell/` – the four tabs (Home, Browse, Saved, Account), each with its own navigation stack; `lib/router.dart` has the routes. The reader (`/questions/:id`) covers the tabs.
- `lib/features/` – screens and their providers, one folder per feature. `upload/` is sharing a paper: Android's ML Kit document scanner or the file picker (`papers.dart`), the form (`/upload`, which also edits a paper's details), Your papers (`/account/papers`) and each paper's page, which refreshes itself while the AI check runs. `review.dart` mirrors the site's `review.ts` and `analysis.ts` (stages, the comparison with the AI's reading, "Use the AI's details"); keep them in step.
- `lib/auth/` – Google sign-in and the session token (see "Sign-in" in the repository's README).
- `lib/data/` – taxonomy and question queries, saved papers and settings (kept on the device with shared_preferences), formatting.
- `lib/widgets/` – shared pieces: question rows, state messages, skeletons.
- `lib/api/api.dart` – Dio (with a cookie jar kept on the device, for the API's view cookies) and the client; `lib/api/generated/` is generated from `../api/openapi.json`. Don't edit it; run `tool/generate_api.sh` after `pnpm openapi`.

Checks (also run by the mobile jobs in `.github/workflows/ci.yml`): `dart format lib test`, `flutter analyze`, `flutter test`. Widget tests drive the whole app with the API replaced by test data (`test/app_harness.dart`): a `FakeBackend` answers the real Dio clients, and fakes stand in for Google's account picker, the scanner and the file picker.
