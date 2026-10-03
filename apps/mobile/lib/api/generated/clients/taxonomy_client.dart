// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:dio/dio.dart';
import 'package:retrofit/retrofit.dart';

import '../models/course_list.dart';
import '../models/department_list.dart';
import '../models/exam_type_list.dart';
import '../models/merged_id.dart';
import '../models/merged_kind.dart';
import '../models/semester_list.dart';
import '../models/taxonomy.dart';
import '../models/trending_course_list.dart';

part 'taxonomy_client.g.dart';

@RestApi()
abstract class TaxonomyClient {
  factory TaxonomyClient(Dio dio, {String? baseUrl}) = _TaxonomyClient;

  /// List departments, courses, semesters and exam types at once
  @GET('/api/v1/taxonomy')
  Future<Taxonomy> getApiV1Taxonomy();

  /// List departments
  @GET('/api/v1/departments')
  Future<DepartmentList> getApiV1Departments();

  /// List the courses whose exams were viewed most in the last 24 hours.
  ///
  /// Most views first, at most 20; refreshed every 10 minutes. Empty when nothing was viewed.
  @GET('/api/v1/courses/trending')
  Future<TrendingCourseList> getApiV1CoursesTrending();

  /// List courses, optionally for one department
  @GET('/api/v1/courses')
  Future<CourseList> getApiV1Courses({
    @Query('departmentId') int? departmentId,
  });

  /// List semesters
  @GET('/api/v1/semesters')
  Future<SemesterList> getApiV1Semesters();

  /// List exam types
  @GET('/api/v1/exam-types')
  Future<ExamTypeList> getApiV1ExamTypes();

  /// Where a merged entry went.
  ///
  /// When admins merge duplicate catalog entries, the removed ones (and questions combined with another) are deleted. This returns the id of the entry that was kept, so old links can be redirected.
  @GET('/api/v1/merged/{kind}/{id}')
  Future<MergedId> getApiV1MergedKindId({
    @Path('kind') required MergedKind kind,
    @Path('id') required int id,
  });
}
