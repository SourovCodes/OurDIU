// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:retrofit/retrofit.dart';

import '../models/cover_page_input.dart';
import '../models/cover_page_template.dart';

part 'cover_page_client.g.dart';

@RestApi()
abstract class CoverPageClient {
  factory CoverPageClient(Dio dio, {String? baseUrl}) = _CoverPageClient;

  /// Make a cover page as a PDF.
  ///
  /// One A4 page in DIU's format for an assignment, a lab report or a group assignment, from the details sent. Blank details are left blank. Nothing is kept.
  @POST('/api/v1/cover-page/{template}/pdf')
  @DioResponseType(ResponseType.stream)
  Stream<String> postApiV1CoverPageTemplatePdf({
    @Path('template') required CoverPageTemplate template,
    @Body() required CoverPageInput body,
  });

  /// Make a cover page as a Word document.
  ///
  /// The same page as the PDF, as a .docx to edit in Word or Google Docs. It keeps any script (Bangla too), which the PDF can't. Nothing is kept.
  @POST('/api/v1/cover-page/{template}/docx')
  @DioResponseType(ResponseType.stream)
  Stream<String> postApiV1CoverPageTemplateDocx({
    @Path('template') required CoverPageTemplate template,
    @Body() required CoverPageInput body,
  });
}
