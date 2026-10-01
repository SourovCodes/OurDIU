// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

part 'contributor_department.g.dart';

@JsonSerializable()
class ContributorDepartment {
  const ContributorDepartment({
    required this.id,
    required this.name,
    required this.shortName,
    required this.publishedCount,
  });

  factory ContributorDepartment.fromJson(Map<String, Object?> json) =>
      _$ContributorDepartmentFromJson(json);

  final int id;
  final String name;
  final String shortName;
  final int publishedCount;

  Map<String, Object?> toJson() => _$ContributorDepartmentToJson(this);
}
