// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:dio/dio.dart';

import 'clients/system_client.dart';
import 'clients/taxonomy_client.dart';
import 'clients/questions_client.dart';
import 'clients/submissions_client.dart';
import 'clients/contributors_client.dart';
import 'clients/account_client.dart';
import 'clients/routine_client.dart';
import 'clients/admin_routine_client.dart';
import 'clients/app_client.dart';
import 'clients/engagement_client.dart';
import 'clients/saved_client.dart';
import 'clients/profile_images_client.dart';

/// OurDIU API `v1.0.0`
class QbApi {
  QbApi(Dio dio, {String? baseUrl}) : _dio = dio, _baseUrl = baseUrl;

  final Dio _dio;
  final String? _baseUrl;

  static String get version => '1.0.0';

  SystemClient? _system;
  TaxonomyClient? _taxonomy;
  QuestionsClient? _questions;
  SubmissionsClient? _submissions;
  ContributorsClient? _contributors;
  AccountClient? _account;
  RoutineClient? _routine;
  AdminRoutineClient? _adminRoutine;
  AppClient? _app;
  EngagementClient? _engagement;
  SavedClient? _saved;
  ProfileImagesClient? _profileImages;

  SystemClient get system => _system ??= SystemClient(_dio, baseUrl: _baseUrl);

  TaxonomyClient get taxonomy =>
      _taxonomy ??= TaxonomyClient(_dio, baseUrl: _baseUrl);

  QuestionsClient get questions =>
      _questions ??= QuestionsClient(_dio, baseUrl: _baseUrl);

  SubmissionsClient get submissions =>
      _submissions ??= SubmissionsClient(_dio, baseUrl: _baseUrl);

  ContributorsClient get contributors =>
      _contributors ??= ContributorsClient(_dio, baseUrl: _baseUrl);

  AccountClient get account =>
      _account ??= AccountClient(_dio, baseUrl: _baseUrl);

  RoutineClient get routine =>
      _routine ??= RoutineClient(_dio, baseUrl: _baseUrl);

  AdminRoutineClient get adminRoutine =>
      _adminRoutine ??= AdminRoutineClient(_dio, baseUrl: _baseUrl);

  AppClient get app => _app ??= AppClient(_dio, baseUrl: _baseUrl);

  EngagementClient get engagement =>
      _engagement ??= EngagementClient(_dio, baseUrl: _baseUrl);

  SavedClient get saved => _saved ??= SavedClient(_dio, baseUrl: _baseUrl);

  ProfileImagesClient get profileImages =>
      _profileImages ??= ProfileImagesClient(_dio, baseUrl: _baseUrl);
}
