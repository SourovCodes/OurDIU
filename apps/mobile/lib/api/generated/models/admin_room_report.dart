// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

import 'admin_room_course.dart';
import 'admin_room_user.dart';
import 'room_report_reason.dart';
import 'room_report_status.dart';

part 'admin_room_report.g.dart';

@JsonSerializable()
class AdminRoomReport {
  const AdminRoomReport({
    required this.id,
    required this.course,
    required this.reporter,
    required this.reported,
    required this.reason,
    required this.message,
    required this.status,
    required this.banned,
    required this.createdAt,
  });

  factory AdminRoomReport.fromJson(Map<String, Object?> json) =>
      _$AdminRoomReportFromJson(json);

  final int id;
  final AdminRoomCourse course;
  final AdminRoomUser reporter;
  final AdminRoomUser reported;
  final RoomReportReason reason;
  final String? message;
  final RoomReportStatus status;
  final bool banned;
  final DateTime createdAt;

  Map<String, Object?> toJson() => _$AdminRoomReportToJson(this);
}
