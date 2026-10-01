// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

part 'department_list_item.g.dart';

@JsonSerializable()
class DepartmentListItem {
  const DepartmentListItem({
    required this.id,
    required this.name,
    required this.shortName,
    required this.publishedCount,
  });

  factory DepartmentListItem.fromJson(Map<String, Object?> json) =>
      _$DepartmentListItemFromJson(json);

  final int id;
  final String name;
  final String shortName;
  final int publishedCount;

  Map<String, Object?> toJson() => _$DepartmentListItemToJson(this);
}
