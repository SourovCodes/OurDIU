// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'dart:convert';
import 'dart:io';

import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:retrofit/retrofit.dart';

import '../models/created_submission.dart';

part 'submissions_client.g.dart';

@RestApi()
abstract class SubmissionsClient {
  factory SubmissionsClient(Dio dio, {String? baseUrl}) = _SubmissionsClient;

  /// Contribute a question paper (requires sign-in with a DIU email).
  ///
  /// Only accounts on a DIU address (and admins) can contribute. Department, course and semester can each be an existing id or a new name. Submissions with new names have no question until an admin approves the new values.
  @MultiPart()
  @POST('/api/v1/submissions')
  Future<CreatedSubmission> postApiV1Submissions({
    @Part(name: 'examTypeId') required int examTypeId,
    @Part(name: 'file') required File file,
    @Part(name: 'departmentId') int? departmentId,
    @Part(name: 'customDepartmentName') String? customDepartmentName,
    @Part(name: 'customDepartmentShortName') String? customDepartmentShortName,
    @Part(name: 'courseId') int? courseId,
    @Part(name: 'customCourseName') String? customCourseName,
    @Part(name: 'semesterId') int? semesterId,
    @Part(name: 'customSemesterName') String? customSemesterName,
    @Part(name: 'section') String? section,
    @Part(name: 'batch') String? batch,
  });

  /// Download the PDF of a published submission
  @GET('/api/v1/submissions/{id}/file')
  @DioResponseType(ResponseType.stream)
  Stream<String> getApiV1SubmissionsIdFile({@Path('id') required int id});
}
