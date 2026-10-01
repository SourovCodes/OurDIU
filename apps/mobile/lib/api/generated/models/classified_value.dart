// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

part 'classified_value.g.dart';

@JsonSerializable()
class ClassifiedValue {
  const ClassifiedValue({required this.id, required this.name});

  factory ClassifiedValue.fromJson(Map<String, Object?> json) =>
      _$ClassifiedValueFromJson(json);

  final int? id;
  final String name;

  Map<String, Object?> toJson() => _$ClassifiedValueToJson(this);
}
