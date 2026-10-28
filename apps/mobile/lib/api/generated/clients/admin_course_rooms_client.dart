// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:dio/dio.dart';
import 'package:retrofit/retrofit.dart';

import '../models/admin_rooms.dart';
import '../models/room_ban_input.dart';
import '../models/room_settings_input.dart';
import '../models/room_voice_check.dart';
import '../models/update_room_report_input.dart';

part 'admin_course_rooms_client.g.dart';

@RestApi()
abstract class AdminCourseRoomsClient {
  factory AdminCourseRoomsClient(Dio dio, {String? baseUrl}) =
      _AdminCourseRoomsClient;

  /// Usage this cycle, open reports and bans
  @GET('/api/v1/admin/rooms')
  Future<AdminRooms> getApiV1AdminRooms();

  /// Pause or resume every room.
  ///
  /// Rooms see a pause within a minute; calls in progress end.
  @PUT('/api/v1/admin/rooms/settings')
  Future<void> putApiV1AdminRoomsSettings({
    @Body() required RoomSettingsInput body,
  });

  /// Check that voice calls are set up.
  ///
  /// Asks Cloudflare's Realtime SFU for a test session with REALTIME_APP_ID and the REALTIME_APP_TOKEN secret, and says what it answered (never the token).
  @POST('/api/v1/admin/rooms/voice-check')
  Future<RoomVoiceCheck> postApiV1AdminRoomsVoiceCheck();

  /// Resolve or dismiss a room report
  @PATCH('/api/v1/admin/rooms/reports/{id}')
  Future<void> patchApiV1AdminRoomsReportsId({
    @Path('id') required int id,
    @Body() required UpdateRoomReportInput body,
  });

  /// Keep someone out of every room.
  ///
  /// With `reportId`, they're also taken out of that report's room now, and the report is resolved.
  @PUT('/api/v1/admin/rooms/bans/{userId}')
  Future<void> putApiV1AdminRoomsBansUserId({
    @Path('userId') required String userId,
    @Body() required RoomBanInput body,
  });

  /// Let someone back into rooms
  @DELETE('/api/v1/admin/rooms/bans/{userId}')
  Future<void> deleteApiV1AdminRoomsBansUserId({
    @Path('userId') required String userId,
  });
}
