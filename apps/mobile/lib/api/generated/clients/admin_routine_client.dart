// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'dart:convert';
import 'dart:io';

import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:retrofit/retrofit.dart';

import '../models/admin_routine_course.dart';
import '../models/admin_routine_course_list.dart';
import '../models/admin_routine_teacher.dart';
import '../models/admin_routine_teacher_list.dart';
import '../models/admin_routine_version_detail.dart';
import '../models/admin_routine_version_list.dart';
import '../models/routine_course_input.dart';
import '../models/routine_department.dart';
import '../models/routine_section.dart';
import '../models/routine_teacher_input.dart';

part 'admin_routine_client.g.dart';

@RestApi()
abstract class AdminRoutineClient {
  factory AdminRoutineClient(Dio dio, {String? baseUrl}) = _AdminRoutineClient;

  /// List routine versions, newest first
  @GET('/api/v1/admin/routine/versions')
  Future<AdminRoutineVersionList> getApiV1AdminRoutineVersions();

  /// Read DIU's routine PDF into a draft.
  ///
  /// Each department's PDF has its own reader (CSE's and EEE's so far), found by the heading on its first page; another PDF is answered with 422 `UNKNOWN_ROUTINE_PDF`. What's read is checked: if the PDF's layout changed so it can't be used, 422 `INVALID_ROUTINE_FILE` with the problems in `details` (`{ path, message }`). Cells that couldn't be read, or were read with a guess, are the draft's first warnings (`unreadable`); possible slips in the routine (clashes, untitled courses) follow.
  @MultiPart()
  @POST('/api/v1/admin/routine/versions')
  Future<AdminRoutineVersionDetail> postApiV1AdminRoutineVersions({
    @Part(name: 'file') required File file,
  });

  /// A version with its warnings and changes.
  ///
  /// Changes are counted against the live version (for a live version, the one it replaced).
  @GET('/api/v1/admin/routine/versions/{id}')
  Future<AdminRoutineVersionDetail> getApiV1AdminRoutineVersionsId({
    @Path('id') required int id,
  });

  /// Delete a version that isn't live, with its PDF
  @DELETE('/api/v1/admin/routine/versions/{id}')
  Future<void> deleteApiV1AdminRoutineVersionsId({@Path('id') required int id});

  /// Make a version the one students see.
  ///
  /// The department's live version becomes a previous version. A previous version can be made live again. Teachers the PDF lists are added to the department's; for ones already there, only empty details are filled in.
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

  /// Download DIU's PDF a version was read from
  @GET('/api/v1/admin/routine/versions/{id}/pdf')
  @DioResponseType(ResponseType.stream)
  Stream<String> getApiV1AdminRoutineVersionsIdPdf({
    @Path('id') required int id,
  });

  /// A department's courses and their titles.
  ///
  /// The codes in any of the department's versions, and any given a title, by code.
  @GET('/api/v1/admin/routine/courses')
  Future<AdminRoutineCourseList> getApiV1AdminRoutineCourses({
    @Query('department') required RoutineDepartment department,
  });

  /// Give a course its title.
  ///
  /// Students see it right away, in every version.
  @PUT('/api/v1/admin/routine/courses/{department}/{code}')
  Future<AdminRoutineCourse> putApiV1AdminRoutineCoursesDepartmentCode({
    @Path('department') required RoutineDepartment department,
    @Path('code') required String code,
    @Body() required RoutineCourseInput body,
  });

  /// Take a course's title away
  @DELETE('/api/v1/admin/routine/courses/{department}/{code}')
  Future<void> deleteApiV1AdminRoutineCoursesDepartmentCode({
    @Path('department') required RoutineDepartment department,
    @Path('code') required String code,
  });

  /// A department's teachers and their details.
  ///
  /// The initials in any of the department's versions, and any added by hand, by initials.
  @GET('/api/v1/admin/routine/teachers')
  Future<AdminRoutineTeacherList> getApiV1AdminRoutineTeachers({
    @Query('department') required RoutineDepartment department,
  });

  /// Set a teacher's name, phone, email and room.
  ///
  /// Replaces what's there: a field left out is cleared. Students see it right away.
  @PUT('/api/v1/admin/routine/teachers/{department}/{initials}')
  Future<AdminRoutineTeacher> putApiV1AdminRoutineTeachersDepartmentInitials({
    @Path('department') required RoutineDepartment department,
    @Path('initials') required String initials,
    @Body() required RoutineTeacherInput body,
  });

  /// Forget a teacher's details
  @DELETE('/api/v1/admin/routine/teachers/{department}/{initials}')
  Future<void> deleteApiV1AdminRoutineTeachersDepartmentInitials({
    @Path('department') required RoutineDepartment department,
    @Path('initials') required String initials,
  });
}
