// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'dart:convert';
import 'dart:io';

import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:retrofit/retrofit.dart';

import '../models/api_v1_me_submissions_id_classification_request_body.dart';
import '../models/my_submission_detail.dart';
import '../models/my_submission_list.dart';
import '../models/post_review_message_input.dart';
import '../models/profile.dart';
import '../models/resubmit_input.dart';
import '../models/review_activity.dart';
import '../models/update_student_id_input.dart';
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

  /// Count your papers that need you: changes asked for, or unread messages
  @GET('/api/v1/me/review-activity')
  Future<ReviewActivity> getApiV1MeReviewActivity();

  /// Get one of your submissions with its review status, AI check and review conversation.
  ///
  /// Marks the conversation read.
  @GET('/api/v1/me/submissions/{id}')
  Future<MySubmissionDetail> getApiV1MeSubmissionsId({
    @Path('id') required int id,
  });

  /// Withdraw one of your submissions that isn't published
  @DELETE('/api/v1/me/submissions/{id}')
  Future<void> deleteApiV1MeSubmissionsId({@Path('id') required int id});

  /// Correct the details of one of your papers waiting for review or for your changes.
  ///
  /// Same fields as uploading. The new details are compared with the AI check's reading, and the paper is published right away if they match, unless a reviewer asked for changes to it: then it waits for them.
  @PUT('/api/v1/me/submissions/{id}/classification')
  Future<MySubmissionDetail> putApiV1MeSubmissionsIdClassification({
    @Path('id') required int id,
    @Body() required ApiV1MeSubmissionsIdClassificationRequestBody body,
  });

  /// Replace the PDF of one of your papers waiting for review or for your changes.
  ///
  /// The AI check runs again on the new file, but a reviewer decides whether it's published.
  @MultiPart()
  @PUT('/api/v1/me/submissions/{id}/file')
  Future<MySubmissionDetail> putApiV1MeSubmissionsIdFile({
    @Path('id') required int id,
    @Part(name: 'file') required File file,
  });

  /// Download the PDF of one of your submissions, in any status
  @GET('/api/v1/me/submissions/{id}/file')
  @DioResponseType(ResponseType.stream)
  Stream<String> getApiV1MeSubmissionsIdFile({@Path('id') required int id});

  /// Send a paper a reviewer asked you to change back for review
  @POST('/api/v1/me/submissions/{id}/resubmit')
  Future<MySubmissionDetail> postApiV1MeSubmissionsIdResubmit({
    @Path('id') required int id,
    @Body() required ResubmitInput body,
  });

  /// Write to the reviewers of one of your papers that isn't published
  @POST('/api/v1/me/submissions/{id}/messages')
  Future<MySubmissionDetail> postApiV1MeSubmissionsIdMessages({
    @Path('id') required int id,
    @Body() required PostReviewMessageInput body,
  });

  /// Change your username.
  ///
  /// Used in your contributor page's URL. 3–50 lowercase letters, digits, dots, dashes or underscores; saved in lowercase.
  @PUT('/api/v1/me/username')
  Future<UpdateUsernameInput> putApiV1MeUsername({
    @Body() required UpdateUsernameInput body,
  });

  /// Set or clear your student ID.
  ///
  /// Optional and private: it isn't shown on your contributor page. Send null to clear it.
  @PUT('/api/v1/me/student-id')
  Future<UpdateStudentIdInput> putApiV1MeStudentId({
    @Body() required UpdateStudentIdInput body,
  });
}
