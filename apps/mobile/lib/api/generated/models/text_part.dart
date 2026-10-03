// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

part 'text_part.g.dart';

@JsonSerializable()
class TextPart {
  const TextPart({required this.text, required this.match});

  factory TextPart.fromJson(Map<String, Object?> json) =>
      _$TextPartFromJson(json);

  final String text;
  final bool match;

  Map<String, Object?> toJson() => _$TextPartToJson(this);
}
