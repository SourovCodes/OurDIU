// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

part 'extracted_value.g.dart';

@JsonSerializable()
class ExtractedValue {
  const ExtractedValue({required this.id, required this.name});

  factory ExtractedValue.fromJson(Map<String, Object?> json) =>
      _$ExtractedValueFromJson(json);

  final int? id;
  final String name;

  Map<String, Object?> toJson() => _$ExtractedValueToJson(this);
}
