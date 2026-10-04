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
import '../models/missing.dart';
import '../models/routine_course_input.dart';
import '../models/routine_courses_remove_input.dart';
import '../models/routine_department.dart';
import '../models/routine_removed.dart';
import '../models/routine_section.dart';
import '../models/routine_teacher_input.dart';
import '../models/routine_teachers_remove_input.dart';
import '../models/routine_version_input.dart';

part 'admin_routine_client.g.dart';

@RestApi()
abstract class AdminRoutineClient {
  factory AdminRoutineClient(Dio dio, {String? baseUrl}) = _AdminRoutineClient;

  /// List routine versions, newest first
  @GET('/api/v1/admin/routine/versions')
  Future<AdminRoutineVersionList> getApiV1AdminRoutineVersions();

  /// Read DIU's routine file into a draft.
  ///
  /// Each department's file has its own reader (CSE's and EEE's PDFs, SWE's Excel sheet), found by the heading on its first page or at the top of the sheet; another file is answered with 422 `UNKNOWN_ROUTINE_PDF`. SWE's sheet has no version number: `version` is used, else one in the file's name ("…version04.xlsx"), else 422 `NO_VERSION`. What's read is checked: if the PDF's layout changed so it can't be used, 422 `INVALID_ROUTINE_FILE` with the problems in `details` (`{ path, message }`). Cells that couldn't be read, or were read with a guess, are the draft's first warnings (`unreadable`); possible slips in the routine (clashes, untitled courses) follow.
  @MultiPart()
  @POST('/api/v1/admin/routine/versions')
  Future<AdminRoutineVersionDetail> postApiV1AdminRoutineVersions({
    @Part(name: 'file') required File file,
    @Part(name: 'version') String? version,
  });

  /// A version with its warnings and changes.
  ///
  /// Changes are counted against the live version (for a live version, the one it replaced).
  @GET('/api/v1/admin/routine/versions/{id}')
  Future<AdminRoutineVersionDetail> getApiV1AdminRoutineVersionsId({
    @Path('id') required int id,
  });

  /// Change a version's number.
  ///
  /// Students see the new number right away if it's live. A department's numbers are each used once.
  @PATCH('/api/v1/admin/routine/versions/{id}')
  Future<AdminRoutineVersionDetail> patchApiV1AdminRoutineVersionsId({
    @Path('id') required int id,
    @Body() required RoutineVersionInput body,
  });

  /// Delete a version, with its PDF.
  ///
  /// Deleting the live version leaves the department without a routine until another version is made live.
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

  /// Download DIU's file a version was read from
  @GET('/api/v1/admin/routine/versions/{id}/pdf')
  @DioResponseType(ResponseType.stream)
  Stream<String> getApiV1AdminRoutineVersionsIdPdf({
    @Path('id') required int id,
  });

  /// A department's courses and their titles, a page at a time.
  ///
  /// The codes in any of the department's versions, and any given a title, by code. `q` searches codes and titles; `missing=true` keeps those without a title.
  @GET('/api/v1/admin/routine/courses')
  Future<AdminRoutineCourseList> getApiV1AdminRoutineCourses({
    @Query('department') required RoutineDepartment department,
    @Query('q') String? q,
    @Query('missing') Missing? missing,
    @Query('page') int? page = 1,
    @Query('pageSize') int? pageSize = 20,
  });

  /// Take several courses' titles away
  @POST('/api/v1/admin/routine/courses/remove')
  Future<RoutineRemoved> postApiV1AdminRoutineCoursesRemove({
    @Body() required RoutineCoursesRemoveInput body,
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

  /// A department's teachers and their details, a page at a time.
  ///
  /// The initials in any of the department's versions, and any added by hand, by initials. `q` searches initials, names, rooms, emails, phones and course codes; `missing=true` keeps those without a name.
  @GET('/api/v1/admin/routine/teachers')
  Future<AdminRoutineTeacherList> getApiV1AdminRoutineTeachers({
    @Query('department') required RoutineDepartment department,
    @Query('q') String? q,
    @Query('missing') Missing? missing,
    @Query('page') int? page = 1,
    @Query('pageSize') int? pageSize = 20,
  });

  /// Forget several teachers' details
  @POST('/api/v1/admin/routine/teachers/remove')
  Future<RoutineRemoved> postApiV1AdminRoutineTeachersRemove({
    @Body() required RoutineTeachersRemoveInput body,
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
