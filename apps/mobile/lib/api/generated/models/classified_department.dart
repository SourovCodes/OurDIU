// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

part 'classified_department.g.dart';

@JsonSerializable()
class ClassifiedDepartment {
  const ClassifiedDepartment({
    required this.id,
    required this.name,
    required this.shortName,
  });

  factory ClassifiedDepartment.fromJson(Map<String, Object?> json) =>
      _$ClassifiedDepartmentFromJson(json);

  final int? id;
  final String name;
  final String? shortName;

  Map<String, Object?> toJson() => _$ClassifiedDepartmentToJson(this);
}
