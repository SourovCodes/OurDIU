// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

part 'admin_room_course.g.dart';

@JsonSerializable()
class AdminRoomCourse {
  const AdminRoomCourse({required this.id, required this.name});

  factory AdminRoomCourse.fromJson(Map<String, Object?> json) =>
      _$AdminRoomCourseFromJson(json);

  final int id;
  final String name;

  Map<String, Object?> toJson() => _$AdminRoomCourseToJson(this);
}
