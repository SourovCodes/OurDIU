// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:retrofit/retrofit.dart';

import '../models/api_v1_me_submissions_id_classification_request_body.dart';
import '../models/my_submission_detail.dart';
import '../models/my_submission_list.dart';
import '../models/profile.dart';
import '../models/update_username_input.dart';

part 'account_client.g.dart';

@RestApi()
abstract class AccountClient {
  factory AccountClient(Dio dio, {String? baseUrl}) = _AccountClient;

  /// Get your profile and the counts on your contributor page
  @GET('/api/v1/me')
  Future<Profile> getApiV1Me();

  /// List your own submissions, in every status
  @GET('/api/v1/me/submissions')
  Future<MySubmissionList> getApiV1MeSubmissions();

  /// Get one of your submissions with its review status and AI check
  @GET('/api/v1/me/submissions/{id}')
  Future<MySubmissionDetail> getApiV1MeSubmissionsId({
    @Path('id') required int id,
  });

  /// Withdraw one of your submissions that isn't published
  @DELETE('/api/v1/me/submissions/{id}')
  Future<void> deleteApiV1MeSubmissionsId({@Path('id') required int id});

  /// Correct the details of one of your papers waiting for review.
  ///
  /// Same fields as uploading. The new details are compared with the AI check's reading, and the paper is published right away if they match.
  @PUT('/api/v1/me/submissions/{id}/classification')
  Future<MySubmissionDetail> putApiV1MeSubmissionsIdClassification({
    @Path('id') required int id,
    @Body() required ApiV1MeSubmissionsIdClassificationRequestBody body,
  });

  /// Download the PDF of one of your submissions, in any status
  @GET('/api/v1/me/submissions/{id}/file')
  @DioResponseType(ResponseType.stream)
  Stream<String> getApiV1MeSubmissionsIdFile({@Path('id') required int id});

  /// Change your username.
  ///
  /// Used in your contributor page's URL. 3–50 lowercase letters, digits, dots, dashes or underscores; saved in lowercase.
  @PUT('/api/v1/me/username')
  Future<UpdateUsernameInput> putApiV1MeUsername({
    @Body() required UpdateUsernameInput body,
  });
}
