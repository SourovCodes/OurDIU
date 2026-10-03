// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:dio/dio.dart';
import 'package:retrofit/retrofit.dart';

import '../models/android_app.dart';

part 'app_client.g.dart';

@RestApi()
abstract class AppClient {
  factory AppClient(Dio dio, {String? baseUrl}) = _AppClient;

  /// What the Android app needs to know about itself.
  ///
  /// The oldest app version that still works (`ANDROID_MIN_VERSION` in wrangler.jsonc). The app checks it at launch and asks to be updated when it is older.
  @GET('/api/v1/app/android')
  Future<AndroidApp> getApiV1AppAndroid();
}
