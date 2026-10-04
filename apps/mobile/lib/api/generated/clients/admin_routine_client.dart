// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'dart:convert';
import 'dart:io';

import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:retrofit/retrofit.dart';

import '../models/admin_routine_version_detail.dart';
import '../models/admin_routine_version_list.dart';
import '../models/routine_file.dart';
import '../models/routine_section.dart';

part 'admin_routine_client.g.dart';

@RestApi()
abstract class AdminRoutineClient {
  factory AdminRoutineClient(Dio dio, {String? baseUrl}) = _AdminRoutineClient;

  /// List routine versions, newest first
  @GET('/api/v1/admin/routine/versions')
  Future<AdminRoutineVersionList> getApiV1AdminRoutineVersions();

  /// Upload a routine file as a draft.
  ///
  /// The body is the routine file (`RoutineFile`). A file that can't be used is answered with 422 `INVALID_ROUTINE_FILE` and its problems in `details` (`{ path, message }`). Possible slips (clashes, untitled courses) don't stop the upload: they're the draft's `warnings`.
  @POST('/api/v1/admin/routine/versions')
  Future<AdminRoutineVersionDetail> postApiV1AdminRoutineVersions({
    @Body() required RoutineFile body,
  });

  /// Read DIU's routine PDF into a draft.
  ///
  /// For departments whose PDF OurDIU can read (EEE). The routine read from it is checked like an uploaded file and kept with the PDF; cells that couldn't be read, or were read with a guess, are the draft's first warnings (`unreadable`). A PDF of another layout is answered with 422 `UNKNOWN_ROUTINE_PDF`.
  @MultiPart()
  @POST('/api/v1/admin/routine/versions/pdf')
  Future<AdminRoutineVersionDetail> postApiV1AdminRoutineVersionsPdf({
    @Part(name: 'file') required File file,
  });

  /// A version with its warnings and changes.
  ///
  /// Changes are counted against the live version (for a live version, the one it replaced).
  @GET('/api/v1/admin/routine/versions/{id}')
  Future<AdminRoutineVersionDetail> getApiV1AdminRoutineVersionsId({
    @Path('id') required int id,
  });

  /// Delete a version that isn't live, with its uploaded file
  @DELETE('/api/v1/admin/routine/versions/{id}')
  Future<void> deleteApiV1AdminRoutineVersionsId({@Path('id') required int id});

  /// Make a version the one students see.
  ///
  /// The department's live version becomes a previous version. A previous version can be made live again.
  @POST('/api/v1/admin/routine/versions/{id}/live')
  Future<AdminRoutineVersionDetail> postApiV1AdminRoutineVersionsIdLive({
    @Path('id') required int id,
  });

  /// A section's week in any version, as students would see it.
  ///
  /// For checking a draft before making it live.
  @GET('/api/v1/admin/routine/versions/{id}/sections/{section}')
  Future<RoutineSection> getApiV1AdminRoutineVersionsIdSectionsSection({
    @Path('id') required int id,
    @Path('section') required String section,
  });

  /// Download the file a version was uploaded as
  @GET('/api/v1/admin/routine/versions/{id}/file')
  Future<RoutineFile> getApiV1AdminRoutineVersionsIdFile({
    @Path('id') required int id,
  });

  /// Download DIU's PDF a version was read from
  @GET('/api/v1/admin/routine/versions/{id}/pdf')
  @DioResponseType(ResponseType.stream)
  Stream<String> getApiV1AdminRoutineVersionsIdPdf({
    @Path('id') required int id,
  });
}
