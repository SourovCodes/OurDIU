// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

part 'extracted_department.g.dart';

@JsonSerializable()
class ExtractedDepartment {
  const ExtractedDepartment({
    required this.id,
    required this.name,
    required this.shortName,
  });

  factory ExtractedDepartment.fromJson(Map<String, Object?> json) =>
      _$ExtractedDepartmentFromJson(json);

  final int? id;
  final String name;
  final String? shortName;

  Map<String, Object?> toJson() => _$ExtractedDepartmentToJson(this);
}
