// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

import 'department_list_item.dart';

part 'department_list.g.dart';

@JsonSerializable()
class DepartmentList {
  const DepartmentList({required this.items});

  factory DepartmentList.fromJson(Map<String, Object?> json) =>
      _$DepartmentListFromJson(json);

  final List<DepartmentListItem> items;

  Map<String, Object?> toJson() => _$DepartmentListToJson(this);
}
