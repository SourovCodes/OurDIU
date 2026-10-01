// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:dio/dio.dart';
import 'package:retrofit/retrofit.dart';

import '../models/contributor_detail.dart';
import '../models/contributor_list.dart';

part 'contributors_client.g.dart';

@RestApi()
abstract class ContributorsClient {
  factory ContributorsClient(Dio dio, {String? baseUrl}) = _ContributorsClient;

  /// List users who have submitted papers, most published first
  @GET('/api/v1/contributors')
  Future<ContributorList> getApiV1Contributors({
    @Query('page') int? page = 1,
    @Query('pageSize') int? pageSize = 20,
  });

  /// Get a contributor with a page of their published papers.
  ///
  /// By username (any case). A user id works too, for links made before usernames.
  @GET('/api/v1/contributors/{username}')
  Future<ContributorDetail> getApiV1ContributorsUsername({
    @Path('username') required String username,
    @Query('departmentId') int? departmentId,
    @Query('page') int? page = 1,
    @Query('pageSize') int? pageSize = 24,
  });
}
