// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

part 'resubmit_input.g.dart';

@JsonSerializable()
class ResubmitInput {
  const ResubmitInput({this.note});

  factory ResubmitInput.fromJson(Map<String, Object?> json) =>
      _$ResubmitInputFromJson(json);

  final String? note;

  Map<String, Object?> toJson() => _$ResubmitInputToJson(this);
}
