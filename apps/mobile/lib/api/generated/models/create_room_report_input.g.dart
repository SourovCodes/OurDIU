// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'create_room_report_input.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

CreateRoomReportInput _$CreateRoomReportInputFromJson(
  Map<String, dynamic> json,
) => CreateRoomReportInput(
  userId: json['userId'] as String,
  reason: RoomReportReason.fromJson(json['reason'] as String),
  message: json['message'] as String?,
);

Map<String, dynamic> _$CreateRoomReportInputToJson(
  CreateRoomReportInput instance,
) => <String, dynamic>{
  'userId': instance.userId,
  'reason': _$RoomReportReasonEnumMap[instance.reason]!,
  'message': instance.message,
};

const _$RoomReportReasonEnumMap = {
  RoomReportReason.harassment: 'harassment',
  RoomReportReason.spam: 'spam',
  RoomReportReason.inappropriate: 'inappropriate',
  RoomReportReason.other: 'other',
  RoomReportReason.$unknown: r'$unknown',
};
