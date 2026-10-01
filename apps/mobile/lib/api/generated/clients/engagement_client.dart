// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:dio/dio.dart';
import 'package:retrofit/retrofit.dart';

import '../models/cast_vote_input.dart';
import '../models/create_report_input.dart';
import '../models/created_report.dart';
import '../models/question_interactions.dart';
import '../models/vote_result.dart';

part 'engagement_client.g.dart';

@RestApi()
abstract class EngagementClient {
  factory EngagementClient(Dio dio, {String? baseUrl}) = _EngagementClient;

  /// Count a question page view.
  ///
  /// Public and unauthenticated. Counts only views sent from the question's page: `viewToken` from `GET /questions/{id}` in `X-View-Token`, from a browser or app rather than a crawler or script. A token counts each page at most once a minute, and a browser once a day. Other requests are ignored, still with 204.
  ///
  /// [xViewToken] - The question's `viewToken`.
  @POST('/api/v1/questions/{id}/views')
  Future<void> postApiV1QuestionsIdViews({
    @Path('id') required int id,
    @Header('x-view-token') String? xViewToken,
  });

  /// Count a view of a published paper.
  ///
  /// Public and unauthenticated. Counts only views sent from the question's page: `viewToken` from `GET /questions/{id}` in `X-View-Token`, from a browser or app rather than a crawler or script. A token counts each page at most once a minute, and a browser once a day. Other requests are ignored, still with 204.
  ///
  /// [xViewToken] - The question's `viewToken`.
  @POST('/api/v1/submissions/{id}/views')
  Future<void> postApiV1SubmissionsIdViews({
    @Path('id') required int id,
    @Header('x-view-token') String? xViewToken,
  });

  /// Like (1) or dislike (-1) a published paper
  @PUT('/api/v1/submissions/{id}/vote')
  Future<VoteResult> putApiV1SubmissionsIdVote({
    @Path('id') required int id,
    @Body() required CastVoteInput body,
  });

  /// Remove your like or dislike
  @DELETE('/api/v1/submissions/{id}/vote')
  Future<VoteResult> deleteApiV1SubmissionsIdVote({
    @Path('id') required int id,
  });

  /// Report a problem with a published paper.
  ///
  /// Reports are reviewed by an admin. A paper with 3 open reports from different users is hidden (moved back to pending review) automatically.
  @POST('/api/v1/submissions/{id}/reports')
  Future<CreatedReport> postApiV1SubmissionsIdReports({
    @Path('id') required int id,
    @Body() required CreateReportInput body,
  });

  /// Your votes and open reports on a question's papers
  @GET('/api/v1/me/questions/{id}/interactions')
  Future<QuestionInteractions> getApiV1MeQuestionsIdInteractions({
    @Path('id') required int id,
  });
}
