import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Settings and small lists kept on the device. `main` loads it before the app
/// starts; tests override it with `SharedPreferences.setMockInitialValues`.
final prefsProvider = Provider<SharedPreferences>(
  (ref) => throw UnimplementedError('prefsProvider is set up in main'),
);
