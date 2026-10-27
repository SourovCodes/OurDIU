// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:dio/dio.dart';
import 'package:retrofit/retrofit.dart';

import '../models/paper_search_list.dart';
import '../models/question_detail.dart';
import '../models/question_list.dart';
import '../models/question_sort.dart';

part 'questions_client.g.dart';

@RestApi()
abstract class QuestionsClient {
  factory QuestionsClient(Dio dio, {String? baseUrl}) = _QuestionsClient;

  /// List questions that have published submissions
  @GET('/api/v1/questions')
  Future<QuestionList> getApiV1Questions({
    @Query('sort') QuestionSort? sort,
    @Query('departmentId') int? departmentId,
    @Query('courseId') int? courseId,
    @Query('semesterId') int? semesterId,
    @Query('examTypeId') int? examTypeId,
    @Query('page') int? page = 1,
    @Query('pageSize') int? pageSize = 20,
  });

  /// Search the text of published papers.
  ///
  /// Exams whose paper contains every word of `q` (the last word may be a word's start), best match first, with the best-matching copy and its text around the matches. Papers whose text hasn't been read yet aren't found.
  @GET('/api/v1/questions/search')
  Future<PaperSearchList> getApiV1QuestionsSearch({
    @Query('q') required String q,
    @Query('page') int? page = 1,
    @Query('pageSize') int? pageSize = 20,
  });

  /// Get a question with its published submissions
  @GET('/api/v1/questions/{id}')
  Future<QuestionDetail> getApiV1QuestionsId({@Path('id') required int id});
}
