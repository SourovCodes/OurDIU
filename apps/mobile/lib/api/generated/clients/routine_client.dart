// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:retrofit/retrofit.dart';

import '../models/routine_department_slug.dart';
import '../models/routine_section.dart';
import '../models/routine_section_list.dart';

part 'routine_client.g.dart';

@RestApi()
abstract class RoutineClient {
  factory RoutineClient(Dio dio, {String? baseUrl}) = _RoutineClient;

  /// Every section in a department's live routine.
  ///
  /// With each section's lab groups, for finding your section.
  @GET('/api/v1/routine/{department}/sections')
  Future<RoutineSectionList> getApiV1RoutineDepartmentSections({
    @Path('department') required RoutineDepartmentSlug department,
  });

  /// A section's week in the live routine.
  ///
  /// Every class of the section, including each lab group's labs, in day and time order. The section is matched regardless of case.
  @GET('/api/v1/routine/{department}/sections/{section}')
  Future<RoutineSection> getApiV1RoutineDepartmentSectionsSection({
    @Path('department') required RoutineDepartmentSlug department,
    @Path('section') required String section,
  });

  /// A section's week as a PDF.
  ///
  /// One A4 page: each day's classes with course, time, room and teacher, the routine's version and a QR code to the section's page. With `group`, only that lab group's labs.
  @GET('/api/v1/routine/{department}/sections/{section}/pdf')
  @DioResponseType(ResponseType.stream)
  Stream<String> getApiV1RoutineDepartmentSectionsSectionPdf({
    @Path('department') required RoutineDepartmentSlug department,
    @Path('section') required String section,
    @Query('group') String? group,
  });
}
