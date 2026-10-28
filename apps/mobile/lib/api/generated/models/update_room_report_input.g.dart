// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'update_room_report_input.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

UpdateRoomReportInput _$UpdateRoomReportInputFromJson(
  Map<String, dynamic> json,
) => UpdateRoomReportInput(
  status: UpdateRoomReportInputStatus.fromJson(json['status'] as String),
);

Map<String, dynamic> _$UpdateRoomReportInputToJson(
  UpdateRoomReportInput instance,
) => <String, dynamic>{
  'status': _$UpdateRoomReportInputStatusEnumMap[instance.status]!,
};

const _$UpdateRoomReportInputStatusEnumMap = {
  UpdateRoomReportInputStatus.resolved: 'resolved',
  UpdateRoomReportInputStatus.dismissed: 'dismissed',
  UpdateRoomReportInputStatus.$unknown: r'$unknown',
};
