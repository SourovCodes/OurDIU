// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:dio/dio.dart';
import 'package:retrofit/retrofit.dart';

import '../models/create_room_report_input.dart';
import '../models/created_room_report.dart';
import '../models/room_summary.dart';

part 'course_rooms_client.g.dart';

@RestApi()
abstract class CourseRoomsClient {
  factory CourseRoomsClient(Dio dio, {String? baseUrl}) = _CourseRoomsClient;

  /// How many are in a course's room.
  ///
  /// Public: counts only, no names. Cached for 15 seconds.
  @GET('/api/v1/rooms/{courseId}')
  Future<RoomSummary> getApiV1RoomsCourseId({
    @Path('courseId') required int courseId,
  });

  /// Join a course's room (WebSocket).
  ///
  /// Upgrades to a WebSocket into the course's room: presence, chat (relayed, never stored) and the voice call's signalling with Cloudflare's Realtime SFU. Messages are JSON, `RoomClientMessage` and `RoomServerMessage` in `packages/shared/src/rooms.ts`; send the text "ping" to keep the connection open. For DIU email accounts (and admins). A refused WebSocket is accepted, sent an `error` and closed with a 4xxx code (`ROOM_CLOSE`); without an upgrade, refusals are JSON errors.
  @GET('/api/v1/rooms/{courseId}/socket')
  Future<void> getApiV1RoomsCourseIdSocket({
    @Path('courseId') required int courseId,
  });

  /// Report someone in a course's room.
  ///
  /// For admins to review. Chat isn't stored, so a reported message is kept only as the reporter sends it.
  @POST('/api/v1/rooms/{courseId}/reports')
  Future<CreatedRoomReport> postApiV1RoomsCourseIdReports({
    @Path('courseId') required int courseId,
    @Body() required CreateRoomReportInput body,
  });
}
