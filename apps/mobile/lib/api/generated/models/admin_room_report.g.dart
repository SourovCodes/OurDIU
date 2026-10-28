// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'admin_room_report.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

AdminRoomReport _$AdminRoomReportFromJson(
  Map<String, dynamic> json,
) => AdminRoomReport(
  id: (json['id'] as num).toInt(),
  course: AdminRoomCourse.fromJson(json['course'] as Map<String, dynamic>),
  reporter: AdminRoomUser.fromJson(json['reporter'] as Map<String, dynamic>),
  reported: AdminRoomUser.fromJson(json['reported'] as Map<String, dynamic>),
  reason: RoomReportReason.fromJson(json['reason'] as String),
  message: json['message'] as String?,
  status: RoomReportStatus.fromJson(json['status'] as String),
  banned: json['banned'] as bool,
  createdAt: DateTime.parse(json['createdAt'] as String),
);

Map<String, dynamic> _$AdminRoomReportToJson(AdminRoomReport instance) =>
    <String, dynamic>{
      'id': instance.id,
      'course': instance.course,
      'reporter': instance.reporter,
      'reported': instance.reported,
      'reason': _$RoomReportReasonEnumMap[instance.reason]!,
      'message': instance.message,
      'status': _$RoomReportStatusEnumMap[instance.status]!,
      'banned': instance.banned,
      'createdAt': instance.createdAt.toIso8601String(),
    };

const _$RoomReportReasonEnumMap = {
  RoomReportReason.harassment: 'harassment',
  RoomReportReason.spam: 'spam',
  RoomReportReason.inappropriate: 'inappropriate',
  RoomReportReason.other: 'other',
  RoomReportReason.$unknown: r'$unknown',
};

const _$RoomReportStatusEnumMap = {
  RoomReportStatus.pending: 'pending',
  RoomReportStatus.resolved: 'resolved',
  RoomReportStatus.dismissed: 'dismissed',
  RoomReportStatus.$unknown: r'$unknown',
};
