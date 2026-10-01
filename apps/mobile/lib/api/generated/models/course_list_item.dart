// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

part 'course_list_item.g.dart';

@JsonSerializable()
class CourseListItem {
  const CourseListItem({
    required this.id,
    required this.name,
    required this.departmentId,
    required this.publishedCount,
  });

  factory CourseListItem.fromJson(Map<String, Object?> json) =>
      _$CourseListItemFromJson(json);

  final int id;
  final String name;
  final int departmentId;
  final int publishedCount;

  Map<String, Object?> toJson() => _$CourseListItemToJson(this);
}
