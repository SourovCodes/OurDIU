// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:dio/dio.dart';
import 'package:retrofit/retrofit.dart';

import '../models/save_questions_input.dart';
import '../models/saved_question_list.dart';

part 'saved_client.g.dart';

@RestApi()
abstract class SavedClient {
  factory SavedClient(Dio dio, {String? baseUrl}) = _SavedClient;

  /// Your saved questions.
  ///
  /// Questions you saved (bookmarked), most recently saved first. The same list on the website and in the app.
  @GET('/api/v1/me/saved')
  Future<SavedQuestionList> getApiV1MeSaved();

  /// Save several questions.
  ///
  /// For the app's saved list when the user signs in. Questions already saved stay; unknown ids are ignored.
  @POST('/api/v1/me/saved')
  Future<SavedQuestionList> postApiV1MeSaved({
    @Body() required SaveQuestionsInput body,
  });

  /// Save a question.
  ///
  /// Saving one that is already saved changes nothing.
  @PUT('/api/v1/me/saved/{id}')
  Future<void> putApiV1MeSavedId({@Path('id') required int id});

  /// Remove a saved question.
  ///
  /// Removing one that isn't saved changes nothing.
  @DELETE('/api/v1/me/saved/{id}')
  Future<void> deleteApiV1MeSavedId({@Path('id') required int id});
}
